"""Content-based nearest-neighbor ranking for pet services."""

from dataclasses import dataclass

from sklearn.neighbors import NearestNeighbors


@dataclass(frozen=True)
class Pet:
    species: str
    needs: tuple[str, ...]
    max_price: float


@dataclass(frozen=True)
class Service:
    id: int
    species: tuple[str, ...]
    tags: tuple[str, ...]
    price: float


@dataclass(frozen=True)
class Match:
    service_id: int
    score: float
    matched_needs: tuple[str, ...]


def recommend(pet: Pet, services: list[Service], limit: int) -> list[Match]:
    if limit <= 0:
        return []

    species = pet.species.strip().casefold()
    eligible = [
        service
        for service in services
        if species in (value.casefold() for value in service.species)
        and (pet.max_price <= 0 or service.price <= pet.max_price)
    ]
    if not eligible:
        return []

    needs = tuple(dict.fromkeys(need.strip().casefold() for need in pet.needs if need.strip()))
    if not needs:
        return [
            Match(service.id, 0.0, ())
            for service in sorted(eligible, key=lambda item: (item.price, item.id))[:limit]
        ]

    service_tags = [set(tag.casefold() for tag in service.tags) for service in eligible]
    vocabulary = sorted(set(needs).union(*(tags for tags in service_tags)))
    vectors = [[int(tag in tags) for tag in vocabulary] for tags in service_tags]
    query = [[int(tag in needs) for tag in vocabulary]]

    neighbors = NearestNeighbors(n_neighbors=len(eligible), metric="cosine", algorithm="brute")
    neighbors.fit(vectors)
    distances, indices = neighbors.kneighbors(query)

    ranked = []
    for distance, index in zip(distances[0], indices[0]):
        service = eligible[index]
        matched = tuple(need for need in needs if need in service_tags[index])
        if matched:
            ranked.append((float(distance), service.price, service.id, matched))

    ranked.sort(key=lambda row: (row[0], row[1], row[2]))
    return [
        Match(service_id, round(max(0.0, 1.0 - distance), 4), matched)
        for distance, _, service_id, matched in ranked[:limit]
    ]
