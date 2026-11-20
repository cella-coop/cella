import { createContext } from 'svelte'

const [get, set, has] = createContext<() => Record<string, string>>()

// Why the reader may not make each write of the page, by the write's
// name, as the server judged them before they are made: a record's page
// names them (`Detail`), and a form that is its one button asks for its
// own, drawn unavailable with the reason as its tooltip.
export function judging(refused: () => Record<string, string>) {
  set(refused)
}

// Why the reader may not make a write of the page, or nothing, where it
// may or no page judged it.
export function useRefusals(): (write: string) => string | undefined {
  const refused = has() ? get() : () => ({}) as Record<string, string>
  return (write) => refused()[write]
}
