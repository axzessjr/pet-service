# Pawpal

Pawpal is a pet service catalog with recommendations for a selected pet. The React frontend calls a NestJS HTTP API, which acts as the API gateway. NestJS sends the pet and current catalog over gRPC to a Python service, which ranks compatible services by tag similarity. The Python service can also save, read, recalculate, and delete recommendation sets.

Pet owners can book services and review them through the usage and review service, a separate NestJS service with its own PostgreSQL database. Each review change is published to RabbitMQ, and the recommender uses the resulting average ratings to break ranking ties.

## Run with Docker

From the repository root:

```bash
export DATABASE_URL='your PostgreSQL connection string'
docker compose up --build
```

In PowerShell, set `$env:DATABASE_URL` instead of using `export`. The backend needs this connection to read the existing `pets` table. The recommender saves sets in SQLite on the `recommendation_data` Docker volume.

Open <http://localhost:5173> and choose **For my pet**. Compose starts RabbitMQ, the Python recommender, the usage and review service with its PostgreSQL database, the NestJS API, and the nginx-hosted frontend. The API is also available at <http://localhost:3000>. The RabbitMQ management UI is at <http://localhost:15672> (user `pawpal`, password `pawpal`). Stop the stack with `docker compose down`.

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
$env:DATABASE_URL = 'your PostgreSQL connection string'
npm run start:dev
```

```powershell
# Terminal 3: frontend
cd frontend
npm ci
npm run dev
```

The Vite development server proxies `/api` to `http://localhost:3000`. Override that target with `BACKEND_URL` if needed. The backend calls `localhost:50051` by default; override it with `RECOMMENDATION_GRPC_URL`.

The usage and review service needs PostgreSQL, so Docker Compose is the simplest way to run it. To run it outside Docker, set `DATABASE_URL` to a PostgreSQL database it can create tables in and `RABBITMQ_URL` to a broker, then run `npm ci` and `npm run start:dev` in `usage-review`. It listens on port 3001, which the backend calls by default; override that with `USAGE_REVIEW_URL`. Set `RABBITMQ_URL` for the recommender too if it should receive rating updates.

## Recommendations

Open **For my pet** at <http://localhost:5173/recommendations> and select a pet. NestJS loads that pet and the catalog, sends both to the Python service over gRPC, then adds catalog details to the ranked matches it receives.

On that page, use **Generate and save set** to create a snapshot for the selected pet. The **Saved recommendation sets** section lists that pet's sets. Select a set to see its ranked services, change the service limit and choose **Recalculate set** to update it using current pet and catalog data, or choose **Delete set** and confirm to remove it. Switching pets shows that pet's saved sets.

**What it uses to find services:**

1. **Species filters:** A service must list the pet's species. A cat-only service will not appear for a dog.
2. **Price filters:** A service must cost no more than the pet's `maxPrice`. A `maxPrice` of `0` means there is no price ceiling.
3. **Needs and tags rank:** The pet's `needs` are compared with each service's `tags`. More closely matching tags produce a higher similarity score. A service with no matching need is left out.
4. **Rating, then price, breaks score ties:** If two services have the same score, the one with the higher average review rating comes first; if that is also equal, the cheaper one comes first. A service with no reviews counts as 3 stars. If the pet has no needs, compatible services are ordered by rating, then price.

For example, a pet need of `exercise` matches a service tag of `exercise`; it does not match `gentle-exercise`. Names, descriptions, providers, and categories are not searched by the recommender.

### Worked example

Suppose a dog needs `exercise` and `social` care and has a $45 budget. After filtering by species and price, consider these two catalog services. Using the tag order `[exercise, social, outdoors]`, each `1` means the tag is present and each `0` means it is absent:

| Pet or service | Needs or tags | Vector | Score |
| --- | --- | --- | ---: |
| Pet | `exercise`, `social` | `[1, 1, 0]` | Search input |
| Neighborhood Dog Walk (`101`, $15) | `exercise`, `social` | `[1, 1, 0]` | `1.0` |
| Active Dog Adventure (`104`, $38) | `exercise`, `social`, `outdoors` | `[1, 1, 1]` | `0.8165` |

The code gives the two service vectors to scikit-learn's `NearestNeighbors`, then searches with the pet vector. With cosine distance, Dog Walk is an exact match (`distance = 0`, so `score = 1 - 0 = 1.0`). Adventure has one extra tag (`distance ≈ 0.1835`, so `score ≈ 0.8165`). Dog Walk ranks first. The code asks for every eligible service, then keeps the highest-scoring results. Review ratings only break ties, so they never lift a service above a closer tag match. See the [ranking details](recommender/README.md) for the full algorithm.

The existing `GET /recommendation/pets/:petId` calculates live recommendations without saving them. Saved sets use these endpoints:

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/recommendations` | Create a set from `{ "petId": 1, "limit": 5 }`; `limit` defaults to 5. |
| `GET` | `/recommendations/:id` | Read one saved set. |
| `GET` | `/recommendations?petId=1` | List sets for a pet. |
| `PUT` | `/recommendations/:id` | Recalculate a set from the current pet and catalog with `{ "limit": 5 }`. |
| `DELETE` | `/recommendations/:id` | Delete a set; returns HTTP 204. |

The saved response contains `id`, `petId`, `limit`, `matches` (service IDs, scores, matched needs), `createdAt`, and `updatedAt`. A saved set is a snapshot. Reading it does not recalculate it; `PUT` does. Missing sets return HTTP 404. The API currently does not enforce user ownership, so these routes should be protected before exposing them to untrusted clients.

## Usages and reviews

A usage is one booking of a catalog service for a pet. It starts as `booked` and can move once to `completed` or `cancelled`. A completed usage can receive one review with a 1-5 `rating` and an optional `comment`.

In the frontend, choose **Book** on a **Catalog** card or **Book for {pet}** on a **For my pet** result. The catalog only offers pets whose species the service supports. **My bookings** lists upcoming bookings, where you can mark one as completed or cancel it, and past ones, where you can write, edit, or delete a review. Catalog and recommendation cards show each service's average rating; select it to read the reviews.

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/usages` | Book a service from `{ "ownerId": 1, "petId": 6, "serviceId": 106 }`. The gateway checks that the pet belongs to the owner and that the service supports its species, then stores the service title, provider, and price with the usage. |
| `GET` | `/usages?ownerId=1` | List an owner's usages, newest first. |
| `GET` | `/usages/:id` | Read one usage. |
| `PATCH` | `/usages/:id` | Change a booked usage with `{ "ownerId": 1, "status": "completed" }` or `"cancelled"`. |
| `POST` | `/reviews` | Review a completed usage with `{ "usageId": 1, "ownerId": 1, "rating": 5, "comment": "..." }`. |
| `GET` | `/reviews?serviceId=106` or `/reviews?ownerId=1` | List reviews for a service or by an owner. |
| `GET` | `/reviews/:id` | Read one review. |
| `PATCH` | `/reviews/:id` | Change `rating` and/or `comment`; include `ownerId`. |
| `DELETE` | `/reviews/:id?ownerId=1` | Delete a review; returns HTTP 204. |
| `GET` | `/ratings` | Average rating and review count for every reviewed service. |

Reviewing a usage that is not completed, reviewing it twice, or changing a usage that is no longer `booked` returns HTTP 409. Another owner's usage or review returns HTTP 404. Like the pet and saved-set routes, these trust the `ownerId` in the request, so add authentication before exposing them to untrusted clients.

### How review events reach the recommender

1. The usage and review service saves the review, updates that service's running totals in `service_ratings`, and writes an event to an `outbox` table, all in one transaction.
2. A publisher in the same service reads unsent outbox rows every second, publishes them to the `pawpal.events` topic exchange with routing keys `review.created`, `review.updated`, or `review.deleted`, waits for RabbitMQ to confirm, and marks them sent.
3. The recommender consumes `review.*` from the `recommendation.review-events` queue and stores each service's `averageRating` and `reviewCount`. Every event has an increasing `version`, so duplicates and late events are ignored.

If RabbitMQ is down, reviews are still saved and their events wait in the outbox until it returns; recommendations keep using the last known ratings. The usage and review data lives in the `usage_review_data` volume. If you delete that volume, delete `recommendation_data` too, because new rating versions restart at 1 and the recommender would ignore them.

## API and data

- `GET /catalog` lists 18 mock services with species, category, care tags, and price.
- `GET /pet-profile/me` reads pets from the configured PostgreSQL database. Each pet has care needs and a maximum service price.
- `GET /recommendation/pets/:petId` returns up to five services with matching need tags.
- A pet without care needs receives the cheapest compatible services as a fallback.

Live and saved recommendation matches also include `averageRating` and `reviewCount`.

The catalog is in memory; pets are read from PostgreSQL. NestJS sends current catalog candidates in each recommendation request, so the Python service does not need a separate copy of catalog data. Saved recommendation sets are persisted in SQLite.

## Verify

```powershell
cd backend
npm test -- --runInBand
npm run build
```

```powershell
cd usage-review
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
