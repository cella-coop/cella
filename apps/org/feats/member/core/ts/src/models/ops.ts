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
  // erasure wins over every update; the cited decision erases a member who has left
  'member:member:erase': ordered({ check: 'decided' }),
  // erasure wins over every update; a member's own contact details
  'member:member:forget': ordered({ check: 'self' }),
} satisfies Ops
