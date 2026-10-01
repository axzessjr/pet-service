import { Global, Module, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_CONNECTION = 'PG_CONNECTION';

const dbProvider = {
    provide: PG_CONNECTION,
    useValue: new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    }),
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
            const res = await this.pool.query('SELECT NOW()');
            this.logger.log('✅ Connected to Supabase PostgreSQL successfully at ' + res.rows[0].now);
        } catch (error) {
            this.logger.error('❌ Failed to connect to Supabase PostgreSQL:', error);
        }
    }
}

