import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact; two invitations do no harm
  'member:member:invite': confluent({ power: 'invite-member' }),
  // changes who votes; the cited decision admits
  'member:member:admit': ordered({ decide: 'consent', check: 'decided' }),
  // a member's own fields
  'member:member:profile': confluent({ check: 'self' }),
  // changes who votes
  'member:member:suspend': ordered({ power: 'end-membership' }),
  // freezes the capital account
  'member:member:exit': ordered({ power: 'end-membership' }),
} satisfies Ops
