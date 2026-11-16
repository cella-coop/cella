import { open, post } from '@cella/org-body/api'
import { session } from '#lib/server/body.ts'
import type { RequestHandler } from './$types'

// A record's body, live: core body's session, as server-sent events to
// each editor that opens it, and the updates and saves each posts back,
// whatever the kind of record that keeps it.
export const GET: RequestHandler = ({ params, request, locals }) =>
  open(session, { kind: params.collection, record: params.id, actor: locals.actor, request })

export const POST: RequestHandler = ({ params, request, locals }) =>
  post(session, { kind: params.collection, record: params.id, actor: locals.actor, request })
