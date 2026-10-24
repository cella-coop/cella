import { createContext } from 'svelte'
import { FormState } from './FormState.svelte.ts'

const [get, set, has] = createContext<FormState>()

export function useForm(): FormState {
  if (has()) {
    return get()
  }
  return set(new FormState())
}
