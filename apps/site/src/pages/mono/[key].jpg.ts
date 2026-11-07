// A photo in one ink as its own file (index.md, the plate): each photo at
// a plate's widths, made once at build and cached like any image.
import type { APIRoute } from 'astro'
import { mono, monoKeys } from '../../lib/print'

export function getStaticPaths() {
  return monoKeys().map(({ name, width }) => ({ params: { key: `${name}-${width}` }, props: { name, width } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await mono(props.name, props.width)), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' } })
