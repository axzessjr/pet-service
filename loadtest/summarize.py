"""Turns one load-test run into the tables the slides use.

From the repo root:
    python loadtest/summarize.py loadtest/results/stress
Reads summary.json, raw.csv.gz and k8s-samples.csv in that folder and writes
summary.md (tables) and windows.csv (one row per 30 s window, for charts) next to them.
"""
import bisect
import csv
import gzip
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime

WINDOW_S = 30
ROUTES = ["login", "catalog", "pet_profile", "map"]
NFR_P95_MS = 2000
HPA_TARGET_PCT = 70


def percentile(values, p):
    """Linear interpolation between closest ranks, as k6 does."""
    if not values:
        return None
    s = sorted(values)
    k = (len(s) - 1) * p / 100
    lo, hi = math.floor(k), math.ceil(k)
    return s[lo] if lo == hi else s[lo] + (s[hi] - s[lo]) * (k - lo)


def ms(value):
    return "-" if value is None else f"{value:,.0f} ms" if value >= 10 else f"{value:.1f} ms"


def read_raw(path):
    """Requests and VU samples from k6's CSV output, without the setup() warm-up."""
    reqs, durations, failed, vus = [], [], [], []
    with gzip.open(path, "rt", newline="") as handle:
        for row in csv.DictReader(handle):
            metric = row["metric_name"]
            ts = int(row["timestamp"])
            if metric == "vus":
                vus.append((ts, float(row["metric_value"])))
                continue
            name = row.get("name", "")
            if name not in ROUTES:
                continue
            if metric == "http_reqs":
                reqs.append((ts, name, row.get("status", "")))
            elif metric == "http_req_duration":
                durations.append((ts, name, float(row["metric_value"])))
            elif metric == "http_req_failed":
                failed.append((ts, name, float(row["metric_value"])))
    vus.sort()
    return reqs, durations, failed, vus


def read_samples(path):
    rows = []
    if not os.path.exists(path):
        return rows
    with open(path, newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                rows.append((int(row["epoch_s"]) * 1000, row["kind"], row["name"], float(row["value"])))
            except (KeyError, ValueError):
                continue
    return rows


def main(folder):
    name = os.path.basename(os.path.normpath(folder))
    # Everything below comes from k6's raw output, so every run is computed the same way
    # even if k6 was stopped before it wrote summary.json.
    reqs, durations, failed, vus = read_raw(os.path.join(folder, "raw.csv.gz"))
    samples = read_samples(os.path.join(folder, "k8s-samples.csv"))
    if not reqs:
        sys.exit("No journey requests in raw.csv.gz")

    t0 = min(ts for ts, _, _ in reqs)
    t_end = max(ts for ts, _, _ in reqs)
    window = lambda ts: int((ts - t0) // 1000 // WINDOW_S)
    n_windows = window(t_end) + 1

    # ---- per window ----
    w_reqs = defaultdict(int)
    w_fail = defaultdict(int)
    w_all = defaultdict(list)
    w_map = defaultdict(list)
    w_vus = defaultdict(float)
    for ts, _, _ in reqs:
        w_reqs[window(ts)] += 1
    for ts, _, value in failed:
        w_fail[window(ts)] += int(value)
    for ts, route, value in durations:
        w_all[window(ts)].append(value)
        if route == "map":
            w_map[window(ts)].append(value)
    for ts, value in vus:
        if ts >= t0:
            w_vus[window(ts)] = max(w_vus[window(ts)], value)

    w_k8s = defaultdict(lambda: defaultdict(float))
    per_sample = defaultdict(lambda: defaultdict(float))
    for ts, kind, pod, value in samples:
        if kind == "cpu_m":
            group = "backend" if pod.startswith("backend-") else "recommender" if pod.startswith("recommender-") else None
            if group:
                per_sample[ts][f"cpu_{group}"] += value
        elif kind in ("ready_pods", "replicas", "desired_replicas", "hpa_cpu_pct"):
            per_sample[ts][f"{kind}_{pod}"] = value
    for ts, values in per_sample.items():
        if t0 <= ts <= t_end + WINDOW_S * 1000:
            w = window(ts)
            for key, value in values.items():
                w_k8s[w][key] = max(w_k8s[w][key], value)

    rows = []
    for w in range(n_windows):
        count = w_reqs[w]
        k8s = w_k8s.get(w, {})
        # The last window is usually shorter than WINDOW_S.
        length_s = max(1.0, min(WINDOW_S, (t_end - t0) / 1000 - w * WINDOW_S))
        rows.append({
            "window": f"{w * WINDOW_S}-{w * WINDOW_S + round(length_s)}s",
            "vus_max": int(w_vus.get(w, 0)),
            "req_per_s": round(count / length_s, 1),
            "p95_all_ms": round(percentile(w_all[w], 95) or 0),
            "p95_map_ms": round(percentile(w_map[w], 95) or 0),
            "errors": w_fail[w],
            "error_pct": round(100 * w_fail[w] / count, 2) if count else 0,
            "gateway_ready_pods": int(k8s.get("ready_pods_backend", 0)) or "",
            "gateway_cpu_m": int(k8s.get("cpu_backend", 0)) or "",
            "hpa_cpu_pct": int(k8s.get("hpa_cpu_pct_backend", 0)) or "",
            "recommender_cpu_m": int(k8s.get("cpu_recommender", 0)) or "",
        })
    with open(os.path.join(folder, "windows.csv"), "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    # ---- autoscaling timeline ----
    timeline = []
    last = {}
    first_hot = None
    vu_times = [t for t, _ in vus]
    for ts in sorted(per_sample):
        if ts < t0 - 5000:
            continue
        values = per_sample[ts]
        rel = round((ts - t0) / 1000)
        at = bisect.bisect_right(vu_times, ts) - 1
        live_vus = vus[at][1] if at >= 0 else 0
        cpu = values.get("hpa_cpu_pct_backend")
        if first_hot is None and cpu is not None and cpu >= HPA_TARGET_PCT:
            first_hot = rel
            timeline.append(f"t+{rel}s: gateway CPU first at or above {HPA_TARGET_PCT}% of request ({int(cpu)}%), ~{int(live_vus)} VUs")
        for key, label in (("desired_replicas_backend", "HPA wants"), ("ready_pods_backend", "gateway pods Ready")):
            value = values.get(key)
            if value is not None and key in last and value != last[key]:
                timeline.append(f"t+{rel}s: {label} {int(last[key])} -> {int(value)} (~{int(live_vus)} VUs)")
            if value is not None:
                last[key] = value

    # ---- per route ----
    duration_s = (t_end - t0) / 1000
    by_route = defaultdict(list)
    for _, route, value in durations:
        by_route[route].append(value)
    failed_by_route = defaultdict(int)
    for _, route, value in failed:
        failed_by_route[route] += int(value)
    route_stats = {}
    route_rows = []
    for route in ROUTES:
        values = by_route.get(route)
        if not values:
            continue
        stats = {
            "count": len(values),
            "rate": len(values) / duration_s,
            "avg": sum(values) / len(values),
            "med": percentile(values, 50),
            "p95": percentile(values, 95),
            "p99": percentile(values, 99),
            "max": max(values),
            "error_pct": 100 * failed_by_route[route] / len(values),
        }
        route_stats[route] = stats
        route_rows.append(
            f"| {route} | {stats['count']:,} | {stats['rate']:.1f} | {ms(stats['avg'])} | {ms(stats['med'])} "
            f"| {ms(stats['p95'])} | {ms(stats['p99'])} | {ms(stats['max'])} | {stats['error_pct']:.2f}% |"
        )

    fail_rate = sum(failed_by_route.values()) / len(reqs)
    map_p95 = route_stats.get("map", {}).get("p95")
    statuses = defaultdict(int)
    for _, _, status in reqs:
        statuses[status or "0"] += 1

    lines = [
        f"# Load test run: {name}",
        "",
        f"- Started {datetime.fromtimestamp(t0 / 1000).strftime('%Y-%m-%d %H:%M:%S')}, ran {duration_s:.0f} s, "
        f"up to {int(max((v for _, v in vus), default=0))} VUs",
        f"- {len(reqs):,} journey requests (setup warm-up excluded), {len(reqs) / duration_s:.1f} req/s on average, "
        f"{100 * fail_rate:.2f}% failed",
        f"- Status codes: " + ", ".join(f"{k}: {v:,}" for k, v in sorted(statuses.items())),
        f"- NFR 2, map p95 < {NFR_P95_MS} ms: "
        + ("n/a (no map requests)" if map_p95 is None else f"**{'PASS' if map_p95 < NFR_P95_MS else 'FAIL'}** ({ms(map_p95)})"),
        f"- Errors < 1%: **{'PASS' if fail_rate < 0.01 else 'FAIL'}** ({100 * fail_rate:.2f}%)",
        "",
        "## Per route",
        "",
        "| Route | Requests | req/s | avg | median | p95 | p99 | max | Errors |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        *route_rows,
        "",
        f"## Every {WINDOW_S} s (t = first journey request)",
        "",
        "| Window | VUs | req/s | p95 all | p95 map | Errors | Gateway pods Ready | Gateway CPU (m) | HPA CPU % | Recommender CPU (m) |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for r in rows:
        lines.append(
            f"| {r['window']} | {r['vus_max']} | {r['req_per_s']} | {r['p95_all_ms']:,} | {r['p95_map_ms']:,} "
            f"| {r['errors']} ({r['error_pct']}%) | {r['gateway_ready_pods']} | {r['gateway_cpu_m']} | {r['hpa_cpu_pct']} | {r['recommender_cpu_m']} |"
        )
    lines += ["", "## Autoscaling timeline", ""]
    lines += [f"- {item}" for item in timeline] or ["- No change in gateway pods during the run"]
    lines += [
        "",
        "HPA CPU % is the gateway's average CPU against its 100m request; the HPA adds pods above 70%.",
        "kubectl top refreshes about every 15 s, so CPU and pod counts are approximate per window.",
    ]
    text = "\n".join(lines) + "\n"
    with open(os.path.join(folder, "summary.md"), "w", encoding="utf-8") as handle:
        handle.write(text)
    # The same numbers for scripts, such as the one that builds the slides.
    with open(os.path.join(folder, "stats.json"), "w", encoding="utf-8") as handle:
        json.dump({
            "run": name,
            "duration_s": round(duration_s),
            "vus_max": int(max((v for _, v in vus), default=0)),
            "requests": len(reqs),
            "req_per_s": round(len(reqs) / duration_s, 1),
            "error_pct": round(100 * fail_rate, 2),
            "statuses": dict(statuses),
            "routes": {k: {m: round(v, 1) for m, v in s.items()} for k, s in route_stats.items()},
            "windows": rows,
            "timeline": timeline,
        }, handle, indent=2)
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
