# How the recommender works

The **For my pet** page calls `GET /recommendation/pets/:petId` on the NestJS backend. NestJS loads the selected pet and current catalog, then sends their data to this Python service over gRPC. The service returns ranked service IDs, similarity scores, and the pet needs each service matches. NestJS attaches the full catalog details before responding to the page.

## Ranking steps

1. Keep services that support the pet's species and fit its `maxPrice` budget.
2. Build a binary vector from the pet's `needs` and a binary vector from each service's `tags`. A value is `1` when a tag is present and `0` otherwise.
3. Use scikit-learn's `NearestNeighbors` with cosine distance to find the closest service vectors. The returned score is `1 - distance`, so an exact tag match scores `1.0`.
4. Return up to five services with at least one matching need. When similarity is tied, the lower price wins, followed by service ID.

For example, Max needs `exercise` and `social` and has a $45 budget. **Neighborhood Dog Walk** supports dogs, costs $15, and has both tags, so it scores `1.0`. Cat-only services and services above $45 are filtered out before ranking.

This is content-based nearest-neighbor matching. It uses the current catalog on each request; it does not train on bookings or reviews. Scores measure tag similarity, not star ratings or predicted probabilities. If a pet has no needs, the service returns the cheapest compatible services instead.

Implementation: [`engine.py`](engine.py). gRPC entry point: [`server.py`](server.py). Shared contract: [`../proto/recommendation.proto`](../proto/recommendation.proto).
