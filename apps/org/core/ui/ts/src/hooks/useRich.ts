import { RichState, type Suggest } from './RichState.svelte.ts'

// A comment box's rich text: its own state, one per box.
export function useRich(suggest: () => Suggest | undefined, changed: (value: string) => void): RichState {
  return new RichState(suggest, changed)
}
