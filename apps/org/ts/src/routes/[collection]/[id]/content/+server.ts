import { error } from '@sveltejs/kit'
import { using } from '#lib/server/db.ts'
import { mounted } from '#lib/server/slices.ts'
import type { RequestHandler } from './$types'

// What a browser may show in place: pictures, PDFs and plain text. Any
// other kind, a page or a script among them, is only ever downloaded.
const shown = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'])

// An item's bytes, such as a stored file, for the acting member: served
// where its owner's rule opens it to them, or else an extension's, as a
// power over expenses opens their receipts; refused otherwise.
export const GET: RequestHandler = ({ params, locals }) =>
  using(async (db) => {
    const m = mounted(params.collection)
    const content = m?.collection.content
    if (!m || !content) {
      error(404, `${params.collection} holds no files`)
    }
    const found = await content(db, params.id, locals.actor)
    if (!found) {
      error(404, `${params.collection} has no ${params.id}, or its bytes were erased`)
    }
    let open = found.open
    for (const e of m.extensions) {
      open ||= (await e.extension.allows?.(db, params.id, locals.actor)) ?? false
    }
    if (!open) {
      error(403, `${locals.actor ?? 'no one'} may not open ${params.id}`)
    }
    const disposition = shown.has(found.type) ? 'inline' : 'attachment'
    return new Response(found.bytes as Uint8Array<ArrayBuffer>, {
      headers: {
        'content-type': shown.has(found.type) ? found.type : 'application/octet-stream',
        'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(found.name)}`,
        'content-security-policy': 'sandbox',
        'x-content-type-options': 'nosniff',
        'cache-control': 'private, no-store',
      },
    })
  })
