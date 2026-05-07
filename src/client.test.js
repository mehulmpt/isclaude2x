// Tests for static/client.js — minimal now that 2x is permanent.

import { describe, it, expect, beforeAll } from "vitest"

beforeAll(async () => {
	await import("../static/client.js")
})

describe("faviconSVG", () => {
	it("renders the 2x favicon in green", () => {
		const svg = faviconSVG()
		expect(svg).toContain(">2x<")
		expect(svg).toContain("#10b981")
		expect(svg.startsWith("<svg")).toBe(true)
		expect(svg.endsWith("</svg>")).toBe(true)
	})

	it("is data-URL encodable", () => {
		expect(() => encodeURIComponent(faviconSVG())).not.toThrow()
	})
})
