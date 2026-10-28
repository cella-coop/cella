import { action, type Slice } from '@cella/org-db'
import { forget, profile, revoke } from '../handlers/index.ts'
import { devices, listing as listed } from '../drivers/device.ts'
import { listing, people, person } from '../drivers/person.ts'

// The feat's server side as the shell mounts it: the people collection,
// read from its schema, each person's devices on their page, and the
// profile writes there. Who comes in, by an invitation or a hire, is the
// children's. The inbox, what waits on the acting person, is filled by
// the slices that know each kind of ask; this feat keeps none of its own.
// Every device, listed. A person revokes one of their devices from
// another, on their own page; enrolling a later device is not offered yet.
export const slice: Slice = {
  name: 'person',
  collections: {
    people: {
      list: listing,
      item: async (db, address) => {
        const found = await person(db, address)
        return found && { ...found, devices: await devices(db, address) }
      },
      index: async (db) => (await people(db)).map((p) => ({ id: p.id, title: p.name, sub: p.address })),
      actions: {
        profile: action('person:person:profile', (form, id) => ({ person: id ?? '', name: form.get('name') || undefined }), profile),
        forget: action('person:person:forget', (_, id) => ({ person: id ?? '' }), forget),
        revoke: action('person:device:revoke', (form) => ({ key: form.get('key') }), revoke),
      },
    },
    inbox: {},
    devices: { list: listed },
  },
}
