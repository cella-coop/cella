import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact; two invitations do no harm
  'membership:member:invite': confluent({ power: 'invite-member' }),
  // changes who votes; the cited decision admits
  'membership:member:admit': ordered({ decide: 'consent', check: 'decided' }),
  // changes who votes; the cited decision suspends
  'membership:member:suspend': ordered({ check: 'decided' }),
  // freezes the capital account; the cited decision ends the membership
  'membership:member:exit': ordered({ check: 'decided' }),
  // erasure wins over every update; the cited decision erases a member who has left
  'membership:member:erase': ordered({ check: 'decided' }),
} satisfies Ops
