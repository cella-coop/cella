import { createContext } from 'svelte'
import type { Offered } from '../models/decision.ts'
import { ProposalState } from './ProposalState.svelte.ts'

const [get, set, has] = createContext<ProposalState>()

export function useProposal(offered: () => Offered): ProposalState {
  if (has()) {
    return get()
  }
  return set(new ProposalState(offered))
}
