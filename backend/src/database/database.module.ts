import { Global, Module, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_CONNECTION = 'PG_CONNECTION';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

// Supabase closes idle pooled connections now and then. pg reports that as an
// 'error' event on the pool, and an unhandled 'error' event stops the whole
// process. Log it instead: the pool drops that client and opens a new one.
pool.on('error', (error) => {
    new Logger('DatabasePool').warn(
        `Idle database connection closed: ${error.message}`,
    );
});

const dbProvider = {
    provide: PG_CONNECTION,
    useValue: pool,
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
            const res = await this.pool.query<{ now: Date }>('SELECT NOW()');
            this.logger.log(
                '✅ Connected to Supabase PostgreSQL successfully at ' +
                    res.rows[0].now.toString(),
            );
        } catch (error) {
            this.logger.error(
                '❌ Failed to connect to Supabase PostgreSQL:',
                error,
            );
        }
    }
}
