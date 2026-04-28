// The Claude March 2026 usage promotion has ended.
// Redirect all traffic to Mehul's Twitter.

const REDIRECT_URL = "https://x.com/mehulmpt"

export default {
	async fetch(_request: Request): Promise<Response> {
		return Response.redirect(REDIRECT_URL, 302)
	},
} satisfies ExportedHandler<Env>
