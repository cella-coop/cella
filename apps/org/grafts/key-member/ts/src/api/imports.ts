import { csv, type Importer } from '@cella/org-db'
import { invite } from '../handlers/invite.ts'

// Members from another tool's list, a CSV with the columns `address` (or
// `email`), `name`, `key`, the public key in hex of the device each made
// to join, and `label`, what they call it: each invited with that first
// device, as the importing member, under their power to invite. A member
// comes in invited, as anyone does, and their admission is the
// assembly's. A line is labelled by its address, the pseudonym the log
// names a member by.
export const members: Importer = {
  title: 'Members',
  formats: 'CSV with the columns address (or email), name, key (their device’s public key, in hex) and label',
  read: async (text) =>
    csv(text).map(({ line, fields }) => {
      const address = (fields.address ?? fields.email ?? '').trim().toLowerCase()
      const name = (fields.name ?? '').trim()
      const op = 'member:member:invite'
      if (!/^[^@\s]+@[^@\s]+$/.test(address) || !name) {
        return { line, label: `line ${line}`, op, refused: 'a member needs an address and a name' }
      }
      if (!fields.key) {
        return { line, label: address, op, refused: 'an invitation carries the first device of whom it invites: its key is missing' }
      }
      const input = { address, name, key: fields.key, label: fields.label || 'first device' }
      return { line, label: address, op, run: (deps) => invite(input, deps) }
    }),
}
