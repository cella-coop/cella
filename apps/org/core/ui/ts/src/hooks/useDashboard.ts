import { createContext } from 'svelte'
import { DashboardState } from './DashboardState.svelte.ts'

const [get, set, has] = createContext<DashboardState>()

export function useDashboard(): DashboardState {
  if (has()) {
    return get()
  }
  return set(new DashboardState())
}
