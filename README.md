# Pawpal

Pawpal is a pet service catalog with recommendations for a selected pet. The React frontend calls a NestJS HTTP API, which acts as the API gateway. NestJS sends the pet and current catalog over gRPC to a Python service, which ranks compatible services by tag similarity. The Python service can also save, read, recalculate, and delete recommendation sets.

After using a service, pet owners can review it with a rating, text, and photos. Reviews are kept by the review service, a separate NestJS service that stores them in MongoDB Atlas. Each review change is published to RabbitMQ, and the recommender uses the resulting average ratings to break ranking ties.

## Run with Docker

From the repository root:

```bash
export DATABASE_URL='your PostgreSQL connection string'
docker compose up --build
```

In PowerShell, set `$env:DATABASE_URL` instead of using `export`. The backend needs this connection to read the existing `pets` table. The recommender saves sets in SQLite on the `recommendation_data` Docker volume.

Before the first run, copy `review/.env.example` to `review/.env` and set `MONGODB_URL` to your MongoDB Atlas connection string. To get it, open your Atlas cluster and choose **Connect > Drivers**. The Atlas database user needs read and write access to the `reviews` database. Atlas **Network Access** must allow the public IP address of each machine that runs the stack. Git ignores `review/.env`, and the Docker build leaves it out of every image.

To work offline, use the bundled MongoDB instead. Set `MONGODB_URL=mongodb://review:review@review-db:27017/?authSource=admin` in `review/.env` and start the stack with `docker compose --profile local-db up --build`.

Open <http://localhost:5173> and choose **For my pet**. Compose starts RabbitMQ, the Python recommender, the review service (connected to MongoDB Atlas), the NestJS API, and the nginx-hosted frontend. The API is also available at <http://localhost:3000>. The RabbitMQ management UI is at <http://localhost:15672> (user `pawpal`, password `pawpal`). Stop the stack with `docker compose down`.

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

To run the review service outside Docker, add `RABBITMQ_URL` for a broker to `review/.env`, next to `MONGODB_URL`, then run `npm ci` and `npm run start:dev` in `review`. The service reads `review/.env` on startup. `MONGODB_DB` sets the database name (default `reviews`). It listens on port 3001, which the backend calls by default; override that with `REVIEW_URL`. Set `RABBITMQ_URL` for the recommender too if it should receive rating updates.

## Recommendations

Open **For my pet** at <http://localhost:5173/recommendations>. The page is a map of the services that fit your pet (see [Map](#map)); if you have more than one pet, choose one at the top. For the area on screen, NestJS loads the pet and the catalog services there, sends them to the Python service over gRPC, then adds catalog details to the ranked matches it receives.

Choose **Saved lists** to open the selected pet's saved sets. **Save snapshot** saves the pet's top 10 matches, ranked across the whole catalog rather than only the area on the map. Open a set to see its ranked services, choose **Update with latest** to recalculate it from the current pet and catalog data, or choose **Delete** and confirm to remove it. Switching pets shows that pet's saved sets.

**What it uses to find services:**

1. **Species filters:** A service must list the pet's species. A cat-only service will not appear for a dog.
2. **Price filters:** A service must cost no more than the pet's `maxPrice`. A `maxPrice` of `0` means there is no price ceiling.
3. **Needs and tags rank:** The pet's `needs` are compared with each service's `tags`. More closely matching tags produce a higher similarity score. A service with no matching need is left out.
4. **Rating, then price, breaks score ties:** If two services have the same score, the one with the higher average review rating comes first; if that is also equal, the cheaper one comes first. A service with no reviews counts as 3 stars. If the pet has no needs, compatible services are ordered by rating, then price.

For example, a pet need of `exercise` matches a service tag of `exercise`; it does not match `gentle-exercise`. Names, descriptions, providers, and categories are not searched by the recommender.

### Worked example

Suppose a dog needs `exercise` and `social` care and has a ฿1,600 budget. After filtering by species and price, consider these two catalog services. Using the tag order `[exercise, social, outdoors]`, each `1` means the tag is present and each `0` means it is absent:

| Pet or service | Needs or tags | Vector | Score |
| --- | --- | --- | ---: |
| Pet | `exercise`, `social` | `[1, 1, 0]` | Search input |
| Neighborhood Dog Walk (`101`, ฿550) | `exercise`, `social` | `[1, 1, 0]` | `1.0` |
| Active Dog Adventure (`104`, ฿1,350) | `exercise`, `social`, `outdoors` | `[1, 1, 1]` | `0.8165` |

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

### Map

**For my pet** shows recommendations on an OpenStreetMap map (Leaflet), centred on Chulalongkorn University. Panning or zooming fetches recommendations for the visible area once the map has been still for 400 ms. The search box, the category chips, and the maximum price and rating filters (under **Filters**) narrow the same results. The chips only offer categories that have a service for the pet's species, and they double as the legend for the pin colours.

The map is held to the area with services: every service and Chula, plus about 1 km. It can't be dragged off that area or zoomed out past the point where all of it is in view, and a link to a place outside it opens on the services instead. The area comes from the catalog's locations, so it grows with the catalog.

On wide screens the results are listed to the right of the map; on phones they are in a sheet over its lower edge, which shows the best match until you choose **See all**. The list always shows exactly the pins. Choose a row or a pin to open that service's details, with previous and next buttons to step through the results; choose **All results**, press Escape, or select an empty part of the map to go back. The map position and filters are kept in the URL.

The map calls:

```
GET /recommendation/pets/:petId/map?minLat=13.72&minLng=100.51&maxLat=13.75&maxLng=100.55&zoom=15
    [&q=groom&category=Grooming&maxPrice=40&minRating=4&limit=20&includeUnmatched=true]
```

1. Only catalog services inside the bounds that pass `q`, `category`, and `maxPrice` are sent to the recommender. `maxPrice` can lower the pet's budget but never raise it.
2. Ratings come back from the recommender, so `minRating` is applied to the ranked results. Services with no reviews count as rating 0 here.
3. At zoom 15 and closer (`MAP_LIMITS.DETAIL_ZOOM` in `backend/src/recommendation/map.ts`), every ranked service in view is returned, up to 50. Further out, only the top 10 are, and `mode` is `"top"` instead of `"detail"`. `total` is the count before that cut.
4. `includeUnmatched=true` also returns in-view services of the right species and price that cover none of the pet's needs, last, with `score: 0` and `matched: false`. The map shows them as grey pins. The backend gets them, with their ratings, from a second `Recommend` call without needs, so the gRPC contract is unchanged.

Bounds must be numbers with min below max and may span at most 2 degrees; `zoom` must be a whole number from 0 to 22. Invalid queries return HTTP 400, an unknown pet 404, and a recommender failure 503.

## Reviews

Pawpal does not take bookings. Owners find a service in the catalog or in their recommendations, use it with the provider directly, then come back to review it. Each review is for one visit, so an owner can review the same service again after each visit, and edit or delete any of their reviews later.

A review has a 1-5 `rating` and can also have:

- ratings for `quality`, `value`, `punctuality`, and `friendliness`
- a `title` and a `comment`
- `visitedOn`, the date of the visit (YYYY-MM-DD, within the last two years)
- up to 8 `tags`
- `wouldRecommend` (true or false)
- the pet that used the service
- up to 4 photos

In the frontend, choose **Write a review** at the top of the **Catalog**. Choose the service you used, and then the pet that went. Only pets whose species the service supports are listed. The visit date starts as today. **My reviews** lists your reviews, where you can edit or delete them. **For my pet** only shows the recommended services and their ratings.

Select a service's rating to:

- read its reviews and see the photos
- read the average for each part of the visit
- see what share of owners would recommend it

Reviews live in MongoDB in the review service, a separate NestJS service.

| Method | Path | Action |
| --- | --- | --- |
| `POST` | `/reviews` | Create a review, for example `{ "serviceId": 106, "ownerId": 1, "petId": 6, "rating": 5, "aspects": { "quality": 5 }, "title": "...", "comment": "...", "visitedOn": "2026-10-12", "tags": ["gentle"], "wouldRecommend": true, "photos": ["data:image/jpeg;base64,..."] }`. Only `serviceId`, `ownerId`, and `rating` are required. The gateway checks that the service exists and, if `petId` is sent, that the pet belongs to the owner and the service supports its species. It then stores the service and pet names with the review. |
| `GET` | `/reviews?serviceId=106` or `/reviews?ownerId=1` | List reviews for a service or by an owner, newest first. |
| `GET` | `/reviews/:id` | Read one review. |
| `PATCH` | `/reviews/:id` | Change any review field. Include `ownerId`. Use `addPhotos` and `removePhotoIds` for photos. `null` clears `aspects`, `visitedOn`, or `wouldRecommend`. |
| `DELETE` | `/reviews/:id?ownerId=1` | Delete a review and its photos; returns HTTP 204. |
| `GET` | `/reviews/photos/:photoId` | Read a review photo (JPEG). |
| `GET` | `/ratings` | Get, for every reviewed service: the average rating, the review count, the average for each part of the visit, the percentage of owners who would recommend it, and the photo count. |

Review IDs and photo IDs are 24-character MongoDB ObjectIds.

An edit that arrives while another edit of the same review is in progress returns HTTP 409. Another owner's review returns HTTP 404. Like the pet and saved-set routes, these routes trust the `ownerId` in the request, so add authentication before exposing them to untrusted clients.

### Photos

The browser shrinks each photo to at most 1280 pixels on its longest side before uploading it as base64 JSON. The review service then:

- accepts JPEG, PNG, WebP, HEIF, or AVIF up to 5 MB each
- rotates the photo upright
- resizes it to at most 1280 pixels
- saves it as JPEG in MongoDB GridFS (`review_photos`)

Re-encoding removes EXIF data such as GPS location. A request can be up to 12 MB. nginx, the gateway, and the review service all allow that size.

### MongoDB data

The database is MongoDB Atlas, set by `MONGODB_URL`. Atlas's free M0 tier (512 MB) holds roughly a couple of thousand resized photos.

Each review is one document in the `reviews` collection, with the service and pet names copied in. Deleting a review keeps the document, marks it `deleted`, and removes its photos. Every visit counts in the averages, including repeat visits by the same owner. The `/ratings` totals are computed from the reviews with an aggregation each time they are requested.

### How review events reach the recommender

1. When the review service saves a change, it also marks the review with the event to send (`review.created`, `review.updated`, or `review.deleted`). Both are written in one MongoDB update, so the event cannot be lost without the change.
2. A publisher in the same service checks for marked reviews every second. A lease in the `locks` collection lets only one publisher run at a time. The publisher works out the service's new average and review count from its reviews and takes the next version number from `service_versions`. It publishes to the `pawpal.events` topic exchange, waits for RabbitMQ to confirm, and clears the mark.
3. The recommender consumes `review.*` from the `recommendation.review-events` queue and stores each service's `averageRating` and `reviewCount`. Every event has an increasing `version`, so duplicates and late events are ignored.

A version is never lower than the current time in milliseconds. Versions therefore keep increasing even after the review database is replaced, for example when moving from the local MongoDB to Atlas.

If RabbitMQ is down, reviews are still saved and stay marked until it returns. Meanwhile, recommendations keep using the last known ratings.

## API and data

- `GET /catalog` lists 60 mock services with species, category, care tags, price, and a location near Chulalongkorn University. Add `?q=groom` (title, provider, description, category, tags, district, or address) and `?category=Grooming` to search it.
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
cd review
npm test
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
