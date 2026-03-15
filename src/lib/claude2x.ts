import dayjs, { type Dayjs } from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

// Promotion: March 13–27, 2026
// DST starts March 8, 2026 — ET = EDT (UTC-4) for entire promo
export const PROMO_START = dayjs.utc("2026-03-13 04:00:00") // March 13 00:00 EDT
export const PROMO_END = dayjs.utc("2026-03-28 06:59:00") // March 27 11:59 PM PDT

// Peak hours (weekdays only): 5–11 AM PT / 8 AM–2 PM ET / 12:00–18:00 UTC
export const PEAK_START_UTC = 12
export const PEAK_END_UTC = 18

// Peak as fraction of ET day (for timeline visualization)
export const PEAK_START_ET_FRAC = 8 / 24 // 8 AM ET
export const PEAK_END_ET_FRAC = 14 / 24 // 2 PM ET

export interface Status {
	is2x: boolean
	promoActive: boolean
	promoNotStarted: boolean
	promoEnded: boolean
	isPeak: boolean
	isWeekend: boolean
	utcHour: number
}

export interface Countdown {
	seconds: number
	label: string
}

type TimeInput = Dayjs | Date | number

function toDayjs(input: TimeInput): Dayjs {
	if (dayjs.isDayjs(input)) return input
	return dayjs(input)
}

/**
 * Check if a given moment falls on a weekend in Eastern Time
 */
function isWeekendET(d: Dayjs): boolean {
	const etDay = d.tz("America/New_York").day()
	return etDay === 0 || etDay === 6 // Sunday or Saturday
}

/**
 * Determine current 2x status.
 *
 * Rules (from @claudeai tweet + support article):
 * - Weekdays: 2x outside 5–11 AM PT / 12–6 PM UTC
 * - Weekends (Sat/Sun in ET): 2x all day
 * - Promo period: March 13–27, 2026
 */
export function getStatus(now: TimeInput = dayjs()): Status {
	const d = toDayjs(now)
	const promoActive = d.isAfter(PROMO_START) && d.isBefore(PROMO_END)
	const promoNotStarted = d.isBefore(PROMO_START) || d.isSame(PROMO_START)
	const promoEnded = !promoActive && !promoNotStarted

	const utcHour = d.utc().hour()
	const isPeakHour = utcHour >= PEAK_START_UTC && utcHour < PEAK_END_UTC
	const isWeekend = isWeekendET(d)

	// Peak only applies on weekdays
	const isPeak = !isWeekend && isPeakHour
	const is2x = promoActive && (isWeekend || !isPeakHour)

	return { is2x, promoActive, promoNotStarted, promoEnded, isPeak, isWeekend, utcHour }
}

/**
 * Find the next weekday 12:00 UTC (start of peak) after the given time.
 * Skips weekends by checking ET day at each candidate noon UTC.
 */
function findNextWeekdayPeakStart(d: Dayjs): Dayjs {
	const todayNoonUTC = d.utc().startOf("day").add(PEAK_START_UTC, "hour")
	for (let i = 0; i < 8; i++) {
		const candidate = todayNoonUTC.add(i, "day")
		if (candidate.isAfter(d) && !isWeekendET(candidate)) {
			return candidate
		}
	}
	return todayNoonUTC.add(7, "day")
}

/**
 * Get countdown to the next status transition.
 */
export function getCountdown(now: TimeInput = dayjs()): Countdown {
	const d = toDayjs(now)
	const { promoActive, promoNotStarted, promoEnded, is2x } = getStatus(d)

	if (promoEnded) {
		return { seconds: 0, label: "Promotion has ended" }
	}

	if (promoNotStarted) {
		return {
			seconds: Math.max(0, PROMO_START.diff(d, "second")),
			label: "Promotion starts",
		}
	}

	let nextChange: Dayjs
	let nextLabel: string

	if (is2x) {
		// Currently 2x → find next weekday peak start
		nextChange = findNextWeekdayPeakStart(d)
		nextLabel = "Standard hours begin"
	} else {
		// Currently peak (weekday, 12-18 UTC) → 2x resumes at 18:00 UTC today
		nextChange = d.utc().startOf("day").add(PEAK_END_UTC, "hour")
		nextLabel = "2x resumes"
	}

	// Cap at promo end
	if (nextChange.isAfter(PROMO_END)) {
		nextChange = PROMO_END
		nextLabel = "Promotion ends"
	}

	return {
		seconds: Math.max(0, nextChange.diff(d, "second")),
		label: nextLabel,
	}
}

/**
 * Format seconds into human-readable countdown string
 */
export function formatCountdown(totalSeconds: number): string {
	if (totalSeconds <= 0) return "\u2014"
	const h = Math.floor(totalSeconds / 3600)
	const m = Math.floor((totalSeconds % 3600) / 60)
	const s = totalSeconds % 60

	if (h > 24) {
		const days = Math.floor(h / 24)
		const remainH = h % 24
		return `${days}d ${remainH}h ${String(m).padStart(2, "0")}m`
	}
	if (h > 0) {
		return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
	}
	if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`
	return `${s}s`
}

/**
 * Format a dayjs instance in a given IANA timezone
 */
export function formatTime(d: Dayjs, tz: string): string {
	try {
		return d.tz(tz).format("h:mm:ss A")
	} catch {
		return d.format("h:mm:ss A")
	}
}

/**
 * Format a dayjs instance in Eastern Time
 */
export function formatTimeET(d: Dayjs): string {
	return formatTime(d, "America/New_York")
}

/**
 * Get current time's progress through the ET day (0–1) for timeline
 */
export function getETProgress(d: Dayjs): number {
	const et = d.tz("America/New_York")
	return (et.hour() * 60 + et.minute()) / (24 * 60)
}

/**
 * Get user's IANA timezone string from browser
 */
export function getUserTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Format timezone for display (e.g. "America/New_York" → "New York")
 */
export function formatTzName(tz: string): string {
	const parts = tz.split("/")
	return (parts[parts.length - 1] ?? tz).replace(/_/g, " ")
}
