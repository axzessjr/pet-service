# Load test run: load

- Started 2026-11-14 00:06:45, ran 159 s, up to 50 VUs
- 10,607 journey requests (setup warm-up excluded), 66.5 req/s on average, 0.00% failed
- Status codes: 200: 10,557, 201: 50
- NFR 2, map p95 < 2000 ms: **PASS** (822 ms)
- Errors < 1%: **PASS** (0.00%)

## Per route

| Route | Requests | req/s | avg | median | p95 | p99 | max | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| login | 50 | 0.3 | 306 ms | 227 ms | 592 ms | 865 ms | 1,059 ms | 0.00% |
| catalog | 3,519 | 22.1 | 245 ms | 149 ms | 541 ms | 599 ms | 1,150 ms | 0.00% |
| pet_profile | 3,519 | 22.1 | 237 ms | 163 ms | 560 ms | 598 ms | 1,239 ms | 0.00% |
| map | 3,519 | 22.1 | 511 ms | 467 ms | 822 ms | 1,102 ms | 1,734 ms | 0.00% |

## Every 30 s (t = first journey request)

| Window | VUs | req/s | p95 all | p95 map | Errors | Gateway pods Ready | Gateway CPU (m) | HPA CPU % | Recommender CPU (m) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0-30s | 49 | 38.9 | 679 | 748 | 0 (0.0%) | 1 | 223 | 19 | 91 |
| 30-60s | 50 | 54.0 | 808 | 844 | 0 (0.0%) | 1 | 223 | 187 | 111 |
| 60-90s | 50 | 78.0 | 701 | 817 | 0 (0.0%) | 3 | 302 | 187 | 170 |
| 90-120s | 50 | 83.0 | 698 | 896 | 0 (0.0%) | 3 | 302 | 187 | 170 |
| 120-150s | 50 | 85.8 | 599 | 706 | 0 (0.0%) | 3 | 235 | 88 | 164 |
| 150-159s | 48 | 44.0 | 465 | 542 | 0 (0.0%) | 3 | 235 | 88 | 164 |

## Autoscaling timeline

- t+52s: gateway CPU first at or above 70% of request (187%), ~50 VUs
- t+52s: HPA wants 1 -> 3 (~50 VUs)
- t+69s: gateway pods Ready 1 -> 3 (~50 VUs)
- t+231s: HPA wants 3 -> 1 (~3 VUs)
- t+231s: gateway pods Ready 3 -> 1 (~3 VUs)

HPA CPU % is the gateway's average CPU against its 100m request; the HPA adds pods above 70%.
kubectl top refreshes about every 15 s, so CPU and pod counts are approximate per window.
