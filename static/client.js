// isclaude2x.com — the answer is now permanently YES.
// Effective May 6, 2026, after the SpaceX × Anthropic Colossus 1 deal.
// https://www.anthropic.com/news/higher-limits-spacex
//
// All this script does is set the "2x" favicon. No status logic, no countdowns —
// the page is fully static now.

function faviconSVG() {
	return (
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
		'<rect width="64" height="64" rx="14" fill="#080b16"/>' +
		'<text x="32" y="44" text-anchor="middle" font-family="system-ui,sans-serif"' +
		' font-weight="800" font-size="28" fill="#10b981">2x</text>' +
		"</svg>"
	)
}

if (typeof globalThis !== "undefined") {
	Object.assign(globalThis, { faviconSVG })
}

if (typeof document !== "undefined") {
	const link = document.getElementById("favicon")
	if (link) link.href = "data:image/svg+xml," + encodeURIComponent(faviconSVG())
}
