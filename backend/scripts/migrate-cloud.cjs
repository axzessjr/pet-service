// Run from backend: npm run db:migrate. Existing cloud rows are never replaced.
const path = require('node:path');
const fs = require('node:fs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });
require('ts-node/register');
const { CATALOG } = require('../src/catalog/catalog.data');

async function migrate() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
    });
    let client;
    let committed = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query(fs.readFileSync(path.join(__dirname, '../../database/cloud.sql'), 'utf8'));
        let inserted = 0;
        for (const item of CATALOG) {
            const result = await client.query(
                `INSERT INTO public.catalog_services
                 (id, title, provider, price, category, species, tags, description, location)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
                 ON CONFLICT (id) DO NOTHING`,
                [item.id, item.title, item.provider, item.price, item.category,
                    item.species, item.tags, item.description, JSON.stringify(item.location)],
            );
            inserted += result.rowCount;
        }
        await client.query('COMMIT');
        committed = true;
        const { rows } = await client.query('SELECT count(*)::int AS count FROM public.catalog_services');
        console.log(`Cloud schema ready. Catalog: ${rows[0].count} services (${inserted} inserted).`);
    } catch (error) {
        if (client && !committed) await client.query('ROLLBACK').catch(() => {});
        // Do not print connection strings or database credentials.
        console.error(committed
            ? `Migration committed, but final verification failed (${error.code || error.name}). Rerun to verify.`
            : `Cloud migration failed (${error.code || error.name}). Rerunning is safe; existing rows are preserved.`);
        process.exitCode = 1;
    } finally {
        client?.release();
        await pool.end();
    }
}

migrate().catch(() => { console.error('DATABASE_URL is required'); process.exitCode = 1; });
