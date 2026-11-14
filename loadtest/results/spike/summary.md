# Load test run: spike

- Started 2026-11-14 00:26:41, ran 171 s, up to 300 VUs
- 8,561 journey requests (setup warm-up excluded), 49.9 req/s on average, 12.64% failed
- Status codes: 200: 7,179, 201: 300, 503: 1,082
- NFR 2, map p95 < 2000 ms: **FAIL** (7,117 ms)
- Errors < 1%: **FAIL** (12.64%)

## Per route

| Route | Requests | req/s | avg | median | p95 | p99 | max | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| login | 300 | 1.8 | 3,598 ms | 3,650 ms | 6,775 ms | 7,089 ms | 7,196 ms | 0.00% |
| catalog | 2,756 | 16.1 | 1,899 ms | 662 ms | 5,883 ms | 6,822 ms | 7,094 ms | 0.00% |
| pet_profile | 2,756 | 16.1 | 1,735 ms | 559 ms | 5,541 ms | 6,701 ms | 7,095 ms | 0.00% |
| map | 2,749 | 16.0 | 3,169 ms | 3,433 ms | 7,117 ms | 8,070 ms | 8,477 ms | 39.36% |

## Every 30 s (t = first journey request)

| Window | VUs | req/s | p95 all | p95 map | Errors | Gateway pods Ready | Gateway CPU (m) | HPA CPU % | Recommender CPU (m) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0-30s | 80 | 11.6 | 1,290 | 1,290 | 0 (0.0%) | 1 | 49 | 1 | 46 |
| 30-60s | 300 | 46.5 | 6,927 | 7,106 | 0 (0.0%) | 1 | 896 | 896 | 83 |
| 60-90s | 300 | 114.9 | 6,482 | 7,692 | 469 (13.6%) | 3 | 454 | 896 | 202 |
| 90-120s | 300 | 84.9 | 4,422 | 4,732 | 613 (24.06%) | 3 | 454 | 896 | 213 |
| 120-150s | 10 | 16.5 | 539 | 573 | 0 (0.0%) | 3 | 119 | 144 | 105 |
| 150-171s | 10 | 15.3 | 521 | 565 | 0 (0.0%) | 3 | 53 | 144 | 56 |

## Autoscaling timeline

- t+59s: gateway CPU first at or above 70% of request (896%), ~300 VUs
- t+59s: HPA wants 1 -> 3 (~300 VUs)
- t+69s: gateway pods Ready 1 -> 3 (~300 VUs)

HPA CPU % is the gateway's average CPU against its 100m request; the HPA adds pods above 70%.
kubectl top refreshes about every 15 s, so CPU and pod counts are approximate per window.
