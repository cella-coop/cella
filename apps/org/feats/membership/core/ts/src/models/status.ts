import type { Lifecycle } from '@cella/org-ui/models'

// A membership's lifecycle, each state under the word its chip says:
// invited, then a member, suspended a while, a former member at the end.
// The house's tones stay: a member positive, suspended wanting attention,
// a former member at rest, not a success. `cella check feats`
// holds it equal to membership.member's CHECK.
export const status = {
  column: 'member.status',
  states: [
    { value: 'invited', category: 'unstarted', label: 'invited' },
    { value: 'active', category: 'started', tone: 'positive', label: 'member' },
    { value: 'suspended', category: 'started', tone: 'warning', label: 'suspended' },
    { value: 'exited', category: 'completed', tone: 'neutral', label: 'former member' },
  ],
} as const satisfies Lifecycle
