// Whose a statement is, by name, when the worker is a member.
export interface Named {
  member: string
  name: string
}

// The work share's terms in force, as a member's page reads them back:
// how it divides, by pay, time worked or in equal parts, in percent, and
// what part of an associate's share buys capital.
export interface Statutes {
  terms: string
  salary: number
  hours: number
  equal: number
  capital: number
}
