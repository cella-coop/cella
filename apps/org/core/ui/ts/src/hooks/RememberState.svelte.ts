import type { Person } from '../models/view.ts'
import { remember } from './kept.svelte.ts'

// A circle as the shell's selector reads it, whether the actor sits in
// it and whether it is the assembly, which this hook leaves out.
type Sat = { name: string; sits: boolean; assembly?: boolean }

// Signed in, remembers the actor's name and the circles they sit in on
// every device of theirs this browser keeps, the assembly left out, so a
// later sign-out shows them on the sign-in page without asking the
// server again (`remember`, `kept.svelte.ts`).
export class RememberState {
  constructor(scope: () => string, actor: () => Person | null, circles: () => Sat[]) {
    $effect(() => {
      const who = actor()
      if (who) {
        void remember(
          scope(),
          who.address,
          who.name,
          circles()
            .filter((c) => c.sits && !c.assembly)
            .map((c) => c.name),
        )
      }
    })
  }
}
