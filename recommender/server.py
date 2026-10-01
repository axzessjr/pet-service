"""gRPC entry point for the recommendation engine."""

import os
from concurrent import futures

import grpc

import recommendation_pb2
import recommendation_pb2_grpc
from engine import Pet, Service, recommend
from store import RecommendationStore


class RecommendationEngine(recommendation_pb2_grpc.RecommendationEngineServicer):
    def __init__(self, store: RecommendationStore):
        self.store = store

    @staticmethod
    def _rank(request):
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
        return recommend(pet, services, request.limit)

    @staticmethod
    def _match_data(matches):
        return [
            {
                "service_id": match.service_id,
                "score": match.score,
                "matched_needs": list(match.matched_needs),
            }
            for match in matches
        ]

    @staticmethod
    def _validate_write(pet_id, input_request, context):
        if pet_id <= 0 or input_request.limit <= 0 or input_request.limit > 100:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                "pet_id and limit must be positive; limit must be at most 100",
            )
        if not input_request.HasField("pet") or not input_request.pet.species.strip():
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "pet species is required")

    def Recommend(self, request, context):
        matches = self._rank(request)
        return recommendation_pb2.RecommendationResponse(
            matches=[
                recommendation_pb2.Match(**match) for match in self._match_data(matches)
            ]
        )

    def CreateRecommendation(self, request, context):
        self._validate_write(request.pet_id, request.input, context)
        matches = self._match_data(self._rank(request.input))
        return recommendation_pb2.SavedRecommendation(
            **self.store.create(request.pet_id, request.input.limit, matches)
        )

    def GetRecommendation(self, request, context):
        record = self.store.get(request.id)
        if record is None:
            context.abort(grpc.StatusCode.NOT_FOUND, "Recommendation not found")
        return recommendation_pb2.SavedRecommendation(**record)

    def ListRecommendations(self, request, context):
        if request.pet_id <= 0:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "pet_id must be positive")
        return recommendation_pb2.ListRecommendationsResponse(
            recommendations=[
                recommendation_pb2.SavedRecommendation(**record)
                for record in self.store.list_for_pet(request.pet_id)
            ]
        )

    def UpdateRecommendation(self, request, context):
        self._validate_write(request.pet_id, request.input, context)
        existing = self.store.get(request.id)
        if existing is None or existing["pet_id"] != request.pet_id:
            context.abort(grpc.StatusCode.NOT_FOUND, "Recommendation not found")
        matches = self._match_data(self._rank(request.input))
        record = self.store.update(
            request.id, request.pet_id, request.input.limit, matches
        )
        if record is None:
            context.abort(grpc.StatusCode.NOT_FOUND, "Recommendation not found")
        return recommendation_pb2.SavedRecommendation(**record)

    def DeleteRecommendation(self, request, context):
        if not self.store.delete(request.id):
            context.abort(grpc.StatusCode.NOT_FOUND, "Recommendation not found")
        return recommendation_pb2.DeleteRecommendationResponse(deleted=True)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=8))
    store = RecommendationStore(
        os.getenv(
            "RECOMMENDATION_DB_PATH",
            os.path.join(os.path.dirname(__file__), "recommendations.sqlite3"),
        )
    )
    recommendation_pb2_grpc.add_RecommendationEngineServicer_to_server(
        RecommendationEngine(store), server
    )
    address = os.getenv("GRPC_BIND", "0.0.0.0:50051")
    if server.add_insecure_port(address) == 0:
        raise RuntimeError(f"Could not bind gRPC server to {address}")
    server.start()
    print(f"Recommendation gRPC server listening on {address}", flush=True)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
