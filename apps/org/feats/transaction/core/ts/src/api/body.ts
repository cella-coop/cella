import { action, type Body, type Db, type Form } from '@cella/org-db'
import { b64 } from '@cella/org-body/models'
import type { BodySave } from '../models/body.ts'
import { saveBody } from '../handlers/body.ts'
import { bodied, bodyCircle, savedBody } from '../drivers/body.ts'

// A record's body: the save its page's editor posts, the mount handing
// core body's session the record's bodies and that save, and its page's
// item with its body.

export function saving(form: Form, id: string): BodySave {
  const snapshot = form.get('snapshot')
  if (!snapshot) {
    throw new Error('a save carries the body’s snapshot')
  }
  return { transaction: id, snapshot: b64.decode(snapshot), base: form.get('base'), contributors: form.all('contributor') }
}

export const bodyActions = {
  save: action('transaction:body:save', (form, id) => saving(form, id ?? ''), saveBody),
}

export const bodyMount: Body = { circle: bodyCircle, saved: savedBody, save: 'save' }

export const withBody =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Awaited<ReturnType<typeof bodied>>) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await bodied(db, id)) }
  }
