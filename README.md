# isclaude2x.com

Is Claude usage currently 2x? **Yes — permanently.**

**Live at [isclaude2x.com](https://isclaude2x.com)**

## What is this?

On May 6, 2026, Anthropic announced a compute partnership with SpaceX, securing all of Colossus 1 (220K+ NVIDIA GPUs, 300+ MW). Effective immediately:

- **Claude Code 5-hour rate limits doubled** for Pro, Max, Team, and seat-based Enterprise
- **Peak-hours reduction removed** for Pro and Max
- **Claude Opus API rate limits raised**

This page used to track Claude's temporary March 2026 2x promotion. After the SpaceX deal made 2x permanent, the answer is now `yes` forever.

## API

### `GET /short`

Returns `yes` as plain text. User timezone from IP in `x-timezone` header.

```
$ curl https://isclaude2x.com/short
yes
```

### `GET /json`

```json
{
	"is2x": true,
	"permanent": true,
	"reason": "SpaceX × Anthropic Colossus 1 compute deal",
	"since": "2026-05-06",
	"announcement": "https://www.anthropic.com/news/higher-limits-spacex",
	"appliesTo": ["Pro", "Max", "Team", "Enterprise (seat-based)"],
	"currentTimeUser": "7:20 PM",
	"userTimezone": "Asia/Kolkata",
	"timestamp": "2026-05-07T13:50:46.402Z"
}
```

## Tech stack

- **Cloudflare Worker** — fully server-side, no build step
- **TypeScript** — for the worker
- **Vanilla JS** — minimal client-side script just to set the favicon
- **IP geolocation** — `request.cf.timezone` for the JSON endpoint

## Development

```bash
pnpm install
pnpm test          # vitest unit tests
wrangler dev       # local dev server
wrangler deploy    # deploy to Cloudflare
```

## Sources

- [Anthropic: Higher usage limits and a compute deal with SpaceX](https://www.anthropic.com/news/higher-limits-spacex)

## Author

[@mehulmpt](https://x.com/mehulmpt)
