// Stop the review service before running. The source is read-only and retained.
// Re-running inserts only missing documents and verifies every copied document.
const { MongoClient } = require('mongodb');
const { isDeepStrictEqual } = require('node:util');
const { atlasConfig } = require('./cloud-config.cjs');

async function migrate() {
    const { url, database, options } = atlasConfig();
    const source = new MongoClient(
        process.env.SOURCE_MONGODB_URL || 'mongodb://review:review@127.0.0.1:27018/?authSource=admin',
        { serverSelectionTimeoutMS: 10000 },
    );
    const target = new MongoClient(url, { ...options, serverSelectionTimeoutMS: 10000 });
    try {
        await source.connect();
        await target.connect();
        const from = source.db(process.env.SOURCE_MONGODB_DB || 'reviews');
        const to = target.db(database);
        // Copy chunks before their metadata and reviews. Locks are transient and
        // must not be carried across. Preserve versions and pending outbox events.
        for (const name of ['review_photos.chunks', 'review_photos.files', 'reviews', 'service_versions']) {
            const collection = from.collection(name);
            const initialCount = await collection.countDocuments();
            let copied = 0;
            let batch = [];
            async function copyBatch() {
                if (!batch.length) return;
                await to.collection(name).bulkWrite(batch.map((document) => ({
                    updateOne: { filter: { _id: document._id }, update: { $setOnInsert: document }, upsert: true },
                })));
                const documents = await to.collection(name).find({ _id: { $in: batch.map((document) => document._id) } }).toArray();
                for (const original of batch) {
                    const actual = documents.find((document) => isDeepStrictEqual(document._id, original._id));
                    if (!isDeepStrictEqual(actual, original)) {
                        throw new Error(`Migration conflict in ${name}; existing Atlas data was not overwritten`);
                    }
                }
                copied += batch.length;
                batch = [];
            }
            for await (const document of collection.find()) {
                batch.push(document);
                if (batch.length === 25) await copyBatch();
            }
            await copyBatch();
            if (copied !== initialCount || await collection.countDocuments() !== initialCount) {
                throw new Error('Source changed during migration; stop review writers and rerun');
            }
            // Preserve GridFS's unique (files_id, n) index and application indexes.
            if (await from.listCollections({ name }).hasNext()) {
                for (const index of await collection.listIndexes().toArray()) {
                    if (index.name === '_id_') continue;
                    const { key, name: indexName, v, ns, ...options } = index;
                    await to.collection(name).createIndex(key, { ...options, name: indexName });
                }
            }
            console.log(`${name}: ${copied} documents verified`);
        }
        console.log('Atlas copy complete. Local source retained. Start the review service only after verification.');
    } finally {
        await source.close();
        await target.close();
    }
}

migrate().catch((error) => {
    console.error(/^(MONGODB_URL|Set MONGODB_URL|Migration conflict|Source changed)/.test(error.message)
        ? error.message : `Atlas migration failed (${error.code || error.name}). Source retained; retry after resolving the connection or write error.`);
    process.exitCode = 1;
});
