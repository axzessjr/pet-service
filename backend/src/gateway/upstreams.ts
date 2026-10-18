import { SetMetadata } from '@nestjs/common';

// The internal services this gateway forwards to. Set the env vars to your
// machine's IP (e.g. http://192.168.1.20:3001) when the services run outside
// docker compose.
export const UPSTREAMS = {
    review: {
        protocol: 'http',
        url: process.env.REVIEW_URL ?? 'http://localhost:3001',
    },
    recommender: {
        protocol: 'grpc',
        url: process.env.RECOMMENDATION_GRPC_URL ?? 'localhost:50051',
    },
} as const;

export type UpstreamName = keyof typeof UPSTREAMS;

export const UPSTREAM_METADATA = 'gateway:upstream';

// Marks a controller whose routes are forwarded to an upstream service.
// Controllers without it are handled inside the gateway.
export const Upstream = (name: UpstreamName) =>
    SetMetadata(UPSTREAM_METADATA, name);
