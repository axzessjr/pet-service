const path = require('node:path');
const root = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });

function atlasConfig() {
    const url = process.env.MONGODB_URL;
    if (!url) throw new Error('Set MONGODB_URL in the root .env');
    // Check the hostname without printing credentials. This command must never
    // mistake the old local database for a completed Atlas migration.
    const authority = url.split('://')[1]?.split('/')[0]?.split('@').pop();
    const hosts = authority?.split(',').map((host) => host.split(':')[0]);
    if (!hosts?.length || !hosts.every((host) => host.endsWith('.mongodb.net'))) {
        throw new Error('MONGODB_URL must point to MongoDB Atlas; the root .env uses another host');
    }
    const certificate = process.env.MONGODB_TLS_CERTIFICATE_KEY_FILE;
    return {
        url,
        database: process.env.MONGODB_DB || 'reviews',
        options: certificate ? { tlsCertificateKeyFile: path.resolve(root, certificate) } : {},
    };
}

module.exports = { atlasConfig };
