import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact; two invitations do no harm
  'member:member:invite': confluent(),
  // changes who votes
  'member:member:admit': ordered({ decide: 'consent' }),
  // a member's own fields
  'member:member:profile': confluent(),
  // changes who votes
  'member:member:suspend': ordered(),
  // freezes the capital account
  'member:member:exit': ordered(),
} satisfies Ops
