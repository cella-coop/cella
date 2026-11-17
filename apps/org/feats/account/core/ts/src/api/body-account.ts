import { action, type Body, type Db, type Form } from '@cella/org-db'
import { b64 } from '@cella/org-body/models'
import type { BodySaveAccount } from '../models/body-account.ts'
import { saveBodyAccount } from '../handlers/body-account.ts'
import { bodiedAccount, bodyCircleAccount, savedBodyAccount } from '../drivers/body-account.ts'

// A record's body: the save its page's editor posts, the mount handing
// core body's session the record's bodies and that save, and its page's
// item with its body.

export function savingAccount(form: Form, id: string): BodySaveAccount {
  const snapshot = form.get('snapshot')
  if (!snapshot) {
    throw new Error('a save carries the body’s snapshot')
  }
  return { account: id, snapshot: b64.decode(snapshot), base: form.get('base'), contributors: form.all('contributor') }
}

export const bodyActionsAccount = {
  save: action('account:body:save-account', (form, id) => savingAccount(form, id ?? ''), saveBodyAccount),
}

export const bodyMountAccount: Body = { circle: bodyCircleAccount, saved: savedBodyAccount, save: 'save' }

export const withBodyAccount =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Awaited<ReturnType<typeof bodiedAccount>>) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await bodiedAccount(db, id)) }
  }
