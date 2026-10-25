import { createContext } from 'svelte'
import { SignInState } from './SignInState.svelte.ts'

const [get, set, has] = createContext<SignInState>()

export function useSignIn(scope: () => string, back: () => string): SignInState {
  if (has()) {
    return get()
  }
  return set(new SignInState(scope, back))
}
