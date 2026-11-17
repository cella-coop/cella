import { action, type Body, type Db, type Form } from '@cella/org-db'
import { b64 } from '@cella/org-body/models'
import type { BodySavePeriod } from '../models/body-period.ts'
import { saveBodyPeriod } from '../handlers/body-period.ts'
import { bodiedPeriod, bodyCirclePeriod, savedBodyPeriod } from '../drivers/body-period.ts'

// A record's body: the save its page's editor posts, the mount handing
// core body's session the record's bodies and that save, and its page's
// item with its body.

export function savingPeriod(form: Form, id: string): BodySavePeriod {
  const snapshot = form.get('snapshot')
  if (!snapshot) {
    throw new Error('a save carries the body’s snapshot')
  }
  return { period: id, snapshot: b64.decode(snapshot), base: form.get('base'), contributors: form.all('contributor') }
}

export const bodyActionsPeriod = {
  save: action('account:body:save-period', (form, id) => savingPeriod(form, id ?? ''), saveBodyPeriod),
}

export const bodyMountPeriod: Body = { circle: bodyCirclePeriod, saved: savedBodyPeriod, save: 'save' }

export const withBodyPeriod =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Awaited<ReturnType<typeof bodiedPeriod>>) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await bodiedPeriod(db, id)) }
  }
