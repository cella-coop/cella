import { createContext } from 'svelte'
import type { BodiedAccount } from '../models/body-account.ts'
import { BodyStateAccount } from './BodyStateAccount.svelte.ts'

const [get, set, has] = createContext<BodyStateAccount>()

export function useBodyAccount(page: () => BodiedAccount & { id: string }): BodyStateAccount {
  if (has()) {
    return get()
  }
  return set(new BodyStateAccount(page))
}
