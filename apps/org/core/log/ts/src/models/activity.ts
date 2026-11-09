// What an entry says in Activity: its op's verb in the past and its thing,
// and the record it links to, read from the ids `cella.records` gives,
// since an entry keeps nothing else of what a write was about.

// The verbs whose past is not their stem with -ed, and those said with
// more words; a verb that is a noun says what was done with it.
const pasts: Record<string, string> = {
  pay: 'paid',
  repay: 'repaid',
  send: 'sent',
  hold: 'held',
  read: 'read',
  spread: 'spread',
  draw: 'drew on',
  freeze: 'froze',
  forget: 'forgot',
  withdraw: 'withdrew',
  admit: 'admitted',
  submit: 'submitted',
  enrol: 'enrolled',
  cancel: 'cancelled',
  log: 'logged',
  comment: 'commented on',
  vote: 'voted on',
  payment: 'recorded a payment on',
  profile: 'updated the profile of',
}

export const past = (verb: string): string =>
  pasts[verb] ??
  (verb.endsWith('e') ? `${verb}d` : /[^aeiou]y$/.test(verb) ? `${verb.slice(0, -1)}ied` : `${verb}ed`)

// The things too general to say alone, named with their feat: a payslip
// run, an account period.
const general = new Set(['run', 'entry', 'period', 'item', 'terms', 'part', 'own'])

// The pages the shell shows a record of each kind on, by the name an
// entry's form holds its id under, or the general thing with its feat.
const pages: Record<string, string> = {
  account: 'accounts',
  bill: 'bills',
  circle: 'circles',
  contact: 'contacts',
  device: 'devices',
  distribution: 'distributions',
  document: 'documents',
  expense: 'expenses',
  file: 'files',
  'import run': 'imports',
  invoice: 'invoices',
  meeting: 'meetings',
  member: 'people',
  motion: 'motions',
  'account period': 'periods',
  person: 'people',
  project: 'projects',
  report: 'reports',
  task: 'tasks',
  transaction: 'transactions',
}

const article = (noun: string) => (/^[aeiou]/.test(noun) ? `an ${noun}` : `a ${noun}`)

export interface Said {
  text: string
  // The record's page, where the entry names a record the shell shows.
  href?: string
}

// `feat:thing:verb`, a graft's feats joined by `-`: the line says the verb
// and the thing, and links to the first record among the thing's and each
// feat's that has a page, the thing's first.
export function said(op: string, records: Record<string, string | number> = {}): Said {
  const [slice = '', thing = '', verb = ''] = op.split(':')
  const feats = slice.split('-')
  const noun = general.has(thing) && feats.length === 1 ? `${slice} ${thing}` : thing
  const kind = (k: string) => (k === thing ? noun : k)
  const found = [thing, ...feats].find((k) => records[k] !== undefined && pages[kind(k)])
  const done = past(verb)
  if (found === undefined) {
    return { text: `${done} ${article(noun)}` }
  }
  const id = String(records[found])
  const href = `/${pages[kind(found)]}/${encodeURIComponent(id)}`
  return found === thing ? { text: `${done} ${noun} ${id}`, href } : { text: `${done} ${article(noun)} in ${found} ${id}`, href }
}
