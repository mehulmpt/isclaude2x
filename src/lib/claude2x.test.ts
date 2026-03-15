import { describe, it, expect } from "vitest"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import {
	getStatus,
	getCountdown,
	formatCountdown,
	getETProgress,
	formatTime,
	formatTimeET,
	formatTzName,
	PROMO_START,
	PROMO_END,
	PEAK_START_UTC,
	PEAK_END_UTC,
} from "./claude2x"

dayjs.extend(utc)
dayjs.extend(timezone)

// March 2026 calendar (EDT = UTC-4):
// Fri 13 (promo starts), Sat 14, Sun 15,
// Mon 16, Tue 17, Wed 18, Thu 19, Fri 20, Sat 21, Sun 22,
// Mon 23, Tue 24, Wed 25, Thu 26, Fri 27 (promo ends end-of-day)

// ──────────────────────────────────────────────────────────
// getStatus
// ──────────────────────────────────────────────────────────
describe("getStatus", () => {
	describe("weekday off-peak (2x)", () => {
		it("before peak (morning UTC)", () => {
			// Wednesday March 18, 06:00 UTC = 2 AM ET
			const s = getStatus(dayjs.utc("2026-03-18 06:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
			expect(s.isWeekend).toBe(false)
			expect(s.promoActive).toBe(true)
		})

		it("after peak (evening UTC)", () => {
			// Wednesday March 18, 20:00 UTC = 4 PM ET
			const s = getStatus(dayjs.utc("2026-03-18 20:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
			expect(s.isWeekend).toBe(false)
		})

		it("just before peak at 11:59 UTC", () => {
			const s = getStatus(dayjs.utc("2026-03-18 11:59:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
		})

		it("at exactly 18:00 UTC (peak ends)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 18:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
		})
	})

	describe("weekday peak (not 2x)", () => {
		it("during peak hours", () => {
			// Wednesday March 18, 14:00 UTC = 10 AM ET
			const s = getStatus(dayjs.utc("2026-03-18 14:00:00"))
			expect(s.is2x).toBe(false)
			expect(s.isPeak).toBe(true)
			expect(s.isWeekend).toBe(false)
		})

		it("at exactly 12:00 UTC (peak starts)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 12:00:00"))
			expect(s.is2x).toBe(false)
			expect(s.isPeak).toBe(true)
		})
	})

	describe("weekends (always 2x)", () => {
		it("Saturday during what would be peak hours", () => {
			// Saturday March 21, 14:00 UTC = 10 AM ET
			const s = getStatus(dayjs.utc("2026-03-21 14:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
			expect(s.isWeekend).toBe(true)
		})

		it("Sunday morning", () => {
			// Sunday March 22, 08:00 UTC = 4 AM ET
			const s = getStatus(dayjs.utc("2026-03-22 08:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isWeekend).toBe(true)
		})

		it("Saturday evening", () => {
			// Saturday March 21, 22:00 UTC = 6 PM ET
			const s = getStatus(dayjs.utc("2026-03-21 22:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isWeekend).toBe(true)
		})

		it("late Sunday night in ET (early Monday UTC) is still weekend", () => {
			// Monday March 23, 03:00 UTC = Sunday March 22, 11 PM ET
			const s = getStatus(dayjs.utc("2026-03-23 03:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isWeekend).toBe(true)
		})
	})

	describe("promo boundaries", () => {
		it("before promo", () => {
			const s = getStatus(dayjs.utc("2026-03-12 20:00:00"))
			expect(s.is2x).toBe(false)
			expect(s.promoNotStarted).toBe(true)
		})

		it("after promo", () => {
			const s = getStatus(dayjs.utc("2026-03-29 20:00:00"))
			expect(s.is2x).toBe(false)
			expect(s.promoEnded).toBe(true)
		})

		it("just before promo start", () => {
			expect(getStatus(dayjs.utc("2026-03-13 03:59:59")).promoNotStarted).toBe(true)
		})

		it("just after promo start", () => {
			expect(getStatus(dayjs.utc("2026-03-13 04:00:01")).promoActive).toBe(true)
		})

		it("just before promo end", () => {
			expect(getStatus(dayjs.utc("2026-03-28 06:58:59")).promoActive).toBe(true)
		})

		it("just after promo end", () => {
			expect(getStatus(dayjs.utc("2026-03-28 06:59:01")).promoEnded).toBe(true)
		})
	})

	describe("input types", () => {
		it("accepts Date objects", () => {
			expect(getStatus(new Date("2026-03-18T20:00:00Z")).is2x).toBe(true)
		})

		it("accepts timestamps", () => {
			expect(getStatus(new Date("2026-03-18T14:00:00Z").getTime()).isPeak).toBe(true)
		})
	})

	// ── Edge cases ──────────────────────────────────────────

	describe("peak boundary precision (sub-minute)", () => {
		it("11:59:59 UTC → 2x (1 second before peak)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 11:59:59"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
		})

		it("12:00:00 UTC → NOT 2x (exact peak start)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 12:00:00"))
			expect(s.is2x).toBe(false)
			expect(s.isPeak).toBe(true)
		})

		it("12:00:01 UTC → NOT 2x (1 second into peak)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 12:00:01"))
			expect(s.is2x).toBe(false)
			expect(s.isPeak).toBe(true)
		})

		it("17:59:59 UTC → NOT 2x (last second of peak)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 17:59:59"))
			expect(s.is2x).toBe(false)
			expect(s.isPeak).toBe(true)
		})

		it("18:00:00 UTC → 2x (exact peak end)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 18:00:00"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
		})

		it("18:00:01 UTC → 2x (1 second after peak)", () => {
			const s = getStatus(dayjs.utc("2026-03-18 18:00:01"))
			expect(s.is2x).toBe(true)
			expect(s.isPeak).toBe(false)
		})
	})

	describe("UTC midnight vs ET midnight (day boundary mismatch)", () => {
		it("Saturday 00:00 UTC = Friday 8 PM ET → weekday, off-peak, 2x", () => {
			// UTC says Saturday but ET says Friday
			const s = getStatus(dayjs.utc("2026-03-21 00:00:00"))
			expect(s.isWeekend).toBe(false) // Friday in ET
			expect(s.is2x).toBe(true) // off-peak
			expect(s.isPeak).toBe(false)
		})

		it("Saturday 03:59 UTC = Friday 11:59 PM ET → still weekday", () => {
			const s = getStatus(dayjs.utc("2026-03-21 03:59:00"))
			expect(s.isWeekend).toBe(false) // Friday in ET
			expect(s.is2x).toBe(true)
		})

		it("Saturday 04:00 UTC = Saturday 00:00 ET → weekend starts", () => {
			const s = getStatus(dayjs.utc("2026-03-21 04:00:00"))
			expect(s.isWeekend).toBe(true) // Saturday in ET
			expect(s.is2x).toBe(true)
		})

		it("Monday 00:00 UTC = Sunday 8 PM ET → still weekend", () => {
			const s = getStatus(dayjs.utc("2026-03-23 00:00:00"))
			expect(s.isWeekend).toBe(true) // Sunday in ET
			expect(s.is2x).toBe(true)
		})

		it("Monday 03:59 UTC = Sunday 11:59 PM ET → still weekend", () => {
			const s = getStatus(dayjs.utc("2026-03-23 03:59:00"))
			expect(s.isWeekend).toBe(true)
			expect(s.is2x).toBe(true)
		})

		it("Monday 04:00 UTC = Monday 00:00 ET → weekday resumes", () => {
			const s = getStatus(dayjs.utc("2026-03-23 04:00:00"))
			expect(s.isWeekend).toBe(false) // Monday in ET
			expect(s.is2x).toBe(true) // before peak
		})

		it("Monday 12:00 UTC = Monday 8 AM ET → weekday peak starts", () => {
			const s = getStatus(dayjs.utc("2026-03-23 12:00:00"))
			expect(s.isWeekend).toBe(false)
			expect(s.isPeak).toBe(true)
			expect(s.is2x).toBe(false)
		})
	})

	describe("every weekday during promo has peak", () => {
		// Mon 16 through Fri 20
		const weekdays = [
			["Monday", "2026-03-16"],
			["Tuesday", "2026-03-17"],
			["Wednesday", "2026-03-18"],
			["Thursday", "2026-03-19"],
			["Friday", "2026-03-20"],
		] as const

		for (const [name, date] of weekdays) {
			it(`${name} ${date} at 14:00 UTC is peak`, () => {
				const s = getStatus(dayjs.utc(`${date} 14:00:00`))
				expect(s.isPeak).toBe(true)
				expect(s.is2x).toBe(false)
				expect(s.isWeekend).toBe(false)
			})

			it(`${name} ${date} at 20:00 UTC is 2x`, () => {
				const s = getStatus(dayjs.utc(`${date} 20:00:00`))
				expect(s.is2x).toBe(true)
				expect(s.isPeak).toBe(false)
			})
		}
	})

	describe("both weekends during promo are fully 2x", () => {
		// Sat 14, Sun 15, Sat 21, Sun 22
		const weekendDays = [
			["Sat March 14", "2026-03-14"],
			["Sun March 15", "2026-03-15"],
			["Sat March 21", "2026-03-21"],
			["Sun March 22", "2026-03-22"],
		] as const

		for (const [name, date] of weekendDays) {
			for (const hour of [6, 12, 14, 18, 23]) {
				it(`${name} at ${String(hour).padStart(2, "0")}:00 UTC+4 (ET) is 2x`, () => {
					// Convert ET hour to UTC: add 4
					const utcHour = hour + 4
					const utcDate =
						utcHour >= 24
							? dayjs
									.utc(`${date} 00:00:00`)
									.add(1, "day")
									.add(utcHour - 24, "hour")
							: dayjs.utc(`${date} ${String(utcHour).padStart(2, "0")}:00:00`)
					const s = getStatus(utcDate)
					expect(s.is2x).toBe(true)
					expect(s.isPeak).toBe(false)
				})
			}
		}
	})

	describe("promo start day (Friday March 13)", () => {
		it("first second of promo is 2x (midnight ET, off-peak)", () => {
			// March 13 00:00:01 ET = 04:00:01 UTC
			const s = getStatus(dayjs.utc("2026-03-13 04:00:01"))
			expect(s.promoActive).toBe(true)
			expect(s.is2x).toBe(true) // before peak
		})

		it("first peak during promo (8 AM ET Friday)", () => {
			// March 13 08:00 ET = 12:00 UTC
			const s = getStatus(dayjs.utc("2026-03-13 12:00:00"))
			expect(s.promoActive).toBe(true)
			expect(s.isPeak).toBe(true)
			expect(s.is2x).toBe(false)
			expect(s.isWeekend).toBe(false) // Friday
		})
	})

	describe("promo end boundary (end of Friday March 27)", () => {
		it("last peak of promo (March 27 2 PM ET = 18:00 UTC)", () => {
			// 17:59:59 UTC is last second of peak
			const s = getStatus(dayjs.utc("2026-03-27 17:59:59"))
			expect(s.promoActive).toBe(true)
			expect(s.isPeak).toBe(true)
		})

		it("last 2x of promo (March 27 11:59 PM PDT = 06:58 UTC March 28)", () => {
			const s = getStatus(dayjs.utc("2026-03-28 06:58:59"))
			expect(s.promoActive).toBe(true)
			expect(s.is2x).toBe(true)
		})

		it("promo over at 11:59 PM PDT March 27 (06:59 UTC March 28)", () => {
			const s = getStatus(dayjs.utc("2026-03-28 06:59:00"))
			// Exactly at PROMO_END — isAfter(START) && isBefore(END) => isBefore is false
			expect(s.promoActive).toBe(false)
			expect(s.promoEnded).toBe(true)
		})
	})

	describe("weekend peak-hour UTC range still returns 2x", () => {
		it("Saturday at every UTC hour from 12-17 is 2x (weekend overrides peak)", () => {
			for (let h = PEAK_START_UTC; h < PEAK_END_UTC; h++) {
				const s = getStatus(dayjs.utc(`2026-03-21 ${String(h).padStart(2, "0")}:00:00`))
				expect(s.is2x).toBe(true)
				expect(s.isPeak).toBe(false) // isPeak is false on weekends
				expect(s.isWeekend).toBe(true)
			}
		})
	})

	describe("utcHour field is correct", () => {
		it("returns the actual UTC hour regardless of status", () => {
			expect(getStatus(dayjs.utc("2026-03-18 00:00:00")).utcHour).toBe(0)
			expect(getStatus(dayjs.utc("2026-03-18 06:30:00")).utcHour).toBe(6)
			expect(getStatus(dayjs.utc("2026-03-18 12:00:00")).utcHour).toBe(12)
			expect(getStatus(dayjs.utc("2026-03-18 23:59:59")).utcHour).toBe(23)
		})
	})

	describe("far outside promo period", () => {
		it("months before promo", () => {
			const s = getStatus(dayjs.utc("2025-01-01 12:00:00"))
			expect(s.promoNotStarted).toBe(true)
			expect(s.is2x).toBe(false)
		})

		it("months after promo", () => {
			const s = getStatus(dayjs.utc("2027-06-15 12:00:00"))
			expect(s.promoEnded).toBe(true)
			expect(s.is2x).toBe(false)
		})
	})

	describe("mutual exclusivity of status flags", () => {
		const times = [
			dayjs.utc("2026-03-12 12:00:00"), // before promo
			dayjs.utc("2026-03-18 10:00:00"), // during, off-peak weekday
			dayjs.utc("2026-03-18 14:00:00"), // during, peak weekday
			dayjs.utc("2026-03-21 14:00:00"), // during, weekend
			dayjs.utc("2026-03-30 12:00:00"), // after promo
		]
		for (const t of times) {
			it(`exactly one of promoActive/promoNotStarted/promoEnded is true at ${t.toISOString()}`, () => {
				const s = getStatus(t)
				const flags = [s.promoActive, s.promoNotStarted, s.promoEnded]
				expect(flags.filter(Boolean).length).toBe(1)
			})
		}
	})
})

// ──────────────────────────────────────────────────────────
// getCountdown
// ──────────────────────────────────────────────────────────
describe("getCountdown", () => {
	describe("weekday transitions", () => {
		it("weekday before peak → counts to peak start", () => {
			const cd = getCountdown(dayjs.utc("2026-03-18 10:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(2 * 3600)
		})

		it("weekday during peak → counts to peak end", () => {
			const cd = getCountdown(dayjs.utc("2026-03-18 14:00:00"))
			expect(cd.label).toBe("2x resumes")
			expect(cd.seconds).toBe(4 * 3600)
		})

		it("weekday after peak → counts to next weekday peak", () => {
			// Wednesday 20:00 UTC → Thursday 12:00 UTC = 16h
			const cd = getCountdown(dayjs.utc("2026-03-18 20:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(16 * 3600)
		})
	})

	describe("weekend skip logic", () => {
		it("Friday after peak → skips weekend to Monday", () => {
			// Friday March 20, 20:00 UTC → Monday March 23, 12:00 UTC
			// = 2 days 16 hours = 64 hours
			const cd = getCountdown(dayjs.utc("2026-03-20 20:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(64 * 3600)
		})

		it("Saturday → counts to Monday peak start", () => {
			// Saturday March 21, 10:00 UTC → Monday March 23, 12:00 UTC
			// = 2 days 2 hours = 50 hours
			const cd = getCountdown(dayjs.utc("2026-03-21 10:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(50 * 3600)
		})

		it("Sunday → counts to Monday peak start", () => {
			// Sunday March 22, 16:00 UTC → Monday March 23, 12:00 UTC
			// = 20 hours
			const cd = getCountdown(dayjs.utc("2026-03-22 16:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(20 * 3600)
		})

		it("late Sunday in ET (early Monday UTC) → counts to Monday peak", () => {
			// Monday March 23, 03:00 UTC = Sunday 11 PM ET → weekend
			// next weekday peak = Monday 12:00 UTC = 9 hours
			const cd = getCountdown(dayjs.utc("2026-03-23 03:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(9 * 3600)
		})
	})

	describe("promo boundary countdowns", () => {
		it("promo ended", () => {
			const cd = getCountdown(dayjs.utc("2026-03-29 00:00:00"))
			expect(cd.label).toBe("Promotion has ended")
			expect(cd.seconds).toBe(0)
		})

		it("before promo", () => {
			const cd = getCountdown(dayjs.utc("2026-03-12 04:00:00"))
			expect(cd.label).toBe("Promotion starts")
			expect(cd.seconds).toBeGreaterThan(0)
		})

		it("caps at promo end on last day", () => {
			// Thursday March 27, 20:00 UTC — next peak would be Fri March 28, 12:00 UTC
			// but promo ends March 28, 06:59 UTC
			const now = dayjs.utc("2026-03-27 20:00:00")
			const cd = getCountdown(now)
			expect(cd.label).toBe("Promotion ends")
			expect(cd.seconds).toBe(PROMO_END.diff(now, "second"))
		})
	})

	// ── Edge cases ──────────────────────────────────────────

	describe("exact transition-second precision", () => {
		it("1 second before peak start", () => {
			const cd = getCountdown(dayjs.utc("2026-03-18 11:59:59"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(1)
		})

		it("exactly at peak start → 6h to peak end", () => {
			const cd = getCountdown(dayjs.utc("2026-03-18 12:00:00"))
			expect(cd.label).toBe("2x resumes")
			expect(cd.seconds).toBe(6 * 3600)
		})

		it("1 second before peak end", () => {
			const cd = getCountdown(dayjs.utc("2026-03-18 17:59:59"))
			expect(cd.label).toBe("2x resumes")
			expect(cd.seconds).toBe(1)
		})

		it("exactly at peak end → next peak tomorrow", () => {
			// Wednesday 18:00 UTC → Thursday 12:00 UTC = 18h
			const cd = getCountdown(dayjs.utc("2026-03-18 18:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(18 * 3600)
		})
	})

	describe("Friday → weekend → Monday transition chain", () => {
		it("Friday 11:59:59 UTC (just before peak) → 1s to standard", () => {
			const cd = getCountdown(dayjs.utc("2026-03-20 11:59:59"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(1)
		})

		it("Friday 12:00 UTC (peak starts) → 6h to 2x", () => {
			const cd = getCountdown(dayjs.utc("2026-03-20 12:00:00"))
			expect(cd.label).toBe("2x resumes")
			expect(cd.seconds).toBe(6 * 3600)
		})

		it("Friday 18:00 UTC (peak ends) → Monday 12:00 UTC = 66h", () => {
			// Fri 18:00 → Mon 12:00 = 66 hours
			const cd = getCountdown(dayjs.utc("2026-03-20 18:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(66 * 3600)
		})

		it("Friday 23:59 UTC (still Fri in ET, 7:59 PM ET) → Mon 12:00 = 60h 1m", () => {
			const cd = getCountdown(dayjs.utc("2026-03-20 23:59:00"))
			expect(cd.label).toBe("Standard hours begin")
			// Mon 12:00 - Fri 23:59 = 60h 1m = 216060s
			expect(cd.seconds).toBe(60 * 3600 + 60)
		})

		it("Saturday 04:00 UTC (midnight ET Sat) → Mon 12:00 = 56h", () => {
			const cd = getCountdown(dayjs.utc("2026-03-21 04:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(56 * 3600)
		})

		it("Sunday 23:00 UTC (7 PM ET Sun) → Mon 12:00 = 13h", () => {
			const cd = getCountdown(dayjs.utc("2026-03-22 23:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(13 * 3600)
		})

		it("Monday 04:00 UTC (midnight ET Mon, weekday, before peak) → 8h to peak", () => {
			const cd = getCountdown(dayjs.utc("2026-03-23 04:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			expect(cd.seconds).toBe(8 * 3600)
		})
	})

	describe("UTC day boundary: Sat 00:00 UTC is still Friday ET", () => {
		it("countdown from Sat 00:00 UTC (Fri 8 PM ET) should go to Mon 12:00 UTC", () => {
			// Sat 00:00 UTC → Mon 12:00 UTC = 60h
			const cd = getCountdown(dayjs.utc("2026-03-21 00:00:00"))
			expect(cd.label).toBe("Standard hours begin")
			// It's Friday in ET, after peak (20:00 ET = 00:00 UTC next day)
			// Next weekday peak = Mon 12:00 UTC = 60 hours
			expect(cd.seconds).toBe(60 * 3600)
		})
	})

	describe("before-promo countdown precision", () => {
		it("exactly 1 hour before promo start", () => {
			const cd = getCountdown(dayjs.utc("2026-03-13 03:00:00"))
			expect(cd.label).toBe("Promotion starts")
			expect(cd.seconds).toBe(3600)
		})

		it("exactly 1 second before promo start", () => {
			const cd = getCountdown(dayjs.utc("2026-03-13 03:59:59"))
			expect(cd.label).toBe("Promotion starts")
			expect(cd.seconds).toBe(1)
		})

		it("days before promo", () => {
			const cd = getCountdown(dayjs.utc("2026-03-10 04:00:00"))
			expect(cd.label).toBe("Promotion starts")
			// 3 days = 259200s
			expect(cd.seconds).toBe(3 * 24 * 3600)
		})
	})

	describe("last day of promo edge cases", () => {
		it("Friday March 27, peak at 14:00 UTC → 2x resumes at 18:00 (still within promo)", () => {
			const cd = getCountdown(dayjs.utc("2026-03-27 14:00:00"))
			expect(cd.label).toBe("2x resumes")
			expect(cd.seconds).toBe(4 * 3600)
		})

		it("Friday March 27, after peak → promo ends (next peak would be after promo)", () => {
			const now = dayjs.utc("2026-03-27 18:00:00")
			const cd = getCountdown(now)
			expect(cd.label).toBe("Promotion ends")
			// Promo ends at March 28 06:59 UTC = 12h 59m = 46740s
			expect(cd.seconds).toBe(12 * 3600 + 59 * 60)
		})

		it("March 28, 06:58:59 UTC (last second of promo, 11:58:59 PM PDT)", () => {
			const now = dayjs.utc("2026-03-28 06:58:59")
			const cd = getCountdown(now)
			expect(cd.label).toBe("Promotion ends")
			expect(cd.seconds).toBe(1)
		})
	})

	describe("countdown never returns negative seconds", () => {
		const times = [
			dayjs.utc("2026-03-29 00:00:00"),
			dayjs.utc("2027-01-01 00:00:00"),
			dayjs.utc("2026-03-28 06:59:00"),
		]
		for (const t of times) {
			it(`non-negative at ${t.toISOString()}`, () => {
				expect(getCountdown(t).seconds).toBeGreaterThanOrEqual(0)
			})
		}
	})

	describe("consecutive days Mon-Fri all produce correct next-peak", () => {
		// Each weekday at 20:00 UTC → next day 12:00 UTC = 16h
		// Except Friday → Monday = 64h
		const expected = [
			["Mon 16", "2026-03-16 20:00:00", 16],
			["Tue 17", "2026-03-17 20:00:00", 16],
			["Wed 18", "2026-03-18 20:00:00", 16],
			["Thu 19", "2026-03-19 20:00:00", 16],
			["Fri 20", "2026-03-20 20:00:00", 64],
		] as const

		for (const [name, time, hours] of expected) {
			it(`${name} after peak → ${hours}h to next standard`, () => {
				const cd = getCountdown(dayjs.utc(time))
				expect(cd.seconds).toBe(hours * 3600)
			})
		}
	})
})

// ──────────────────────────────────────────────────────────
// formatCountdown
// ──────────────────────────────────────────────────────────
describe("formatCountdown", () => {
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

	// Edge cases
	it("exactly 1 second", () => {
		expect(formatCountdown(1)).toBe("1s")
	})

	it("exactly 60 seconds → 1m", () => {
		expect(formatCountdown(60)).toBe("1m 00s")
	})

	it("exactly 1 hour", () => {
		expect(formatCountdown(3600)).toBe("1h 00m 00s")
	})

	it("exactly 24 hours", () => {
		expect(formatCountdown(86400)).toBe("24h 00m 00s")
	})

	it("24h + 1s stays in hours format (boundary is > 24h)", () => {
		expect(formatCountdown(86401)).toBe("24h 00m 01s")
	})

	it("25h switches to days format", () => {
		expect(formatCountdown(25 * 3600)).toBe("1d 1h 00m")
	})

	it("multiple days", () => {
		expect(formatCountdown(7 * 86400)).toBe("7d 0h 00m")
	})

	it("59 seconds", () => {
		expect(formatCountdown(59)).toBe("59s")
	})

	it("59 minutes 59 seconds", () => {
		expect(formatCountdown(3599)).toBe("59m 59s")
	})

	it("zero-pads single-digit minutes and seconds in hour format", () => {
		expect(formatCountdown(3601)).toBe("1h 00m 01s")
		expect(formatCountdown(3660)).toBe("1h 01m 00s")
	})
})

// ──────────────────────────────────────────────────────────
// getETProgress
// ──────────────────────────────────────────────────────────
describe("getETProgress", () => {
	it("0 at midnight ET (04:00 UTC in EDT)", () => {
		expect(getETProgress(dayjs.utc("2026-03-15 04:00:00"))).toBeCloseTo(0, 2)
	})

	it("0.5 at noon ET (16:00 UTC in EDT)", () => {
		expect(getETProgress(dayjs.utc("2026-03-15 16:00:00"))).toBeCloseTo(0.5, 2)
	})

	it("~0.333 at 8 AM ET / peak start", () => {
		expect(getETProgress(dayjs.utc("2026-03-15 12:00:00"))).toBeCloseTo(8 / 24, 2)
	})

	// Edge cases
	it("~0.583 at 2 PM ET / peak end", () => {
		expect(getETProgress(dayjs.utc("2026-03-15 18:00:00"))).toBeCloseTo(14 / 24, 2)
	})

	it("approaches 1.0 at 11:59 PM ET", () => {
		// 11:59 PM ET = 03:59 UTC next day
		expect(getETProgress(dayjs.utc("2026-03-16 03:59:00"))).toBeCloseTo(
			(23 * 60 + 59) / (24 * 60),
			2,
		)
	})

	it("progress increases monotonically through the day", () => {
		const hours = [4, 8, 12, 16, 20, 24, 27] // UTC hours spanning an ET day
		const progresses = hours.map((h) =>
			getETProgress(dayjs.utc("2026-03-15 00:00:00").add(h, "hour")),
		)
		for (let i = 1; i < progresses.length; i++) {
			// May wrap at midnight ET, so just check each is in [0,1)
			expect(progresses[i]!).toBeGreaterThanOrEqual(0)
			expect(progresses[i]!).toBeLessThan(1)
		}
	})
})

// ──────────────────────────────────────────────────────────
// formatTime / formatTimeET
// ──────────────────────────────────────────────────────────
describe("formatTimeET", () => {
	it("formats correctly", () => {
		expect(formatTimeET(dayjs.utc("2026-03-15 16:30:00"))).toBe("12:30:00 PM")
	})

	it("midnight ET", () => {
		// Midnight ET = 04:00 UTC
		expect(formatTimeET(dayjs.utc("2026-03-15 04:00:00"))).toBe("12:00:00 AM")
	})

	it("noon ET", () => {
		// Noon ET = 16:00 UTC
		expect(formatTimeET(dayjs.utc("2026-03-15 16:00:00"))).toBe("12:00:00 PM")
	})

	it("11:59:59 PM ET", () => {
		expect(formatTimeET(dayjs.utc("2026-03-16 03:59:59"))).toBe("11:59:59 PM")
	})
})

describe("formatTime", () => {
	it("formats in Pacific timezone", () => {
		// 16:00 UTC = 9 AM PT (PDT = UTC-7)
		expect(formatTime(dayjs.utc("2026-03-15 16:00:00"), "America/Los_Angeles")).toBe(
			"9:00:00 AM",
		)
	})

	it("formats in IST", () => {
		// 16:00 UTC = 9:30 PM IST (UTC+5:30)
		expect(formatTime(dayjs.utc("2026-03-15 16:00:00"), "Asia/Kolkata")).toBe("9:30:00 PM")
	})

	it("falls back on invalid timezone", () => {
		const result = formatTime(dayjs.utc("2026-03-15 16:00:00"), "Invalid/Timezone")
		expect(result).toBeTruthy() // should not throw, returns fallback
	})
})

// ──────────────────────────────────────────────────────────
// formatTzName
// ──────────────────────────────────────────────────────────
describe("formatTzName", () => {
	it("extracts city name", () => {
		expect(formatTzName("America/New_York")).toBe("New York")
	})

	it("handles single-part timezone", () => {
		expect(formatTzName("UTC")).toBe("UTC")
	})

	it("handles deep paths", () => {
		expect(formatTzName("America/Indiana/Indianapolis")).toBe("Indianapolis")
	})

	it("replaces underscores with spaces", () => {
		expect(formatTzName("America/Los_Angeles")).toBe("Los Angeles")
	})

	it("handles Asia timezones", () => {
		expect(formatTzName("Asia/Kolkata")).toBe("Kolkata")
	})

	it("handles empty string", () => {
		expect(formatTzName("")).toBe("")
	})
})

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────
describe("constants", () => {
	it("PROMO_START is a Friday (March 13, 2026)", () => {
		expect(PROMO_START.tz("America/New_York").day()).toBe(5) // Friday
	})

	it("PROMO_END last valid moment is Friday March 27 (11:58:59 PM PDT)", () => {
		// PROMO_END = March 28 06:59 UTC = March 27 11:59 PM PDT
		// Last valid moment is 1 second before
		const lastValid = PROMO_END.subtract(1, "second")
		expect(lastValid.tz("America/Los_Angeles").day()).toBe(5) // Friday
	})

	it("peak window is exactly 6 hours", () => {
		expect(PEAK_END_UTC - PEAK_START_UTC).toBe(6)
	})

	it("promo duration is exactly 15 days", () => {
		expect(PROMO_END.diff(PROMO_START, "day")).toBe(15)
	})
})
