import Federation, { meta as federationMeta } from './federation.svelte'
import MandateTree, { meta as mandateTreeMeta } from './mandate-tree.svelte'
import MembersConsent, { meta as membersConsentMeta } from './members-consent.svelte'
import ScopeNotary, { meta as scopeNotaryMeta } from './scope-notary.svelte'
import SignedLog, { meta as signedLogMeta } from './signed-log.svelte'
import YouJoin, { meta as youJoinMeta } from './you-join.svelte'

export const diagrams = {
  'federation': { component: Federation, meta: federationMeta },
  'mandate-tree': { component: MandateTree, meta: mandateTreeMeta },
  'members-consent': { component: MembersConsent, meta: membersConsentMeta },
  'scope-notary': { component: ScopeNotary, meta: scopeNotaryMeta },
  'signed-log': { component: SignedLog, meta: signedLogMeta },
  'you-join': { component: YouJoin, meta: youJoinMeta },
} as const

export type DiagramName = keyof typeof diagrams
