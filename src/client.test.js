// Tests for static/client.js — the browser-side 2x status logic.
// These test the same functions that run in the browser, using native Date + Intl.
// The `typeof document` guard in client.js skips DOM code in vitest.

import { describe, it, expect, beforeAll } from "vitest"

// Load client.js into the global scope (no IIFE, functions are global)
beforeAll(async () => {
	await import("../static/client.js")
})

// March 2026 calendar (EDT = UTC-4):
// Fri 13 (promo starts), Sat 14, Sun 15,
// Mon 16, Tue 17, Wed 18, Thu 19, Fri 20, Sat 21, Sun 22,
// Mon 23, Tue 24, Wed 25, Thu 26, Fri 27 (promo ends end-of-day)

/** Helper: UTC timestamp from ISO-ish string */
const utc = (s) => new Date(s + "Z").getTime()

// ──────────────────────────────────────────────────────────
// getStatus
// ──────────────────────────────────────────────────────────
describe("client getStatus", () => {
	describe("weekday off-peak (2x)", () => {
		it("before peak (morning UTC)", () => {
			const s = getStatus(utc("2026-03-18T06:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
			expect(s.isWeekend).toBe(false)
		})

		it("after peak (evening UTC)", () => {
			const s = getStatus(utc("2026-03-18T20:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
		})

		it("at exactly 18:00 UTC (peak ends)", () => {
			const s = getStatus(utc("2026-03-18T18:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
		})
	})

	describe("weekday peak (not 2x)", () => {
		it("during peak hours", () => {
			const s = getStatus(utc("2026-03-18T14:00:00"))
			expect(s.is2x).toBe(false)
			expect(s.isPeak).toBe(true)
		})

		it("at exactly 12:00 UTC (peak starts)", () => {
			const s = getStatus(utc("2026-03-18T12:00:00"))
			expect(s.is2x).toBe(false)
			expect(s.isPeak).toBe(true)
		})
	})

	describe("weekends (always 2x)", () => {
		it("Saturday during peak UTC hours", () => {
			const s = getStatus(utc("2026-03-21T14:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
			expect(s.isWeekend).toBe(true)
		})

		it("Sunday morning", () => {
			const s = getStatus(utc("2026-03-22T08:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isWeekend).toBe(true)
		})

		it("late Sunday in ET (early Monday UTC) is still weekend", () => {
			// Monday 03:00 UTC = Sunday 11 PM ET
			const s = getStatus(utc("2026-03-23T03:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isWeekend).toBe(true)
		})
	})

	describe("UTC vs ET day boundary mismatch", () => {
		it("Saturday 00:00 UTC = Friday 8 PM ET → weekday", () => {
			const s = getStatus(utc("2026-03-21T00:00:00"))
			expect(s.isWeekend).toBe(false) // Friday in ET
			expect(s.is2x).toBe(true) // off-peak
		})

		it("Saturday 04:00 UTC = Saturday 00:00 ET → weekend starts", () => {
			const s = getStatus(utc("2026-03-21T04:00:00"))
			expect(s.isWeekend).toBe(true)
		})

		it("Monday 03:59 UTC = Sunday 11:59 PM ET → still weekend", () => {
			const s = getStatus(utc("2026-03-23T03:59:00"))
			expect(s.isWeekend).toBe(true)
		})

		it("Monday 04:00 UTC = Monday 00:00 ET → weekday", () => {
			const s = getStatus(utc("2026-03-23T04:00:00"))
			expect(s.isWeekend).toBe(false)
		})
	})

	describe("promo boundaries", () => {
		it("before promo", () => {
			const s = getStatus(utc("2026-03-12T20:00:00"))
			expect(s.promoNotStarted).toBe(true)
			expect(s.is2x).toBe(false)
		})

		it("after promo", () => {
			const s = getStatus(utc("2026-03-29T20:00:00"))
			expect(s.promoEnded).toBe(true)
			expect(s.is2x).toBe(false)
		})

		it("at exact promo start boundary (ts == PROMO_START) is promoNotStarted", () => {
			// Client uses strict > for promoActive, so exactly equal = not started
			expect(getStatus(PROMO_START).promoNotStarted).toBe(true)
		})

		it("1ms after promo start", () => {
			expect(getStatus(PROMO_START + 1).promoActive).toBe(true)
		})

		it("at exact promo end boundary (ts == PROMO_END) is promoEnded", () => {
			expect(getStatus(PROMO_END).promoEnded).toBe(true)
		})

		it("1ms before promo end", () => {
			expect(getStatus(PROMO_END - 1).promoActive).toBe(true)
		})
	})

	describe("every weekday has peak", () => {
		const weekdays = ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20"]
		for (const date of weekdays) {
			it(`${date} at 14:00 UTC is peak`, () => {
				expect(getStatus(utc(`${date}T14:00:00`)).isPeak).toBe(true)
			})
			it(`${date} at 20:00 UTC is 2x`, () => {
				expect(getStatus(utc(`${date}T20:00:00`)).is2x).toBe(true)
			})
		}
	})

	describe("weekend peak UTC hours still 2x", () => {
		for (let h = 12; h < 18; h++) {
			it(`Saturday at ${h}:00 UTC is 2x (weekend overrides)`, () => {
				const s = getStatus(utc(`2026-03-21T${String(h).padStart(2, "0")}:00:00`))
				expect(s.is2x).toBe(true)
				expect(s.isPeak).toBe(false)
			})
		}
	})
})

// ──────────────────────────────────────────────────────────
// getCountdown
// ──────────────────────────────────────────────────────────
describe("client getCountdown", () => {
	it("weekday before peak → counts to peak start", () => {
		const cd = getCountdown(utc("2026-03-18T10:00:00"))
		expect(cd.label).toBe("Standard hours begin")
		expect(cd.seconds).toBe(2 * 3600)
	})

	it("weekday during peak → counts to peak end", () => {
		const cd = getCountdown(utc("2026-03-18T14:00:00"))
		expect(cd.label).toBe("2x resumes")
		expect(cd.seconds).toBe(4 * 3600)
	})

	it("weekday after peak → next weekday peak", () => {
		// Wednesday 20:00 → Thursday 12:00 = 16h
		const cd = getCountdown(utc("2026-03-18T20:00:00"))
		expect(cd.label).toBe("Standard hours begin")
		expect(cd.seconds).toBe(16 * 3600)
	})

	it("Friday after peak → skips weekend to Monday", () => {
		// Friday 20:00 → Monday 12:00 = 64h
		const cd = getCountdown(utc("2026-03-20T20:00:00"))
		expect(cd.label).toBe("Standard hours begin")
		expect(cd.seconds).toBe(64 * 3600)
	})

	it("Saturday → Monday peak start", () => {
		// Saturday 10:00 → Monday 12:00 = 50h
		const cd = getCountdown(utc("2026-03-21T10:00:00"))
		expect(cd.label).toBe("Standard hours begin")
		expect(cd.seconds).toBe(50 * 3600)
	})

	it("Sunday → Monday peak start", () => {
		// Sunday 16:00 → Monday 12:00 = 20h
		const cd = getCountdown(utc("2026-03-22T16:00:00"))
		expect(cd.label).toBe("Standard hours begin")
		expect(cd.seconds).toBe(20 * 3600)
	})

	it("late Sunday ET (early Monday UTC) → Monday peak", () => {
		// Monday 03:00 UTC = Sunday 11 PM ET → 9h to Monday 12:00
		const cd = getCountdown(utc("2026-03-23T03:00:00"))
		expect(cd.label).toBe("Standard hours begin")
		expect(cd.seconds).toBe(9 * 3600)
	})

	it("caps at promo end on last day", () => {
		const ts = utc("2026-03-27T20:00:00")
		const cd = getCountdown(ts)
		expect(cd.label).toBe("Promotion ends")
		expect(cd.seconds).toBe(Math.floor((PROMO_END - ts) / 1000))
	})

	it("promo ended → 0 seconds", () => {
		const cd = getCountdown(PROMO_END + 1)
		expect(cd.label).toBe("Promotion has ended")
		expect(cd.seconds).toBe(0)
	})

	it("before promo → counts to start", () => {
		const cd = getCountdown(utc("2026-03-12T04:00:00"))
		expect(cd.label).toBe("Promotion starts")
		expect(cd.seconds).toBeGreaterThan(0)
	})

	describe("exact transition precision", () => {
		it("1 second before peak", () => {
			const cd = getCountdown(utc("2026-03-18T11:59:59"))
			expect(cd.seconds).toBe(1)
		})

		it("1 second before peak end", () => {
			const cd = getCountdown(utc("2026-03-18T17:59:59"))
			expect(cd.seconds).toBe(1)
		})
	})

	describe("Mon-Fri after peak produces correct hours", () => {
		const expected = [
			["Mon", "2026-03-16T20:00:00", 16],
			["Tue", "2026-03-17T20:00:00", 16],
			["Wed", "2026-03-18T20:00:00", 16],
			["Thu", "2026-03-19T20:00:00", 16],
			["Fri", "2026-03-20T20:00:00", 64],
		]
		for (const [name, time, hours] of expected) {
			it(`${name} → ${hours}h`, () => {
				expect(getCountdown(utc(time)).seconds).toBe(hours * 3600)
			})
		}
	})
})

// ──────────────────────────────────────────────────────────
// formatCountdown
// ──────────────────────────────────────────────────────────
describe("client formatCountdown", () => {
	it("hours, minutes, seconds", () => {
		expect(formatCountdown(3661)).toBe("1h 01m 01s")
	})
	it("minutes and seconds", () => {
		expect(formatCountdown(125)).toBe("2m 05s")
	})
	it("seconds only", () => {
		expect(formatCountdown(45)).toBe("45s")
	})
	it("days when > 24h", () => {
		expect(formatCountdown(90000)).toBe("1d 1h 00m")
	})
	it("em-dash for zero", () => {
		expect(formatCountdown(0)).toBe("\u2014")
	})
	it("em-dash for negative", () => {
		expect(formatCountdown(-5)).toBe("\u2014")
	})
	it("exactly 1 second", () => {
		expect(formatCountdown(1)).toBe("1s")
	})
	it("exactly 60 seconds", () => {
		expect(formatCountdown(60)).toBe("1m 00s")
	})
	it("exactly 1 hour", () => {
		expect(formatCountdown(3600)).toBe("1h 00m 00s")
	})
})

// ──────────────────────────────────────────────────────────
// getETProgress
// ──────────────────────────────────────────────────────────
describe("client getETProgress", () => {
	it("~0 at midnight ET (04:00 UTC)", () => {
		expect(getETProgress(utc("2026-03-15T04:00:00"))).toBeCloseTo(0, 2)
	})
	it("~0.5 at noon ET (16:00 UTC)", () => {
		expect(getETProgress(utc("2026-03-15T16:00:00"))).toBeCloseTo(0.5, 2)
	})
	it("~0.333 at 8 AM ET (12:00 UTC)", () => {
		expect(getETProgress(utc("2026-03-15T12:00:00"))).toBeCloseTo(8 / 24, 2)
	})
})

// ──────────────────────────────────────────────────────────
// getDayName
// ──────────────────────────────────────────────────────────
describe("client getDayName", () => {
	it("returns ET day name in ET timezone", () => {
		// Monday March 16, 14:00 UTC = 10 AM ET Monday
		expect(getDayName(utc("2026-03-16T14:00:00"), "America/New_York")).toBe("Monday")
	})

	it("returns IST day when ET day differs", () => {
		// Monday March 16, 02:00 UTC = Sunday 10 PM ET but Monday 7:30 AM IST
		expect(getDayName(utc("2026-03-16T02:00:00"), "Asia/Kolkata")).toBe("Monday")
		expect(getDayName(utc("2026-03-16T02:00:00"), "America/New_York")).toBe("Sunday")
	})

	it("returns correct day in Pacific timezone", () => {
		// Sunday March 15, 06:00 UTC = Saturday 11 PM PT
		expect(getDayName(utc("2026-03-15T06:00:00"), "America/Los_Angeles")).toBe("Saturday")
	})
})

// ──────────────────────────────────────────────────────────
// formatTzName
// ──────────────────────────────────────────────────────────
describe("client formatTzName", () => {
	it("extracts city name", () => {
		expect(formatTzName("America/New_York")).toBe("New York")
	})
	it("handles single-part", () => {
		expect(formatTzName("UTC")).toBe("UTC")
	})
	it("handles deep paths", () => {
		expect(formatTzName("America/Indiana/Indianapolis")).toBe("Indianapolis")
	})
})
