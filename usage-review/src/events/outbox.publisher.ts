import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnApplicationShutdown,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import { Pool } from 'pg';
import { inTransaction, PG_POOL } from '../database/database.module';

export const EVENTS_EXCHANGE = 'pawpal.events';

// Sends outbox rows to RabbitMQ and marks them published only after the broker
// confirms them. Delivery is at-least-once, so consumers must be idempotent.
@Injectable()
export class OutboxPublisher
    implements OnApplicationBootstrap, OnApplicationShutdown
{
    private readonly logger = new Logger(OutboxPublisher.name);
    private readonly url = process.env.RABBITMQ_URL;
    private connection?: ChannelModel;
    private channel?: ConfirmChannel;
    private timer?: NodeJS.Timeout;
    private busy = false;
    private failing = false;

    constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

    onApplicationBootstrap() {
        if (!this.url) {
            this.logger.warn(
                'RABBITMQ_URL is not set; events will wait in the outbox',
            );
            return;
        }
        this.timer = setInterval(() => void this.publishPending(), 1000);
    }

    async onApplicationShutdown() {
        clearInterval(this.timer);
        await this.disconnect();
    }

    async publishPending(): Promise<number> {
        if (this.busy) return 0;
        this.busy = true;
        try {
            const count = await inTransaction(this.pool, async (client) => {
                // SKIP LOCKED lets several instances share the outbox safely.
                const { rows } = await client.query<{
                    id: string;
                    eventType: string;
                    payload: unknown;
                }>(
                    `SELECT id, event_type AS "eventType", payload
                     FROM outbox
                     WHERE published_at IS NULL
                     ORDER BY id
                     LIMIT 100
                     FOR UPDATE SKIP LOCKED`,
                );
                if (rows.length === 0) return 0;

                const channel = await this.getChannel();
                for (const row of rows) {
                    channel.publish(
                        EVENTS_EXCHANGE,
                        row.eventType,
                        Buffer.from(JSON.stringify(row.payload)),
                        {
                            persistent: true,
                            contentType: 'application/json',
                            messageId: row.id,
                            type: row.eventType,
                        },
                    );
                }
                await channel.waitForConfirms();
                await client.query(
                    'UPDATE outbox SET published_at = now() WHERE id = ANY($1::bigint[])',
                    [rows.map((row) => row.id)],
                );
                return rows.length;
            });
            if (this.failing) {
                this.logger.log('Outbox publisher recovered');
                this.failing = false;
            }
            if (count > 0) this.logger.log(`Published ${count} event(s)`);
            return count;
        } catch (error) {
            if (!this.failing) {
                this.logger.warn(
                    `Could not publish events; will retry: ${String(error)}`,
                );
                this.failing = true;
            }
            await this.disconnect();
            return 0;
        } finally {
            this.busy = false;
        }
    }

    private async getChannel(): Promise<ConfirmChannel> {
        if (this.channel) return this.channel;

        const connection = await amqp.connect(this.url!);
        // Errors are followed by 'close'; listening prevents an unhandled 'error' crash.
        connection.on('error', () => undefined);
        connection.on('close', () => {
            this.connection = undefined;
            this.channel = undefined;
        });
        const channel = await connection.createConfirmChannel();
        channel.on('error', () => undefined);
        channel.on('close', () => {
            this.channel = undefined;
        });
        await channel.assertExchange(EVENTS_EXCHANGE, 'topic', {
            durable: true,
        });

        this.connection = connection;
        this.channel = channel;
        return channel;
    }

    private async disconnect(): Promise<void> {
        const connection = this.connection;
        this.connection = undefined;
        this.channel = undefined;
        await connection?.close().catch(() => undefined);
    }
}
