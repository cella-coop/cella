import { fetched } from '#lib/server/api.ts'
import { collection } from '#lib/server/calls.ts'
import type { RequestHandler } from './$types'

// A collection over HTTP, for a client with no page: the query its page
// reads, its rows a page at a time with its counts, its values and its
// about, as JSON, the query string what the page's address takes, the
// view, the filter and the page.
export const GET: RequestHandler = ({ params, url, locals, cookies }) =>
  fetched(collection, { name: params.collection, search: url.search }, locals, cookies)
