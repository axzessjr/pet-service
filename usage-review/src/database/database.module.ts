import { Global, Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { SCHEMA } from './schema';

export const PG_POOL = 'PG_POOL';

const poolProvider = {
    provide: PG_POOL,
    useValue: new Pool({ connectionString: process.env.DATABASE_URL }),
};

export async function inTransaction<T>(
    pool: Pool,
    work: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await work(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
    } finally {
        client.release();
    }
}

@Global()
@Module({
    providers: [poolProvider],
    exports: [poolProvider],
})
export class DatabaseModule implements OnModuleInit {
    private readonly logger = new Logger(DatabaseModule.name);

    constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

    async onModuleInit() {
        await this.pool.query(SCHEMA);
        this.logger.log('Database schema is ready');
    }
}
