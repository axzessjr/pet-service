"""gRPC entry point for the recommendation engine."""

import os
import signal
from concurrent import futures

import grpc
import psycopg

import recommendation_pb2
import recommendation_pb2_grpc
from config import database_url
from engine import Pet, Service, recommend
from events import start_consumer
from store import RatingStore


class RecommendationEngine(recommendation_pb2_grpc.RecommendationEngineServicer):
    def __init__(self, store: RatingStore):
        self.store = store

    def _ratings(self, service_ids: list[int]) -> dict[int, tuple[float, int]]:
        """Ratings only break ties, so rank without them if the cache is unreachable."""
        try:
            return self.store.ratings(service_ids)
        except psycopg.Error as error:
            print(f"Ranking without ratings; rating cache unavailable ({error!r})", flush=True)
            return {}

    def Recommend(self, request, context):
        # Only the services in this request, not the whole ratings table.
        ratings = self._ratings([item.id for item in request.services])
        pet = Pet(
            species=request.pet.species,
            needs=tuple(request.pet.needs),
            max_price=request.pet.max_price,
        )
        services = [
            Service(
                id=item.id,
                species=tuple(item.species),
                tags=tuple(item.tags),
                price=item.price,
            )
            for item in request.services
        ]
        matches = recommend(
            pet,
            services,
            request.limit,
            {service_id: average for service_id, (average, _) in ratings.items()},
        )
        response = recommendation_pb2.RecommendationResponse()
        for match in matches:
            average, count = ratings.get(match.service_id, (0.0, 0))
            response.matches.add(
                service_id=match.service_id,
                score=match.score,
                matched_needs=match.matched_needs,
                average_rating=average,
                review_count=count,
            )
        return response


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    store = RatingStore(database_url())
    recommendation_pb2_grpc.add_RecommendationEngineServicer_to_server(
        RecommendationEngine(store), server
    )
    start_consumer(store)
    address = os.getenv("GRPC_BIND", "0.0.0.0:50051")
    if server.add_insecure_port(address) == 0:
        raise RuntimeError(f"Could not bind gRPC server to {address}")
    server.start()
    # As PID 1 in a container, Python ignores SIGTERM unless it has a handler,
    # so `docker stop` and Kubernetes would wait and then kill it. Finish
    # in-flight calls for up to 5 seconds instead.
    signal.signal(signal.SIGTERM, lambda *_: server.stop(5))
    print(f"Recommendation gRPC server listening on {address}", flush=True)
    try:
        server.wait_for_termination()
    finally:
        server.stop(5).wait()
        store.close()


if __name__ == "__main__":
    serve()
