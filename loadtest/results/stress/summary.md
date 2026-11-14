# Load test run: stress

- Started 2026-11-14 00:16:48, ran 252 s, up to 400 VUs
- 27,348 journey requests (setup warm-up excluded), 108.7 req/s on average, 15.24% failed
- Status codes: 200: 22,780, 201: 400, 503: 4,168
- NFR 2, map p95 < 2000 ms: **FAIL** (4,273 ms)
- Errors < 1%: **FAIL** (15.24%)

## Per route

| Route | Requests | req/s | avg | median | p95 | p99 | max | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| login | 400 | 1.6 | 653 ms | 353 ms | 1,910 ms | 2,062 ms | 2,248 ms | 0.00% |
| catalog | 8,994 | 35.7 | 631 ms | 302 ms | 2,051 ms | 3,073 ms | 3,398 ms | 0.00% |
| pet_profile | 8,993 | 35.7 | 632 ms | 297 ms | 2,071 ms | 3,088 ms | 3,268 ms | 0.00% |
| map | 8,961 | 35.6 | 2,388 ms | 3,016 ms | 4,273 ms | 4,530 ms | 4,755 ms | 46.51% |

## Every 30 s (t = first journey request)

| Window | VUs | req/s | p95 all | p95 map | Errors | Gateway pods Ready | Gateway CPU (m) | HPA CPU % | Recommender CPU (m) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0-30s | 49 | 38.7 | 686 | 774 | 0 (0.0%) | 1 | 182 | 1 | 81 |
| 30-60s | 50 | 53.4 | 817 | 862 | 0 (0.0%) | 1 | 183 | 183 | 102 |
| 60-90s | 99 | 91.8 | 2,002 | 2,302 | 0 (0.0%) | 3 | 443 | 183 | 219 |
| 90-120s | 100 | 88.5 | 3,067 | 3,167 | 66 (2.49%) | 3 | 341 | 183 | 155 |
| 120-150s | 199 | 128.4 | 3,235 | 3,364 | 663 (17.22%) | 3 | 486 | 113 | 185 |
| 150-180s | 200 | 154.2 | 3,349 | 3,439 | 1030 (22.27%) | 3 | 502 | 167 | 207 |
| 180-210s | 399 | 157.4 | 4,132 | 4,444 | 985 (20.86%) | 3 | 701 | 167 | 202 |
| 210-240s | 400 | 159.8 | 4,276 | 4,494 | 1067 (22.25%) | 3 | 701 | 211 | 206 |
| 240-252s | 397 | 101.4 | 4,191 | 4,236 | 357 (30.15%) | 3 | 402 | 211 | 199 |

## Autoscaling timeline

- t+51s: gateway CPU first at or above 70% of request (183%), ~50 VUs
- t+51s: HPA wants 1 -> 3 (~50 VUs)
- t+62s: gateway pods Ready 1 -> 3 (~54 VUs)

HPA CPU % is the gateway's average CPU against its 100m request; the HPA adds pods above 70%.
kubectl top refreshes about every 15 s, so CPU and pod counts are approximate per window.
