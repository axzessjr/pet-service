# How the recommender works

The **For my pet** page calls `GET /recommendation/pets/:petId` on the NestJS backend. NestJS loads the selected pet and current catalog, then sends their data to this Python service over gRPC. The service returns ranked service IDs, similarity scores, and the pet needs each service matches. NestJS attaches the full catalog details before responding to the page.

## Ranking steps

1. Keep services that support the pet's species and fit its `maxPrice` budget.
2. Build a binary vector from the pet's `needs` and a binary vector from each service's `tags`. A value is `1` when a tag is present and `0` otherwise.
3. Use scikit-learn's `NearestNeighbors` with cosine distance to compare the pet vector with **every** eligible service vector (`n_neighbors` equals the number of eligible services). The returned score is `1 - distance`, so an exact tag match scores `1.0`.
4. Return up to five services with at least one matching need. When similarity is tied, the higher average rating wins, then the lower price, then the service ID. A service with no reviews counts as 3.0, the middle of the 1-5 scale, so it is not placed below a poorly rated service.

For example, Max needs `exercise` and `social` and has a $45 budget. **Neighborhood Dog Walk** supports dogs, costs $15, and has both tags, so it scores `1.0`. Cat-only services and services above $45 are filtered out before ranking.

In practical terms, this is tag matching and cosine-similarity ranking implemented with the `NearestNeighbors` API. It retrieves all eligible services before applying the result limit, and it does not train on bookings or reviews. Scores measure tag similarity, not star ratings or predicted probabilities; ratings only break ties, so a well-rated service never outranks a closer tag match. If a pet has no needs, the service returns compatible services ordered by rating, then price.

## Saved recommendation sets

The gRPC service also supports `CreateRecommendation`, `GetRecommendation`, `ListRecommendations`, `UpdateRecommendation`, and `DeleteRecommendation`. Create ranks the supplied pet and catalog and saves the result. Update replaces the matches for the same ID using fresh input. Read and list return the saved matches without recalculating them. The records contain pet IDs, limits, matches, and timestamps, and live in a SQLite database configured with `RECOMMENDATION_DB_PATH` (default: `recommendations.sqlite3` beside this file). Docker Compose mounts a named volume at `/data` so records survive container replacement.

## Rating events

Ratings come from the usage and review service through RabbitMQ. A background thread in [`events.py`](events.py) binds the durable queue `recommendation.review-events` to the `pawpal.events` topic exchange with the routing key `review.*`. Each `review.created`, `review.updated`, or `review.deleted` message carries the service's new `averageRating`, `reviewCount`, and `version`. The consumer saves them in the `service_ratings` table of the same SQLite database, then acknowledges the message.

Delivery is at-least-once, so the same event can arrive twice or late. The consumer keeps a rating only when its `version` is newer than the stored one, which makes redelivery harmless. Invalid messages are logged and dropped. If RabbitMQ is unavailable, gRPC keeps serving with the last known ratings and the consumer retries every five seconds. Set `RABBITMQ_URL` to enable the consumer; without it, ratings are not updated.

Live and saved matches include `average_rating` and `review_count` (both `0` for an unreviewed service). A saved set keeps the ratings from when it was calculated.

Implementation: [`engine.py`](engine.py). gRPC entry point: [`server.py`](server.py). Shared contract: [`../proto/recommendation.proto`](../proto/recommendation.proto).
