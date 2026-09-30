FROM python:3.11-slim

WORKDIR /app
COPY recommender/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY proto/recommendation.proto ./
COPY recommender/*.py ./
RUN python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. recommendation.proto

EXPOSE 50051
CMD ["python", "server.py"]
