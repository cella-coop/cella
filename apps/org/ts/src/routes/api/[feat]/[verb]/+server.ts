import { called, fetched, reply } from '#lib/server/api.ts'
import { item } from '#lib/server/calls.ts'
import { commands } from '#lib/server/slices.ts'
import { failed, owner, perform, relayed } from '#lib/server/write.ts'
import type { RequestHandler } from './$types'

// A command over HTTP, for a client with no page: the write a page's form
// runs, as the session's person, signed by its device through the relay.
// The post that starts it, and each proof posted back to the run, is
// answered with what to sign, 202, or the outcome. JSON alone is taken,
// so no other site's page posts here as a form with a member's cookie.
export const POST: RequestHandler = async ({ params, request, locals }) => {
  const forms = commands(params.feat, params.verb)
  if (!forms.length) {
    return reply(failed(404, `no command is served at /api/${params.feat}/${params.verb}`))
  }
  const op = forms[0]!.action.op
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
    return reply(failed(415, 'a command is posted as application/json', op))
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply(failed(400, 'the body is no JSON', op))
  }
  const checked = called['~standard'].validate(body)
  if ('issues' in checked) {
    return reply(failed(400, checked.issues.map((i) => i.message).join('; '), op))
  }
  const s = locals.session
  if (!s) {
    return reply(failed(401, 'sign in first', op))
  }
  const who = { actor: s.actor, device: s.device }
  const given = checked.value
  if ('run' in given) {
    return reply(await relayed(owner(who), given.run, JSON.stringify(given.proof)))
  }
  const named = forms.map((f) => `${f.collection}.${f.write}`)
  const form = given.form ? forms[named.indexOf(given.form)] : forms.length === 1 ? forms[0] : undefined
  if (!form) {
    const which = given.form ? `${given.form} does not serve ${op}` : `${op} is served by more than one form`
    return reply(failed(400, `${which}: name one as form, ${named.join(', ')}`, op))
  }
  return reply(await perform(who, form.action, given.fields, given.id))
}

// An item over HTTP, at `/api/<collection>/<id>`, which shares the
// command's shape and differs by method: the query the item's page reads,
// each extension's data on it, as JSON, the query string what the page's
// address takes.
export const GET: RequestHandler = ({ params, url, locals, cookies }) =>
  fetched(item, { name: params.feat, id: params.verb, search: url.search }, locals, cookies)
