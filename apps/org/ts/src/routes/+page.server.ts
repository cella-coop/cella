import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

// The co-op has no home page for now: `/` lands the member in their Inbox,
// what waits on them, until a better first page is designed.
export const load: PageServerLoad = () => {
  redirect(307, '/inbox')
}
