// A photo engraved small, as a post's cover on the blog's index wears it
// (index.md, the pages): each photo of the library, engraved once at
// build and cached by the browser.
import type { APIRoute } from 'astro'
import { photoNames } from '../../lib/assets'
import { COVER, engrave } from '../../lib/engrave'

export function getStaticPaths() {
  return photoNames().map((name) => ({ params: { key: `${name}-${COVER}` }, props: { name } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await engrave(props.name, COVER, 'cover')), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' } })
