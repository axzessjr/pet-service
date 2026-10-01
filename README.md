# Pawpal

Pawpal is a pet service catalog with recommendations for a selected pet. The React frontend calls a NestJS HTTP API. NestJS sends the pet and current catalog over gRPC to a Python service, which ranks compatible services by tag similarity. The Python service can also save, read, recalculate, and delete recommendation sets.

## Run with Docker

From the repository root, copy the example configuration and set `DATABASE_URL` in `backend/.env` to your PostgreSQL/Supabase connection string:

```powershell
Copy-Item backend/.env.example backend/.env
```

Then start the stack:

```bash
docker compose up --build
```

Compose passes `backend/.env` into the backend container; the same file is read when running NestJS locally from `backend`. It is ignored by Git. The backend needs this database for login and pet data. The recommender saves sets separately in SQLite on the `recommendation_data` Docker volume.

If PostgreSQL runs on your computer, use `host.docker.internal` as the hostname in `DATABASE_URL` for Docker Desktop and set `DATABASE_SSL=false` if that server does not support TLS. `localhost` inside the backend container refers to the container itself. The backend now stops with a clear error if the database URL is missing or the database cannot be reached.

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

The recommender saves local sets to `recommender/recommendations.sqlite3` by default. Set `RECOMMENDATION_DB_PATH` to use another location.

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

Open **For my pet** at <http://localhost:5173/recommendations> and select a pet. NestJS loads that pet and the catalog, sends both to the Python service over gRPC, then adds catalog details to the ranked matches it receives.

**What it uses to find services:**

1. **Species filters:** A service must list the pet's species. A cat-only service will not appear for a dog.
2. **Price filters:** A service must cost no more than the pet's `maxPrice`. A `maxPrice` of `0` means there is no price ceiling.
3. **Needs and tags rank:** The pet's `needs` are compared with each service's `tags`. More closely matching tags produce a higher similarity score. A service with no matching need is left out.
4. **Price breaks score ties:** If two services have the same score, the cheaper one comes first. If the pet has no needs, compatible services are ordered by lowest price instead.

For example, a pet need of `exercise` matches a service tag of `exercise`; it does not match `gentle-exercise`. Names, descriptions, providers, and categories are not searched by the recommender.

### Worked example

Suppose a dog needs `exercise` and `social` care and has a $45 budget. After filtering by species and price, consider these two catalog services. Using the tag order `[exercise, social, outdoors]`, each `1` means the tag is present and each `0` means it is absent:

| Pet or service | Needs or tags | Vector | Score |
| --- | --- | --- | ---: |
| Pet | `exercise`, `social` | `[1, 1, 0]` | Search input |
| Neighborhood Dog Walk (`101`, $15) | `exercise`, `social` | `[1, 1, 0]` | `1.0` |
| Active Dog Adventure (`104`, $38) | `exercise`, `social`, `outdoors` | `[1, 1, 1]` | `0.8165` |

The code gives the two service vectors to scikit-learn's `NearestNeighbors`, then searches with the pet vector. With cosine distance, Dog Walk is an exact match (`distance = 0`, so `score = 1 - 0 = 1.0`). Adventure has one extra tag (`distance ≈ 0.1835`, so `score ≈ 0.8165`). Dog Walk ranks first. The code asks for every eligible service, then keeps the highest-scoring results; it does not learn from past bookings or ratings. See the [ranking details](recommender/README.md) for the full algorithm.

The existing `GET /recommendation/pets/:petId` calculates live recommendations without saving them. Saved sets use these endpoints:

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/recommendations` | Create a set from `{ "petId": 1, "limit": 5 }`; `limit` defaults to 5. |
| `GET` | `/recommendations/:id` | Read one saved set. |
| `GET` | `/recommendations?petId=1` | List sets for a pet. |
| `PUT` | `/recommendations/:id` | Recalculate a set from the current pet and catalog with `{ "limit": 5 }`. |
| `DELETE` | `/recommendations/:id` | Delete a set; returns HTTP 204. |

The saved response contains `id`, `petId`, `limit`, `matches` (service IDs, scores, matched needs), `createdAt`, and `updatedAt`. A saved set is a snapshot. Reading it does not recalculate it; `PUT` does. Missing sets return HTTP 404. The API currently does not enforce user ownership, so these routes should be protected before exposing them to untrusted clients.

## API and data

- `GET /catalog` lists 18 mock services with species, category, care tags, and price.
- `GET /pet-profile/me` reads pets from the configured PostgreSQL database. Each pet has care needs and a maximum service price.
- `GET /recommendation/pets/:petId` returns up to five services with matching need tags.
- A pet without care needs receives the cheapest compatible services as a fallback.

The catalog is in memory; pets are read from PostgreSQL. NestJS sends current catalog candidates in each recommendation request, so the Python service does not need a separate copy of catalog data. Saved recommendation sets are persisted in SQLite.

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
With the recommender running locally, run `node test/grpc-contract-smoke.js` from `backend` to check the NestJS-to-Python CRUD contract.
