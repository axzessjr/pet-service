"""Exercise the public gRPC contract and persisted lifecycle."""

import importlib
import sys
import tempfile
import unittest
from concurrent import futures
from pathlib import Path

import grpc
from grpc_tools import protoc


class RecommendationGrpcTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bindings_dir = tempfile.TemporaryDirectory()
        root = Path(__file__).resolve().parent.parent
        result = protoc.main(
            [
                "grpc_tools.protoc",
                f"-I{root / 'proto'}",
                f"--python_out={cls.bindings_dir.name}",
                f"--grpc_python_out={cls.bindings_dir.name}",
                str(root / "proto" / "recommendation.proto"),
            ]
        )
        if result != 0:
            raise RuntimeError("Could not compile recommendation.proto")
        sys.path.insert(0, cls.bindings_dir.name)
        cls.pb = importlib.import_module("recommendation_pb2")
        cls.pb_grpc = importlib.import_module("recommendation_pb2_grpc")
        cls.server_module = importlib.import_module("server")
        cls.store_module = importlib.import_module("store")

    @classmethod
    def tearDownClass(cls):
        sys.path.remove(cls.bindings_dir.name)
        cls.bindings_dir.cleanup()

    def setUp(self):
        self.data_dir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.data_dir.name) / "recommendations.sqlite3")
        self.grpc_server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
        self.pb_grpc.add_RecommendationEngineServicer_to_server(
            self.server_module.RecommendationEngine(
                self.store_module.RecommendationStore(self.db_path)
            ),
            self.grpc_server,
        )
        port = self.grpc_server.add_insecure_port("127.0.0.1:0")
        self.grpc_server.start()
        self.channel = grpc.insecure_channel(f"127.0.0.1:{port}")
        self.stub = self.pb_grpc.RecommendationEngineStub(self.channel)

    def tearDown(self):
        self.channel.close()
        self.grpc_server.stop(0).wait()
        self.data_dir.cleanup()

    def test_crud_and_live_recommendation(self):
        input_request = self.pb.RecommendationRequest(
            pet=self.pb.Pet(species="cat", needs=["play"], max_price=30),
            services=[
                self.pb.CatalogItem(id=101, species=["cat"], tags=["play"], price=20),
                self.pb.CatalogItem(id=102, species=["dog"], tags=["play"], price=10),
            ],
            limit=5,
        )
        live = self.stub.Recommend(input_request)
        self.assertEqual([match.service_id for match in live.matches], [101])

        created = self.stub.CreateRecommendation(
            self.pb.CreateRecommendationRequest(pet_id=7, input=input_request)
        )
        self.assertTrue(created.id)
        self.assertEqual([match.service_id for match in created.matches], [101])
        self.assertEqual(created.pet_id, 7)
        self.assertEqual(
            self.stub.GetRecommendation(
                self.pb.GetRecommendationRequest(id=created.id)
            ),
            created,
        )
        listed = self.stub.ListRecommendations(
            self.pb.ListRecommendationsRequest(pet_id=7)
        )
        self.assertEqual([record.id for record in listed.recommendations], [created.id])

        input_request.limit = 1
        input_request.services[0].tags[:] = ["other"]
        updated = self.stub.UpdateRecommendation(
            self.pb.UpdateRecommendationRequest(
                id=created.id, pet_id=7, input=input_request
            )
        )
        self.assertEqual(updated.id, created.id)
        self.assertEqual(updated.limit, 1)
        self.assertEqual(len(updated.matches), 0)
        self.assertEqual(updated.created_at, created.created_at)
        self.assertEqual(
            self.store_module.RecommendationStore(self.db_path).get(created.id)["limit"],
            1,
        )

        deleted = self.stub.DeleteRecommendation(
            self.pb.DeleteRecommendationRequest(id=created.id)
        )
        self.assertTrue(deleted.deleted)
        with self.assertRaises(grpc.RpcError) as missing:
            self.stub.GetRecommendation(self.pb.GetRecommendationRequest(id=created.id))
        self.assertEqual(missing.exception.code(), grpc.StatusCode.NOT_FOUND)

    def test_invalid_create_is_rejected(self):
        with self.assertRaises(grpc.RpcError) as invalid:
            self.stub.CreateRecommendation(
                self.pb.CreateRecommendationRequest(pet_id=7)
            )
        self.assertEqual(invalid.exception.code(), grpc.StatusCode.INVALID_ARGUMENT)


if __name__ == "__main__":
    unittest.main()
