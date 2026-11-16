import { createContext } from 'svelte'
import { CreateState } from './CreateState.svelte.ts'

const [get, set, has] = createContext<CreateState>()

// The New dialog of the collection a component is drawn in: the
// Collection makes it, and a Form under it is a create form, which ends
// in Cancel beside its confirming button, closes the dialog once its
// write settles and says inside it why one was refused.
export function useCreate(): CreateState {
  if (has()) {
    return get()
  }
  return set(new CreateState())
}

// The New dialog a component sits in, if any.
export function inCreate(): CreateState | undefined {
  return has() ? get() : undefined
}
