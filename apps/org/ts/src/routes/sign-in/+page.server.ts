import { safe } from '#lib/server/back.ts'
import { fixtures } from '#lib/server/device.ts'
import type { PageServerLoad } from './$types'

// The sign-in page: where to go once signed in, the Inbox unless asked,
// and, on the dev server alone, the fixture members it offers.
export const load: PageServerLoad = async ({ url }) => ({ back: safe(url.searchParams.get('back') ?? '/inbox'), fixtures: await fixtures() })
