// Worker handles /short and /json API routes.
// Everything else falls through to static assets (index.html, styles.css, client.js).
//
// As of May 6, 2026, Claude usage is permanently 2x thanks to the
// SpaceX × Anthropic Colossus 1 compute deal. The answer is always yes.
// https://www.anthropic.com/news/higher-limits-spacex

const ANNOUNCEMENT_URL = "https://www.anthropic.com/news/higher-limits-spacex"
const SINCE = "2026-05-06"

function formatTimeInTz(ts: number, tz: string): string | null {
	try {
		return new Date(ts).toLocaleString("en-US", {
			timeZone: tz,
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
	} catch {
		return null
	}
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		const now = Date.now()
		const userTz = (request.cf?.timezone as string) || "UTC"

		if (url.pathname === "/short") {
			return new Response("yes", {
				headers: {
					"content-type": "text/plain",
					"x-timezone": userTz,
					"access-control-allow-origin": "*",
					"x-content-type-options": "nosniff",
				},
			})
		}

		if (url.pathname === "/json") {
			const body = {
				is2x: true,
				permanent: true,
				reason: "SpaceX × Anthropic Colossus 1 compute deal",
				since: SINCE,
				announcement: ANNOUNCEMENT_URL,
				appliesTo: ["Pro", "Max", "Team", "Enterprise (seat-based)"],
				currentTimeUser: formatTimeInTz(now, userTz),
				userTimezone: userTz,
				timestamp: new Date(now).toISOString(),
			}
			return new Response(JSON.stringify(body, null, 2), {
				headers: {
					"content-type": "application/json",
					"access-control-allow-origin": "*",
					"x-content-type-options": "nosniff",
				},
			})
		}

		return new Response("Not found", {
			status: 404,
			headers: { "content-type": "text/plain", "x-content-type-options": "nosniff" },
		})
	},
} satisfies ExportedHandler<Env>
