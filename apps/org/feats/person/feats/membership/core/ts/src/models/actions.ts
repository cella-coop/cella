import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact; two invitations do no harm
  'membership:member:invite': confluent({ power: 'invite-member' }),
  // a fact; two links do no harm, and the first taken up ends them all
  'membership:member:link': confluent({ power: 'invite-member' }),
  // enrols the invitee's first device: ordered against revoke, as an enrolment is
  'membership:member:accept': ordered({ check: 'self' }),
  // changes who votes; the cited motion admits
  'membership:member:admit': ordered({ decide: 'consent', check: 'decided' }),
  // changes who votes; the cited motion suspends
  'membership:member:suspend': ordered({ check: 'decided' }),
  // freezes the capital account; the cited motion ends the membership
  'membership:member:exit': ordered({ check: 'decided' }),
  // erasure wins over every update; the cited motion erases a member who has left
  'membership:member:erase': ordered({ check: 'decided' }),
} satisfies Actions
