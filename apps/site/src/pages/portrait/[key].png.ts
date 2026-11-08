// A person's portrait as its own file (index.md, the people): each picture
// in `src/people/`, engraved once at build and cached by the browser.
import type { APIRoute } from 'astro'
import { engrave, peopleNames, PORTRAIT } from '../../lib/engrave'

export function getStaticPaths() {
  return peopleNames().map((name) => ({ params: { key: `${name}-${PORTRAIT}` }, props: { name } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await engrave(props.name, PORTRAIT, 'person')), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' } })
