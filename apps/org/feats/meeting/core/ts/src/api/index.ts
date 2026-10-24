// The feat's public writes, POST /api/meeting/<op> once the server exists,
// its reads, the form readers a graft reads the same forms with, and its
// slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { add, cancel, hold, minute, move, remove, schedule } from '../handlers/index.ts'
import { item, meetings, offered } from '../drivers/meeting.ts'
import * as forms from './forms.ts'

export { add, adding, cancel, hold, minute, minuting, move, remove, schedule } from '../handlers/index.ts'
export { agenda, item as meeting, meetings, offered } from '../drivers/meeting.ts'
export * as forms from './forms.ts'

export const slice: Slice = {
  name: 'meeting',
  collections: {
    meetings: {
      list: meetings,
      about: offered,
      item,
      index: async (db) => (await meetings(db)).map((m) => ({ id: m.id, title: m.title, sub: `${m.circle}, ${m.at.slice(0, 10)}` })),
      actions: {
        schedule: action('meeting:meeting:schedule', (form) => forms.schedule(form), schedule),
        item: action('meeting:item:add', (form, id) => forms.add(form, id ?? ''), add),
        move: action('meeting:item:move', (form, id) => forms.move(form, id ?? ''), move),
        remove: action('meeting:item:remove', (form, id) => forms.remove(form, id ?? ''), remove),
        hold: action('meeting:meeting:hold', (_, id) => ({ meeting: id ?? '' }), hold),
        cancel: action('meeting:meeting:cancel', (_, id) => ({ meeting: id ?? '' }), cancel),
        minute: action('meeting:meeting:minute', (_, id) => ({ meeting: id ?? '' }), minute),
      },
    },
  },
}
