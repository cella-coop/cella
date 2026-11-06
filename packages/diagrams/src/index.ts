import ScopeNotary, { meta as scopeNotaryMeta } from './scope-notary.svelte'

export const diagrams = {
  'scope-notary': { component: ScopeNotary, meta: scopeNotaryMeta },
} as const

export type DiagramName = keyof typeof diagrams
