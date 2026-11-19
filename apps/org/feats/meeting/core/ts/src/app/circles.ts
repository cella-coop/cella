import { date, icons, type App } from '@cella/org-ui'
import type { Held, Met, OnCircle, Setting } from '../models/circles.ts'

const quorum = (s: Setting) => (s.quorum === 50 ? 'half the seats' : `${s.quorum} % of the seats`)
const minutes = (s: Setting) => (s.adopts ? 'once adopted' : 'as written')
const met = (m: Met) => ({ label: m.title, sub: `${date(m.at)}, ${m.status}`, href: `/meetings/${m.id}` })

// The feat's circles, client side: on a meeting's page, its circle and how the
// circle meets; on a circle's, its next meeting and its meetings.
export const app: App = {
  name: 'meeting/circles',
  extends: {
    meetings: {
      page: {
        properties: (h: Held | null) =>
          h
            ? [
                { label: 'Quorum', value: quorum(h), glyph: icons.UsersFour, lead: 'quorum' },
                { label: 'Minutes bind', value: minutes(h), glyph: icons.Stamp, lead: 'minutes bind' },
              ]
            : [],
        related: (h: Held | null) => (h ? [{ label: h.name, sub: 'circle', href: `/circles/${h.circle}` }] : []),
      },
    },
    circles: {
      page: {
        properties: (c: OnCircle) => [
          { label: 'Next meeting', value: c.next ? `${date(c.next.at)}, ${c.next.at.slice(11, 16)}` : null, href: c.next ? `/meetings/${c.next.id}` : undefined, lead: 'meets next' },
          { label: 'Quorum', value: quorum(c), glyph: icons.UsersFour, lead: 'quorum' },
          { label: 'Minutes bind', value: minutes(c), glyph: icons.Stamp, lead: 'minutes bind' },
        ],
        related: (c: OnCircle) => c.meetings.slice(0, 8).map(met),
      },
    },
  },
}
