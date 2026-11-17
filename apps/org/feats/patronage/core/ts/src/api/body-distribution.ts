import { action, type Body, type Db, type Form } from '@cella/org-db'
import { b64 } from '@cella/org-body/models'
import type { BodySaveDistribution } from '../models/body-distribution.ts'
import { saveBodyDistribution } from '../handlers/body-distribution.ts'
import { bodiedDistribution, bodyCircleDistribution, savedBodyDistribution } from '../drivers/body-distribution.ts'

// A record's body: the save its page's editor posts, the mount handing
// core body's session the record's bodies and that save, and its page's
// item with its body.

export function savingDistribution(form: Form, id: string): BodySaveDistribution {
  const snapshot = form.get('snapshot')
  if (!snapshot) {
    throw new Error('a save carries the body’s snapshot')
  }
  return { distribution: id, snapshot: b64.decode(snapshot), base: form.get('base'), contributors: form.all('contributor') }
}

export const bodyActionsDistribution = {
  save: action('patronage:body:save-distribution', (form, id) => savingDistribution(form, id ?? ''), saveBodyDistribution),
}

export const bodyMountDistribution: Body = { circle: bodyCircleDistribution, saved: savedBodyDistribution, save: 'save' }

export const withBodyDistribution =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Awaited<ReturnType<typeof bodiedDistribution>>) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await bodiedDistribution(db, id)) }
  }
