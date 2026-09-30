"""gRPC entry point for the recommendation engine."""

import os
from concurrent import futures

import grpc

import recommendation_pb2
import recommendation_pb2_grpc
from engine import Pet, Service, recommend


class RecommendationEngine(recommendation_pb2_grpc.RecommendationEngineServicer):
    def Recommend(self, request, context):
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
        matches = recommend(pet, services, request.limit)
        return recommendation_pb2.RecommendationResponse(
            matches=[
                recommendation_pb2.Match(
                    service_id=match.service_id,
                    score=match.score,
                    matched_needs=match.matched_needs,
                )
                for match in matches
            ]
        )


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    recommendation_pb2_grpc.add_RecommendationEngineServicer_to_server(
        RecommendationEngine(), server
    )
    address = os.getenv("GRPC_BIND", "0.0.0.0:50051")
    if server.add_insecure_port(address) == 0:
        raise RuntimeError(f"Could not bind gRPC server to {address}")
    server.start()
    print(f"Recommendation gRPC server listening on {address}", flush=True)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
