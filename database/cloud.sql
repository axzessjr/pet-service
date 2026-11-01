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

CREATE TABLE IF NOT EXISTS public.saved_recommendations (
    id TEXT PRIMARY KEY,
    pet_id INTEGER NOT NULL,
    limit_value INTEGER NOT NULL CHECK (limit_value BETWEEN 1 AND 100),
    matches_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS saved_recommendations_pet_id
    ON public.saved_recommendations (pet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.service_ratings (
    service_id INTEGER PRIMARY KEY,
    average_rating DOUBLE PRECISION NOT NULL CHECK (average_rating BETWEEN 0 AND 5),
    review_count INTEGER NOT NULL CHECK (review_count >= 0),
    version BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_ratings ENABLE ROW LEVEL SECURITY;
