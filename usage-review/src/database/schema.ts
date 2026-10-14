// pet_id, owner_id, and service_id belong to other services, so they are plain
// IDs here rather than foreign keys. Only usages <-> reviews is enforced.
export const SCHEMA = `
    CREATE TABLE IF NOT EXISTS usages (
        id            SERIAL PRIMARY KEY,
        owner_id      INT NOT NULL,
        pet_id        INT NOT NULL,
        service_id    INT NOT NULL,
        service_title TEXT NOT NULL,
        provider      TEXT NOT NULL,
        price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
        status        TEXT NOT NULL DEFAULT 'booked'
                      CHECK (status IN ('booked', 'completed', 'cancelled')),
        completed_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS usages_owner ON usages (owner_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS reviews (
        id          SERIAL PRIMARY KEY,
        usage_id    INT NOT NULL UNIQUE REFERENCES usages (id),
        service_id  INT NOT NULL,
        owner_id    INT NOT NULL,
        rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT NOT NULL DEFAULT '',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS reviews_service ON reviews (service_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS reviews_owner ON reviews (owner_id, created_at DESC);

    -- Running totals per service. version increases on every change so
    -- consumers can ignore stale or duplicate events.
    CREATE TABLE IF NOT EXISTS service_ratings (
        service_id   INT PRIMARY KEY,
        rating_sum   INT NOT NULL,
        review_count INT NOT NULL,
        version      INT NOT NULL
    );

    -- Transactional outbox: events are written in the same transaction as the
    -- review, then published to RabbitMQ by OutboxPublisher.
    CREATE TABLE IF NOT EXISTS outbox (
        id           BIGSERIAL PRIMARY KEY,
        event_type   TEXT NOT NULL,
        payload      JSONB NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        published_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS outbox_unpublished ON outbox (id) WHERE published_at IS NULL;
`;
