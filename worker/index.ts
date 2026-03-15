// Worker handles /short and /json API routes.
// Everything else falls through to static assets (index.html, styles.css, client.js).

// ── Promotion constants ─────────────────────────────────
const PROMO_START = new Date("2026-03-13T04:00:00Z").getTime()
const PROMO_END = new Date("2026-03-28T06:59:00Z").getTime()
const PEAK_START_UTC = 12 // 8 AM EDT
const PEAK_END_UTC = 18 // 2 PM EDT

// ── Core logic (same as client.js, using native Date) ───

function isWeekendInET(ts: number): boolean {
	const day = new Date(ts).toLocaleDateString("en-US", {
		timeZone: "America/New_York",
		weekday: "short",
	})
	return day === "Sat" || day === "Sun"
}

function getStatus(ts: number) {
	const promoActive = ts > PROMO_START && ts < PROMO_END
	const utcHour = new Date(ts).getUTCHours()
	const isPeakHour = utcHour >= PEAK_START_UTC && utcHour < PEAK_END_UTC
	const isWeekend = isWeekendInET(ts)
	const isPeak = !isWeekend && isPeakHour
	const is2x = promoActive && (isWeekend || !isPeakHour)
	return { is2x, promoActive, isPeak, isWeekend }
}

function findNextWeekdayPeakStart(ts: number): number {
	const d = new Date(ts)
	const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), PEAK_START_UTC)
	for (let i = 0; i < 8; i++) {
		const candidate = base + i * 86400000
		if (candidate > ts && !isWeekendInET(candidate)) return candidate
	}
	return base + 7 * 86400000
}

function getCountdown(ts: number, status: ReturnType<typeof getStatus>) {
	if (!status.promoActive) return { seconds: 0, label: "Promotion has ended" }

	let nextChange: number
	let nextLabel: string

	if (status.is2x) {
		nextChange = findNextWeekdayPeakStart(ts)
		nextLabel = "Standard hours begin"
	} else {
		const d = new Date(ts)
		nextChange = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), PEAK_END_UTC)
		nextLabel = "2x resumes"
	}

	if (nextChange > PROMO_END) {
		nextChange = PROMO_END
		nextLabel = "Promotion ends"
	}

	return { seconds: Math.max(0, Math.floor((nextChange - ts) / 1000)), label: nextLabel }
}

// ── Formatting helpers ──────────────────────────────────

function formatDuration(totalSeconds: number | null): string | null {
	if (totalSeconds === null || totalSeconds <= 0) return null
	const h = Math.floor(totalSeconds / 3600)
	const m = Math.floor((totalSeconds % 3600) / 60)
	const s = totalSeconds % 60
	const pad = (n: number) => String(n).padStart(2, "0")
	if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`
	if (m > 0) return `${m}m ${pad(s)}s`
	return `${s}s`
}

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

function dayNameInTz(ts: number, tz: string): string {
	try {
		return new Date(ts).toLocaleDateString("en-US", {
			timeZone: tz,
			weekday: "long",
		})
	} catch {
		return new Date(ts).toLocaleDateString("en-US", {
			timeZone: "UTC",
			weekday: "long",
		})
	}
}

// ── Worker ──────────────────────────────────────────────

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url)
		const now = Date.now()
		const status = getStatus(now)
		const userTz = (request.cf?.timezone as string) || "UTC"

		if (url.pathname === "/short") {
			return new Response(status.is2x ? "yes" : "no", {
				headers: {
					"content-type": "text/plain",
					"x-timezone": userTz,
					"access-control-allow-origin": "*",
					"x-content-type-options": "nosniff",
				},
			})
		}

		if (url.pathname === "/json") {
			const countdown = getCountdown(now, status)
			const body = {
				is2x: status.is2x,
				promoActive: status.promoActive,
				isPeak: status.isPeak,
				isWeekend: status.isWeekend,
				peakHours: "8 AM \u2013 2 PM ET (weekdays only)",
				promoPeriod: "March 13\u201327, 2026",
				currentTimeET: formatTimeInTz(now, "America/New_York"),
				currentTimeUser: formatTimeInTz(now, userTz),
				currentDayET: dayNameInTz(now, "America/New_York"),
				currentDayUser: dayNameInTz(now, userTz),
				userTimezone: userTz,
				timestamp: new Date(now).toISOString(),
				"2xWindowExpiresInSeconds": status.is2x ? countdown.seconds : null,
				"2xWindowExpiresIn": status.is2x ? formatDuration(countdown.seconds) : null,
				standardWindowExpiresInSeconds: status.isPeak ? countdown.seconds : null,
				standardWindowExpiresIn: status.isPeak ? formatDuration(countdown.seconds) : null,
			}
			return new Response(JSON.stringify(body, null, 2), {
				headers: {
					"content-type": "application/json",
					"access-control-allow-origin": "*",
					"x-content-type-options": "nosniff",
				},
			})
		}

		// Static assets are served directly by Cloudflare's edge before the worker.
		// If we get here, no static file matched — return 404.
		return new Response("Not found", {
			status: 404,
			headers: { "content-type": "text/plain", "x-content-type-options": "nosniff" },
		})
	},
} satisfies ExportedHandler<Env>
