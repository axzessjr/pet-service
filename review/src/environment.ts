import { config } from 'dotenv';
import { resolve } from 'node:path';

// Same path from src/ and dist/. Explicit process variables take precedence.
const root = resolve(__dirname, '../..');
config({ path: resolve(root, '.env'), quiet: true });
const certificate = process.env.MONGODB_TLS_CERTIFICATE_KEY_FILE;
if (certificate) {
    process.env.MONGODB_TLS_CERTIFICATE_KEY_FILE = resolve(root, certificate);
}
