import type { Db } from '@cella/org-db'

// A co-op as it is founded: the legal form it chose, by its id in the
// register (`scop-sarl-fr`), and `load`, which writes its founders, their
// devices and memberships, its root circle and their seats, and the
// root's founding motion with the policies it adopts, inside the write's
// transaction, and answers how many rows of each kind it wrote; for a
// mock co-op, the state it held before its log too. `from` names where
// the founding came from, such as a fixture.
export interface Founding {
  form: string
  from: string
  load: (tx: Db) => Promise<Record<string, number>>
}

// A co-op as it was founded: the legal form it chose, where the founding
// came from and how many rows of each kind it wrote.
export interface Founded {
  form: string
  from: string
  founded: Record<string, number>
}
