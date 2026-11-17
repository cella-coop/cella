import { action, type Body, type Db, type Form } from '@cella/org-db'
import { b64 } from '@cella/org-body/models'
import type { BodySaveTerms } from '../models/body-terms.ts'
import { saveBodyTerms } from '../handlers/body-terms.ts'
import { bodiedTerms, bodyCircleTerms, savedBodyTerms } from '../drivers/body-terms.ts'

// A record's body: the save its page's editor posts, the mount handing
// core body's session the record's bodies and that save, and its page's
// item with its body.

export function savingTerms(form: Form, id: string): BodySaveTerms {
  const snapshot = form.get('snapshot')
  if (!snapshot) {
    throw new Error('a save carries the body’s snapshot')
  }
  return { terms: id, snapshot: b64.decode(snapshot), base: form.get('base'), contributors: form.all('contributor') }
}

export const bodyActionsTerms = {
  save: action('patronage:body:save-terms', (form, id) => savingTerms(form, id ?? ''), saveBodyTerms),
}

export const bodyMountTerms: Body = { circle: bodyCircleTerms, saved: savedBodyTerms, save: 'save' }

export const withBodyTerms =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Awaited<ReturnType<typeof bodiedTerms>>) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await bodiedTerms(db, id)) }
  }
