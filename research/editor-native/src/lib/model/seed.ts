import type { LoroDoc } from 'loro-crdt'
import { paste, type Fragment, type Run } from './ops.ts'

const p = (...runs: (string | Run)[]): Run[] => runs.map((r) => (typeof r === 'string' ? { text: r } : r))
const b = (text: string): Run => ({ text, marks: { bold: true } })

function service(name: string, unit: string, standard: string, solidarity: string): Fragment {
  return {
    type: 'bullet',
    runs: p(b(name), ` — per ${unit}`),
    children: [
      { type: 'bullet', runs: p('Standard: ', standard), children: [] },
      { type: 'bullet', runs: p('Solidarity: ', solidarity), children: [] },
    ],
  }
}

// Lanterne's rate card 2027 (fixtures/lanterne/document.toml, version 2),
// with its table as nested bullets: there is no table block yet.
export const rateCard: Fragment[] = [
  { type: 'heading', level: 1, runs: p('Rate card 2027'), children: [] },
  {
    type: 'paragraph',
    runs: p('Day rates and project floors for ', { text: '2027', marks: { italic: true } }, '. Associations and coops with fewer than ten staff pay the ', b('solidarity'), ' rate.'),
    children: [],
  },
  { type: 'decision', decision: 'd-2026-011', runs: [], children: [] },
  { type: 'heading', level: 2, runs: p('Services'), children: [] },
  service('Day of work', 'day', '560 €', '380 €'),
  service('Brand identity', 'project', 'from 6 500 €', 'from 3 300 €'),
  service('Website', 'project', 'from 12 000 €', 'from 7 500 €'),
  service('Online shop', 'project', 'from 9 500 €', 'from 6 000 €'),
  service('Marketing retainer', 'month', 'from 4 800 €', 'from 2 400 €'),
  { type: 'divider', runs: [], children: [] },
  { type: 'heading', level: 2, runs: p('Open questions'), children: [] },
  { type: 'quote', runs: p('Nuvola renews in January at the current rate; do we hold it for existing retainers? — malik'), children: [] },
  { type: 'todo', checked: false, runs: p('Decide whether existing retainers keep the 2026 rate'), children: [] },
  { type: 'todo', checked: true, runs: p('Add the ', { text: 'Online shop', marks: { code: true } }, ' line'), children: [] },
  { type: 'numbered', runs: p('Coordination proposes'), children: [] },
  { type: 'numbered', runs: p('The general meeting ', { text: 'decides', marks: { link: 'https://corpus.pub' } }), children: [] },
  { type: 'code', language: 'toml', runs: p('[rate]\nday = 560\nsolidarity = 380'), children: [] },
]

export function seed(doc: LoroDoc): void {
  paste(doc, undefined, 0, rateCard)
  doc.commit({ origin: 'seed' })
}
