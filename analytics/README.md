# GitHub Traffic Analytics

This public dashboard is available at `/analytics/` after the portfolio branch is deployed.

## What is collected

The scheduled GitHub Actions workflow records repository page views, unique visitors, clones, unique cloners, and popular referrers for the public repositories listed in `scripts/collect_traffic.py`.

- `analytics/data.json` is the public, historical snapshot file read by the dashboard.
- Daily view and clone counts are merged by UTC date, so repeat runs update the current rolling window rather than duplicate dates.
- The dashboard reports accumulated daily views/clones since collection began and the latest per-repository 14-day unique counts.
- Unique visitor counts are not additive across days or repositories; the same person may appear in multiple windows/repositories.
- GitHub only exposes a rolling 14-day traffic window. The first successful run can backfill only the data still available then. Earlier history cannot be recovered.

## One-time setup

1. Create a **fine-grained personal access token** at GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
2. Set the resource owner to `cosmiccoder200x-sys`.
3. Choose **Only select repositories** and select the public repositories listed in `scripts/collect_traffic.py`.
4. Under Repository permissions, set **Administration: Read-only**. No write permission is needed for this token.
5. In this repository, open Settings → Secrets and variables → Actions → New repository secret.
6. Set the secret name to `GH_TRAFFIC_STATS_TOKEN` and paste the token as its value. Never commit the token or put it in browser-side JavaScript.
7. Merge this feature into the default branch, then open Actions → **Collect GitHub repository traffic** → Run workflow to perform the first collection.

The workflow then runs daily at 06:47 India Standard Time. It uses the repository's `GITHUB_TOKEN` only to commit the updated public JSON history.

## Security and privacy

The token is used only inside GitHub Actions and is never written to `analytics/data.json` or sent to the public dashboard. The monitored list intentionally excludes private repositories. The dashboard shows aggregate repository metrics, not visitor identities.

## Troubleshooting

- A 403 response usually means the token is missing Administration read access to that repository.
- A 404 or an empty response can mean GitHub has no traffic data available for that repository.
- If every request fails, the workflow stops without overwriting the historical data.
- The workflow needs Actions enabled and repository Actions permissions that allow the workflow's `GITHUB_TOKEN` to write contents.
