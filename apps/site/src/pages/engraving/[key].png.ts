// An engraving's mask as its own file (index.md, figures): each photo, cut
// once at build and cached by the browser like any image.
import type { APIRoute } from 'astro'
import { engrave, engravingKeys } from '../../lib/engrave'

export function getStaticPaths() {
  return engravingKeys().map(({ name, width }) => ({ params: { key: `${name}-${width}` }, props: { name, width } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await engrave(props.name, props.width)), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' } })
