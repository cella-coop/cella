import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact; two invitations do no harm
  'member:member:invite': confluent({ power: 'invite-member' }),
  // changes who votes; the cited decision admits
  'member:member:admit': ordered({ decide: 'consent', check: 'decided' }),
  // a member's own fields
  'member:member:profile': confluent({ check: 'self' }),
  // changes who votes; the cited decision suspends
  'member:member:suspend': ordered({ check: 'decided' }),
  // freezes the capital account; the cited decision ends the membership
  'member:member:exit': ordered({ check: 'decided' }),
} satisfies Ops
