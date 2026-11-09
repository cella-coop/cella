import { action, type Form, type Slice } from '@cella/org-db'
import { forget, profile, revoke } from '../handlers/index.ts'
import { devices, listing as listed } from '../drivers/device.ts'
import { listing, people, person } from '../drivers/person.ts'
import type { Profile } from '../models/person.ts'
import { contract } from './contract.ts'

// Core's people as the shell mounts them: the people collection, read
// from its schema, each person's devices on their page, and the profile
// writes there. Every feat builds on core, so any slice may extend its
// collections. Who comes in, by an invitation or a hire, is membership's
// and employment's. The inbox, what waits on the acting person, is filled by
// the slices that know each kind of ask; this feat keeps none of its own.
// Every device, listed. A person revokes one of their devices from
// another, on their own page and in their Account settings; enrolling a
// later device is not offered yet.
export const slice: Slice = {
  name: 'person',
  queries: contract,
  core: true,
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
  // The acting person's own Account settings: their name and contact
  // details, saved by `profile` as their own, and their devices, each
  // other current one revoked from this one.
  settings: {
    account: {
      read: async (db, actor) => {
        const found = await person(db, actor)
        return found && { ...found, devices: await devices(db, actor) }
      },
      actions: {
        profile: action('person:person:profile', (form, _, deps) => ({ person: deps.actor, ...given(form) }), profile),
        revoke: action('person:device:revoke', (form) => ({ key: form.get('key') }), revoke),
      },
    },
  },
}

// The profile fields a settings form posts, those it changed alone: a
// name is never empty, and an email or phone left empty is cleared.
function given(form: Form): Omit<Profile, 'person'> {
  const sent = (name: string) => form.all(name).length > 0
  if (sent('name') && !form.get('name').trim()) {
    throw new Error('a name cannot be empty: type the name you go by')
  }
  return {
    ...(sent('name') ? { name: form.get('name').trim() } : {}),
    ...(sent('email') ? { email: form.get('email').trim() || null } : {}),
    ...(sent('phone') ? { phone: form.get('phone').trim() || null } : {}),
  }
}
