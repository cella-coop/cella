// A page's card, the picture a link to it shows where it is shared
// (index.md, the card): each page a build keeps, rendered once at build.
import type { APIRoute } from 'astro'
import { pageCards, render, type Card } from '../../lib/card'

export async function getStaticPaths() {
  return (await pageCards()).map((card) => ({ params: { page: card.key }, props: { card } }))
}

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await render((props as { card: Card }).card)), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=86400' } })
