-- Application services use a server-side PostgreSQL connection. These tables
-- are not accessible through Supabase's public Data API without an RLS policy.
CREATE TABLE IF NOT EXISTS public.catalog_services (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    provider TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL CHECK (price >= 0),
    category TEXT NOT NULL,
    species TEXT[] NOT NULL,
    tags TEXT[] NOT NULL,
    description TEXT NOT NULL,
    location JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public.service_ratings (
    service_id INTEGER PRIMARY KEY,
    average_rating DOUBLE PRECISION NOT NULL CHECK (average_rating BETWEEN 0 AND 5),
    review_count INTEGER NOT NULL CHECK (review_count >= 0),
    version BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;
