// An unprinted photo as its own file (index.md, figures): each photo, cut
// once at build to the print's width, and never inlined into a page.
import type { APIRoute } from 'astro'
import { plainPhoto, plainKeys } from '../../lib/photo'

export function getStaticPaths() {
  return plainKeys().map(({ name, width }) => ({ params: { key: `${name}-${width}` }, props: { name } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await plainPhoto(props.name)), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' } })
