"""Check whether the local gRPC server is accepting connections."""

import grpc


with grpc.insecure_channel("localhost:50051") as channel:
    grpc.channel_ready_future(channel).result(timeout=2)
