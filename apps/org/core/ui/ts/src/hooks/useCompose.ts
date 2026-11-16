import type { Composing } from '../models/compose.ts'
import { ComposeState } from './ComposeState.svelte.ts'
import { useWrites } from './useWrites.ts'

// What a `Compose` composes, posting through the page's writes.
export function useCompose(composing: () => Composing): ComposeState {
  return new ComposeState(composing, useWrites())
}
