import { createContext } from 'svelte'
import { IssueState } from './IssueState.svelte.ts'

const [get, set, has] = createContext<IssueState>()

export function useIssue(): IssueState {
  if (has()) {
    return get()
  }
  return set(new IssueState())
}
