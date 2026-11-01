import { config } from 'dotenv';
import { resolve } from 'node:path';

// Same path from src/ and dist/. Compose supplies variables directly.
config({ path: resolve(__dirname, '../../.env'), quiet: true });
