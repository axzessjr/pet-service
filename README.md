# Pawpal

Pawpal is a pet service catalog with recommendations for a selected pet. The React frontend calls a NestJS HTTP API. NestJS sends the pet and current catalog over gRPC to a Python service, which ranks compatible services with content-based KNN.

## Run with Docker

From the repository root:

```bash
docker compose up --build
```

Open <http://localhost:5173> and choose **For my pet**. Compose starts the Python recommender, NestJS API, and nginx-hosted frontend. The API is also available at <http://localhost:3000>. Stop the stack with `docker compose down`.

## Run locally

Use Python 3.11+ and Node.js 24+. Start each process in its own terminal from the repository root.

```powershell
# Terminal 1: generate Python gRPC bindings and start the recommender
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r recommender\requirements.txt
.\.venv\Scripts\python.exe -m grpc_tools.protoc -Iproto --python_out=recommender --grpc_python_out=recommender proto\recommendation.proto
cd recommender
..\.venv\Scripts\python.exe server.py
```

```powershell
# Terminal 2: API
cd backend
npm ci
npm run start:dev
```

```powershell
# Terminal 3: frontend
cd frontend
npm ci
npm run dev
```

The Vite development server proxies `/api` to `http://localhost:3000`. Override that target with `BACKEND_URL` if needed. The backend calls `localhost:50051` by default; override it with `RECOMMENDATION_GRPC_URL`.

## Recommendations

Open **For my pet** at <http://localhost:5173/recommendations> and select a pet. The ranking steps and an example are in the [recommender note](recommender/README.md).

## API and mock data

- `GET /catalog` lists 18 mock services with species, category, care tags, and price.
- `GET /pet-profile/me` lists four mock pets. Each pet has care needs and a maximum service price.
- `GET /recommendation/pets/:petId` returns up to five services with matching need tags.
- A pet without care needs receives the cheapest compatible services as a fallback.

The catalog and pets are in memory. No bookings, reviews, authentication, or persistent database are implemented yet. NestJS sends current catalog candidates in each gRPC request, so the Python service does not need a separate copy of catalog data.

## Verify

```powershell
cd backend
npm test -- --runInBand
npm run build
```

```powershell
cd frontend
npm run build
```

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s recommender
docker compose config
```

Python gRPC bindings are generated during the Docker build or by the local command above.
