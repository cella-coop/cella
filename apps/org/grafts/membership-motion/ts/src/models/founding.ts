import type { Db } from '@cella/org-db'

// A coop as it is founded: the legal form it chose, by its id in the
// register (`scop-sarl-fr`); its founding motion, by its id
// (`m-2026-001`), the root's motion its founders decided, which adopts
// the form's defaults; and `load`, which writes its founders, their
// devices and memberships, its root circle and their seats, and that
// motion with their stances and the policies it adopts, inside the
// write's transaction, and answers how many rows of each kind it wrote;
// for a mock coop, the state it held before its log too. `from` names
// where the founding came from, such as a fixture.
export interface Founding {
  form: string
  motion: string
  from: string
  load: (tx: Db) => Promise<Record<string, number>>
}

// A coop as it was founded: the legal form it chose, its founding
// motion, where the founding came from, how many rows of each kind it
// wrote, and the rows it carries: each state table's, by its name, a
// personal value marked for the vault, and the value each sequence
// reached (`cella.carry`).
export interface Founded {
  form: string
  motion: string
  from: string
  founded: Record<string, number>
  carried: { tables: { table: string; rows: Record<string, unknown>[] }[]; sequences: Record<string, number> }
}
