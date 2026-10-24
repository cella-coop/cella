import { error } from '@sveltejs/kit'
import { using } from '#lib/server/db.ts'
import { mounted } from '#lib/server/slices.ts'
import type { RequestHandler } from './$types'

// An item's live stream, as server-sent events: the collection's owner
// names its streams, and this serves them, whatever the kind of item.
export const GET: RequestHandler = ({ params, request, url }) => {
  const stream = mounted(params.collection)?.collection.streams?.[params.stream]
  if (!stream) {
    error(404, `${params.collection} has no stream ${params.stream}`)
  }
  const body = stream({ using, id: params.id, url, last: request.headers.get('last-event-id'), signal: request.signal })
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
  })
}
