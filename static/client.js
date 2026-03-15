// isclaude2x.com — Client-side live status checker
// Computes Claude 2x promotion status entirely in the browser.
// No server round-trip needed — just Date.now() + Intl.

// ── Promotion constants ─────────────────────────────────
// March 13–27, 2026 in EDT (UTC-4)
const PROMO_START = 1773374400000 // 2026-03-13T04:00:00Z (midnight EDT)
const PROMO_END = 1774681140000 // 2026-03-28T06:59:00Z (March 27 11:59 PM PDT)
const PEAK_START_UTC = 12 // 8 AM EDT
const PEAK_END_UTC = 18 // 2 PM EDT

// ── Core logic ──────────────────────────────────────────

/** Check if timestamp falls on a weekend in Eastern Time */
function isWeekendET(ts) {
	const day = new Date(ts).toLocaleDateString("en-US", {
		timeZone: "America/New_York",
		weekday: "short",
	})
	return day === "Sat" || day === "Sun"
}

/** Get full 2x status for a given timestamp */
function getStatus(ts) {
	const promoActive = ts > PROMO_START && ts < PROMO_END
	const promoNotStarted = ts <= PROMO_START
	const promoEnded = !promoActive && !promoNotStarted
	const utcH = new Date(ts).getUTCHours()
	const isPeakHour = utcH >= PEAK_START_UTC && utcH < PEAK_END_UTC
	const isWeekend = isWeekendET(ts)
	// Peak only matters on weekdays
	const isPeak = !isWeekend && isPeakHour
	// 2x if promo is active AND (weekend OR outside peak hours)
	const is2x = promoActive && (isWeekend || !isPeakHour)
	return { is2x, promoActive, promoNotStarted, promoEnded, isPeak, isWeekend }
}

/** Find the next weekday noon UTC (peak start), skipping weekends */
function findNextWeekdayPeakStart(ts) {
	const d = new Date(ts)
	const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), PEAK_START_UTC)
	for (let i = 0; i < 8; i++) {
		const candidate = base + i * 86400000
		if (candidate > ts && !isWeekendET(candidate)) return candidate
	}
	return base + 7 * 86400000
}

/** Get countdown seconds and label to next status transition */
function getCountdown(ts) {
	const st = getStatus(ts)
	if (st.promoEnded) return { seconds: 0, label: "Promotion has ended" }
	if (st.promoNotStarted) {
		return {
			seconds: Math.max(0, Math.floor((PROMO_START - ts) / 1000)),
			label: "Promotion starts",
		}
	}

	let nextChange, nextLabel
	if (st.is2x) {
		// Currently 2x → next transition is when peak starts on a weekday
		nextChange = findNextWeekdayPeakStart(ts)
		nextLabel = "Standard hours begin"
	} else {
		// Currently peak → 2x resumes at 18:00 UTC today
		const d = new Date(ts)
		nextChange = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), PEAK_END_UTC)
		nextLabel = "2x resumes"
	}

	// Don't count past promo end
	if (nextChange > PROMO_END) {
		nextChange = PROMO_END
		nextLabel = "Promotion ends"
	}
	return { seconds: Math.max(0, Math.floor((nextChange - ts) / 1000)), label: nextLabel }
}

// ── Formatting helpers ──────────────────────────────────

/** Format seconds as "1h 23m 45s", "5m 30s", or "12s" */
function formatCountdown(totalSeconds) {
	if (totalSeconds <= 0) return "\u2014"
	const h = Math.floor(totalSeconds / 3600)
	const m = Math.floor((totalSeconds % 3600) / 60)
	const s = totalSeconds % 60
	const pad = (n) => (n < 10 ? "0" + n : "" + n)
	if (h > 24) return Math.floor(h / 24) + "d " + (h % 24) + "h " + pad(m) + "m"
	if (h > 0) return h + "h " + pad(m) + "m " + pad(s) + "s"
	if (m > 0) return m + "m " + pad(s) + "s"
	return s + "s"
}

/** Format timestamp as "12:30:00 PM" in given timezone */
function formatTime(ts, tz) {
	try {
		return new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			hour: "numeric",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
		}).format(new Date(ts))
	} catch {
		return new Intl.DateTimeFormat("en-US", {
			hour: "numeric",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
		}).format(new Date(ts))
	}
}

/** Get weekday name in ET (e.g. "Sunday") */
function getETDayName(ts) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		weekday: "long",
	}).format(new Date(ts))
}

/** Get weekday name in a given timezone (e.g. "Monday") */
function getDayName(ts, tz) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		weekday: "long",
	}).format(new Date(ts))
}

/** Get progress through a day in a given timezone as 0–1 fraction */
function getDayProgress(ts, tz) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hourCycle: "h23",
		hour: "2-digit",
		minute: "2-digit",
	}).formatToParts(new Date(ts))
	let h = 0,
		mi = 0
	for (const part of parts) {
		if (part.type === "hour") h = parseInt(part.value, 10)
		if (part.type === "minute") mi = parseInt(part.value, 10)
	}
	return (h * 60 + mi) / (24 * 60)
}

// Keep the old name for test compatibility
function getETProgress(ts) {
	return getDayProgress(ts, "America/New_York")
}

/**
 * Get peak window start/end as fractions of the user's local day (0–1).
 * Peak is 12:00–18:00 UTC. We convert to the user's timezone to find
 * where that window falls in their local 24h day.
 */
function getPeakFractions(tz) {
	// Use a reference date during EDT (March 18, 2026)
	const peakStartUTC = Date.UTC(2026, 2, 18, PEAK_START_UTC, 0, 0)
	const peakEndUTC = Date.UTC(2026, 2, 18, PEAK_END_UTC, 0, 0)
	return {
		start: getDayProgress(peakStartUTC, tz),
		end: getDayProgress(peakEndUTC, tz),
	}
}

/** Format a UTC hour in a given timezone for display (e.g. "5:30 PM") */
function formatHourInTz(utcHour, tz) {
	const d = new Date(Date.UTC(2026, 2, 18, utcHour, 0, 0))
	return new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(d)
}

/** Extract display name from IANA timezone ("America/New_York" → "New York") */
function formatTzName(tz) {
	const p = tz.split("/")
	return (p[p.length - 1] || tz).replace(/_/g, " ")
}

// ── Expose for testing ──────────────────────────────────
// When loaded via vitest, these become accessible on globalThis
if (typeof globalThis !== "undefined") {
	Object.assign(globalThis, {
		getStatus, getCountdown, formatCountdown,
		formatTime, getETDayName, getDayName, getETProgress,
		getDayProgress, getPeakFractions, formatHourInTz,
		formatTzName, isWeekendET, findNextWeekdayPeakStart,
		PROMO_START, PROMO_END, PEAK_START_UTC, PEAK_END_UTC,
	})
}

// ── Browser-only: state + DOM ───────────────────────────
// Guard so vitest can import this file without crashing on missing DOM
if (typeof document !== "undefined") {
	const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone
	const USER_TZ_DISPLAY = formatTzName(USER_TZ)
	let simTime = null // null = live, number = frozen timestamp
	let simTz = null // null = use browser tz, string = override
	let debugOpen = false

	const $ = (id) => document.getElementById(id)

	/** Recompute status and update all DOM elements */
	function update() {
		const ts = simTime !== null ? simTime : Date.now()
		const tz = simTz !== null ? simTz : USER_TZ
		const tzDisplay = simTz !== null ? formatTzName(simTz) : USER_TZ_DISPLAY

		const st = getStatus(ts)
		const cd = getCountdown(ts)
		const progress = getDayProgress(ts, tz)
		const etDay = getETDayName(ts)
		const localDay = getDayName(ts, tz)
		const peak = getPeakFractions(tz)
		const isInactive = st.promoNotStarted || st.promoEnded

		// Set root status attribute (drives CSS theme: green/amber/gray)
		$("app").dataset.status = isInactive ? "inactive" : st.is2x ? "yes" : "no"

		// Simulation indicator (pulsing amber dot next to title)
		$("sim-dot").hidden = simTime === null

		if (isInactive) {
			$("hero-answer").textContent = "NO"
			$("hero-subtitle").textContent = st.promoNotStarted
				? "The 2x promotion hasn\u2019t started yet"
				: "The 2x promotion has ended"
			$("hero-reason").textContent = ""
			$("countdown-block").hidden = st.promoEnded
			$("countdown-label").textContent = cd.label + " in"
			$("countdown-value").textContent = formatCountdown(cd.seconds)
			$("times-section").hidden = true
			$("timeline-section").hidden = true
			$("promo-period").hidden = false
		} else {
			$("hero-answer").textContent = st.is2x ? "YES" : "NO"
			$("hero-subtitle").textContent = st.is2x
				? "Claude usage is 2x right now"
				: "Standard usage right now"

			if (st.isWeekend) {
				$("hero-reason").textContent = "2x all day \u2014 weekend in ET"
			} else if (st.is2x) {
				$("hero-reason").textContent = "Off-peak hours (outside 8\u202fAM\u20132\u202fPM ET)"
			} else {
				$("hero-reason").textContent = "Peak hours (8\u202fAM\u20132\u202fPM ET on weekdays)"
			}

			$("countdown-block").hidden = false
			$("countdown-label").textContent = cd.label + " in"
			$("countdown-value").textContent = formatCountdown(cd.seconds)
			$("times-section").hidden = false
			$("tz-label").textContent = tzDisplay
			$("time-user").textContent = formatTime(ts, tz)
			$("time-et").textContent = formatTime(ts, "America/New_York")
			// Timeline (in user's timezone)
			const peakStartLabel = formatHourInTz(PEAK_START_UTC, tz)
			const peakEndLabel = formatHourInTz(PEAK_END_UTC, tz)

			$("timeline-section").hidden = false
			// Use the user's local day (not ET) to decide which timeline bar to show,
			// so a Monday in IST shows peak hours even if ET is still Sunday.
			const localIsWeekend = localDay === "Saturday" || localDay === "Sunday"
			$("timeline-title").textContent = localIsWeekend
				? localDay + " (weekend in ET)"
				: localDay + " \u2014 peak: " + peakStartLabel + "\u2013" + peakEndLabel
			$("timeline-marker").style.left = (progress * 100).toFixed(2) + "%"
			$("timeline-weekday").hidden = localIsWeekend
			$("timeline-weekend").hidden = !localIsWeekend
			$("timeline-labels-weekday").hidden = localIsWeekend
			$("timeline-labels-weekend").hidden = !localIsWeekend
			$("timeline-legend").hidden = localIsWeekend
			$("timeline-note").hidden = !localIsWeekend

			// Update weekday timeline segment widths and labels for user's timezone
			if (!localIsWeekend) {
				const segs = $("timeline-weekday").children
				const peakStart = peak.start * 100
				const peakEnd = peak.end * 100
				const wraps = peakEnd < peakStart // peak crosses midnight

				if (wraps) {
					// [peak][2x][peak] — peak spans midnight
					segs[0].className = "timeline-segment segment-peak"
					segs[0].style.width = peakEnd + "%"
					segs[1].className = "timeline-segment segment-2x"
					segs[1].style.width = (peakStart - peakEnd) + "%"
					segs[2].className = "timeline-segment segment-peak"
					segs[2].style.width = (100 - peakStart) + "%"
				} else {
					// [2x][peak][2x] — normal day
					segs[0].className = "timeline-segment segment-2x"
					segs[0].style.width = peakStart + "%"
					segs[1].className = "timeline-segment segment-peak"
					segs[1].style.width = (peakEnd - peakStart) + "%"
					segs[2].className = "timeline-segment segment-2x"
					segs[2].style.width = (100 - peakEnd) + "%"
				}

				const labels = $("timeline-labels-weekday").children
				for (let i = 0; i < 2; i++) {
					const pos = i === 0 ? peakStart : peakEnd
					const label = labels[i]
					label.textContent = i === 0 ? peakStartLabel : peakEndLabel
					// Clamp labels at edges to prevent overflow
					if (pos < 10) {
						label.style.left = pos + "%"
						label.style.right = ""
						label.style.transform = "none"
					} else if (pos > 90) {
						label.style.left = ""
						label.style.right = "0"
						label.style.transform = "none"
					} else {
						label.style.left = pos + "%"
						label.style.right = ""
						label.style.transform = "translateX(-50%)"
					}
				}
			}
			$("promo-period").hidden = true
		}
	}

	// ── Konami code (↑↑↓↓←→←→BA) ───────────────────────
	const KONAMI = [
		"ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
		"ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
		"b", "a",
	]
	let kPos = 0

	document.addEventListener("keydown", (e) => {
		if (e.key === KONAMI[kPos]) {
			kPos++
			if (kPos === KONAMI.length) {
				debugOpen = !debugOpen
				$("debug-panel").hidden = !debugOpen
				if (!debugOpen) {
					simTime = null
					simTz = null
					$("debug-live").disabled = true
					update()
				}
				kPos = 0
			}
		} else {
			kPos = e.key === KONAMI[0] ? 1 : 0
		}
	})

	// ── Debug panel ─────────────────────────────────────
	$("debug-close").addEventListener("click", () => {
		debugOpen = false
		$("debug-panel").hidden = true
		simTime = null
		simTz = null
		$("debug-live").disabled = true
		update()
	})

	$("debug-live").addEventListener("click", () => {
		simTime = null
		simTz = null
		$("debug-live").disabled = true
		update()
	})

	function parseDateInTz(dateStr, tz) {
		if (!dateStr) return null
		const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
		if (!parts) return null
		const y = parseInt(parts[1], 10)
		const mo = parseInt(parts[2], 10) - 1
		const d = parseInt(parts[3], 10)
		const h = parseInt(parts[4], 10)
		const mi = parseInt(parts[5], 10)
		const guessUTC = Date.UTC(y, mo, d, h, mi, 0)
		const fmt = new Intl.DateTimeFormat("en-US", {
			timeZone: tz, hourCycle: "h23",
			year: "numeric", month: "2-digit", day: "2-digit",
			hour: "2-digit", minute: "2-digit",
		})
		const p = fmt.formatToParts(new Date(guessUTC))
		let tzY, tzMo, tzD, tzH, tzMi
		for (const part of p) {
			if (part.type === "year") tzY = parseInt(part.value, 10)
			if (part.type === "month") tzMo = parseInt(part.value, 10) - 1
			if (part.type === "day") tzD = parseInt(part.value, 10)
			if (part.type === "hour") tzH = parseInt(part.value, 10)
			if (part.type === "minute") tzMi = parseInt(part.value, 10)
		}
		const tzRendered = Date.UTC(tzY, tzMo, tzD, tzH, tzMi, 0)
		return guessUTC - (tzRendered - guessUTC)
	}

	$("debug-date").addEventListener("input", function () {
		const tz = $("debug-tz").value
		const ts = parseDateInTz(this.value, tz)
		if (ts !== null) {
			simTime = ts
			simTz = tz
			$("debug-live").disabled = false
			update()
		}
	})

	$("debug-tz").addEventListener("change", function () {
		const tz = this.value
		const dateStr = $("debug-date").value
		const ts = parseDateInTz(dateStr, tz)
		if (ts !== null) {
			simTime = ts
			simTz = tz
			$("debug-live").disabled = false
			update()
		}
	})

	// ── Start ───────────────────────────────────────────
	update()
	setInterval(() => {
		if (simTime === null) update()
	}, 1000)
}
