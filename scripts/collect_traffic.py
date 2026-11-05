#!/usr/bin/env python3
"""Collect rolling GitHub repository traffic and preserve daily snapshots.

Required environment variable:
  GH_TRAFFIC_STATS_TOKEN - fine-grained PAT with Administration: read on
  each monitored repository. Never expose this token to the browser.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OWNER = "cosmiccoder200x-sys"
REPOSITORIES = [
    "habitos2.0",
    "mindsprint",
    "xboostproductivity",
    "FinSight",
    "devstarter",
    "gitfolio",
    "build.portfolio",
    "campus-guardian-ai",
    "local-brain-mcp",
    "vibecoding.notes",
    "wallpaperX",
    "Algoverse",
    "Focusflow",
    "portfolio",
    "habit-os",
    "studyos",
    "Gullylabs",
    "Trekking-Management",
    "portfolio-template",
    "Modulr",
    "E--learning",
    "AirTouchAI"
]
DATA_FILE = Path("analytics/data.json")
API_ROOT = "https://api.github.com"
HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "portfolio-github-traffic-collector",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def get_json(path: str, token: str):
    request = Request(
        API_ROOT + path,
        headers={**HEADERS, "Authorization": f"Bearer {token}"},
    )
    try:
        with urlopen(request, timeout=25) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code in (403, 404):
            print(f"WARNING: GitHub returned HTTP {exc.code} for {path}; skipping this metric.")
            return None
        raise
    except (URLError, TimeoutError) as exc:
        print(f"WARNING: Network error for {path}: {exc}")
        return None


def load_data() -> dict:
    if not DATA_FILE.exists():
        return {
            "schema_version": 1,
            "updated_at": None,
            "collection_started_at": None,
            "note": (
                "GitHub retains repository traffic data for only 14 days. "
                "This file accumulates daily snapshots from the first successful "
                "collection; the first run can recover only the currently available 14-day window."
            ),
            "repositories": {},
        }
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))


def merge_series(existing: dict, points: list[dict]) -> dict:
    merged = dict(existing)
    for point in points:
        stamp = point.get("timestamp", "")
        if not stamp:
            continue
        day = stamp[:10]
        merged[day] = {
            "count": int(point.get("count", 0)),
            "uniques": int(point.get("uniques", 0)),
        }
    return dict(sorted(merged.items()))


def main() -> int:
    token = os.environ.get("GH_TRAFFIC_STATS_TOKEN", "").strip()
    if not token:
        print("ERROR: GH_TRAFFIC_STATS_TOKEN is not configured.", file=sys.stderr)
        return 1

    data = load_data()
    data.setdefault("repositories", {})
    now = utc_now()
    successful = 0

    for name in REPOSITORIES:
        full_name = f"{OWNER}/{name}"
        entry = data["repositories"].setdefault(
            full_name,
            {
                "name": name,
                "url": f"https://github.com/{full_name}",
                "views_daily": {},
                "clones_daily": {},
                "last_14_days": {},
                "referrers": [],
            },
        )

        views = get_json(f"/repos/{full_name}/traffic/views", token)
        if views is not None:
            successful += 1
            entry["views_daily"] = merge_series(entry.get("views_daily", {}), views.get("views", []))
            entry.setdefault("last_14_days", {})["views"] = int(views.get("count", 0))
            entry["last_14_days"]["unique_visitors"] = int(views.get("uniques", 0))

        clones = get_json(f"/repos/{full_name}/traffic/clones", token)
        if clones is not None:
            successful += 1
            entry["clones_daily"] = merge_series(entry.get("clones_daily", {}), clones.get("clones", []))
            entry.setdefault("last_14_days", {})["clones"] = int(clones.get("count", 0))
            entry["last_14_days"]["unique_cloners"] = int(clones.get("uniques", 0))

        referrers = get_json(f"/repos/{full_name}/traffic/popular/referrers", token)
        if referrers is not None:
            successful += 1
            entry["referrers"] = [
                {"referrer": item.get("referrer", "Unknown"),
                 "count": int(item.get("count", 0)),
                 "uniques": int(item.get("uniques", 0))}
                for item in referrers
            ]
            entry["referrers_captured_at"] = now

        entry["updated_at"] = now

    if successful == 0:
        print(
            "WARNING: No traffic endpoints succeeded. Keeping existing analytics history "
            "unchanged. Check that the PAT has Administration: read access to the selected repositories."
        )
        return 0

    data["updated_at"] = now
    data["collection_started_at"] = data.get("collection_started_at") or now
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated traffic snapshots: {successful} successful API responses across {len(REPOSITORIES)} repositories.")
    print(f"Saved {DATA_FILE}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
