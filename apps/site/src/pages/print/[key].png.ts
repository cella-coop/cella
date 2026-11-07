// A print's mask as its own file (index.md, prints): each photo at each
// width, made once at build and cached by the browser like any image.
import type { APIRoute } from 'astro'
import { mask, maskKeys } from '../../lib/print'

export function getStaticPaths() {
  return maskKeys().map(({ name, width }) => ({ params: { key: `${name}-${width}` }, props: { name, width } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await mask(props.name, props.width)), { headers: { 'content-type': 'image/png' } })
