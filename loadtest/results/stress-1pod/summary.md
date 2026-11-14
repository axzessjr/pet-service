# Load test run: stress-1pod

- Started 2026-11-14 00:21:50, ran 254 s, up to 400 VUs
- 12,001 journey requests (setup warm-up excluded), 47.3 req/s on average, 0.17% failed
- Status codes: 200: 11,581, 201: 400, 502: 20
- NFR 2, map p95 < 2000 ms: **FAIL** (7,681 ms)
- Errors < 1%: **PASS** (0.17%)

## Per route

| Route | Requests | req/s | avg | median | p95 | p99 | max | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| login | 400 | 1.6 | 3,815 ms | 3,659 ms | 7,391 ms | 7,589 ms | 7,718 ms | 0.00% |
| catalog | 3,997 | 15.8 | 3,103 ms | 2,034 ms | 7,440 ms | 16,054 ms | 28,199 ms | 0.20% |
| pet_profile | 3,862 | 15.2 | 3,053 ms | 1,835 ms | 7,464 ms | 16,205 ms | 18,771 ms | 0.18% |
| map | 3,742 | 14.7 | 3,241 ms | 1,965 ms | 7,681 ms | 16,630 ms | 19,018 ms | 0.13% |

## Every 30 s (t = first journey request)

| Window | VUs | req/s | p95 all | p95 map | Errors | Gateway pods Ready | Gateway CPU (m) | HPA CPU % | Recommender CPU (m) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0-30s | 50 | 37.0 | 728 | 829 | 0 (0.0%) | 1 | 167 | 1 | 71 |
| 30-60s | 50 | 50.8 | 871 | 937 | 0 (0.0%) | 1 | 184 | 184 | 104 |
| 60-90s | 100 | 50.0 | 1,618 | 1,726 | 0 (0.0%) | 1 | 193 | 184 | 101 |
| 90-120s | 100 | 50.7 | 1,861 | 1,932 | 0 (0.0%) | 1 | 187 | 187 | 96 |
| 120-150s | 200 | 50.1 | 3,454 | 3,580 | 0 (0.0%) | 1 | 255 | 187 | 96 |
| 150-180s | 201 | 51.2 | 3,833 | 3,893 | 0 (0.0%) | 1 | 257 | 257 | 94 |
| 180-210s | 400 | 48.0 | 7,099 | 7,226 | 0 (0.0%) | 1 | 381 | 257 | 97 |
| 210-240s | 400 | 46.2 | 17,043 | 17,511 | 17 (1.23%) | 1 | 389 | 389 | 81 |
| 240-254s | 400 | 35.0 | 7,839 | 7,857 | 3 (0.62%) | 1 | 109 | 389 | 87 |

## Autoscaling timeline

- t+50s: gateway CPU first at or above 70% of request (184%), ~50 VUs
- t+222s: gateway pods Ready 1 -> 0 (~400 VUs)
- t+233s: gateway pods Ready 0 -> 1 (~400 VUs)

HPA CPU % is the gateway's average CPU against its 100m request; the HPA adds pods above 70%.
kubectl top refreshes about every 15 s, so CPU and pod counts are approximate per window.
