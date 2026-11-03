import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact; two invitations do no harm
  'membership:member:invite': confluent({ power: 'invite-member' }),
  // a fact; two links do no harm, and the first taken up ends them all
  'membership:member:link': confluent({ power: 'invite-member' }),
  // enrols the invitee's first device: ordered against revoke, as an enrolment is
  'membership:member:accept': ordered({ power: 'accept-invitation' }),
  // changes who votes; the cited motion admits
  'membership:member:admit': ordered({ decide: 'consent', power: 'admit-member' }),
  // changes who votes; the cited motion suspends
  'membership:member:suspend': ordered({ power: 'suspend-member' }),
  // a member leaves by their own right; the freeze of their capital follows it
  'membership:member:withdraw': ordered({ power: 'withdraw-membership' }),
  // freezes the capital account; the cited motion excludes the member
  'membership:member:exclude': ordered({ power: 'exclude-member' }),
  // erasure wins over every update; the cited motion erases a member who has left
  'membership:member:erase': ordered({ power: 'erase-member' }),
} satisfies Actions
