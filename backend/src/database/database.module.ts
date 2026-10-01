import { Global, Module, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_CONNECTION = 'PG_CONNECTION';

const dbProvider = {
    provide: PG_CONNECTION,
    useFactory: () => {
        const connectionString = process.env.DATABASE_URL?.trim();
        if (!connectionString) {
            throw new Error(
                'DATABASE_URL is required in backend/.env for login and pet data',
            );
        }
        return new Pool({
            connectionString,
            ssl:
                process.env.DATABASE_SSL === 'false'
                    ? false
                    : { rejectUnauthorized: false },
        });
    },
};

@Global()
@Module({
    providers: [dbProvider],
    exports: [dbProvider],
})
export class DatabaseModule implements OnModuleInit {
    private readonly logger = new Logger(DatabaseModule.name);

    constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

    async onModuleInit() {
        try {
            await this.pool.query('SELECT 1');
            this.logger.log('Connected to PostgreSQL');
        } catch (error) {
            this.logger.error(
                'PostgreSQL connection failed; check DATABASE_URL in backend/.env',
                error,
            );
            throw error;
        }
    }
}
