// A post's card, the picture a link to it shows where it is shared
// (index.md, the card): each post a build keeps, rendered once at build.
import type { APIRoute } from 'astro'
import { postCards, render, type Card } from '../../../lib/card'

export async function getStaticPaths() {
  return (await postCards()).map((card) => ({ params: { post: card.key }, props: { card } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await render((props as { card: Card }).card)), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' } })
