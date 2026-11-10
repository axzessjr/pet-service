const { MongoClient } = require('mongodb');
const { atlasConfig } = require('./cloud-config.cjs');

(async () => {
    const { url, database, options } = atlasConfig();
    const client = new MongoClient(url, { ...options, serverSelectionTimeoutMS: 10000 });
    try {
        await client.connect();
        const db = client.db(database);
        await db.command({ ping: 1 });
        const counts = {};
        for (const name of ['reviews', 'review_photos.files', 'review_photos.chunks']) {
            counts[name] = await db.collection(name).countDocuments();
        }
        console.log('Atlas connection verified:', JSON.stringify(counts));
    } finally {
        await client.close();
    }
})().catch((error) => {
    console.error(error.message?.startsWith('MONGODB_URL') || error.message?.startsWith('Set MONGODB_URL')
        ? error.message : `Atlas check failed (${error.code || error.name}); check credentials and Atlas Network Access.`);
    process.exitCode = 1;
});
