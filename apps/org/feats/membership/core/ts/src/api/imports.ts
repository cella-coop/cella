import { csv, type Importer } from '@cella/org-db'
import { invite } from '../handlers/index.ts'

// Members from another tool's list, a CSV with the columns `address` (or
// `email`) and `name`: each invited, as the importing member, under their
// power to invite, and given a link from their page to take it up by,
// which makes their first device. A member comes in invited, as anyone
// does, and their admission is the assembly's. A line is labelled by its
// address, the pseudonym the log names a member by.
export const members: Importer = {
  title: 'Members',
  formats: 'CSV with the columns address (or email) and name',
  read: async (text) =>
    csv(text).map(({ line, fields }) => {
      const address = (fields.address ?? fields.email ?? '').trim().toLowerCase()
      const name = (fields.name ?? '').trim()
      const op = 'membership:member:invite'
      if (!/^[^@\s]+@[^@\s]+$/.test(address) || !name) {
        return { line, label: `line ${line}`, op, refused: 'a member needs an address and a name' }
      }
      return { line, label: address, op, run: (deps) => invite({ address, name }, deps) }
    }),
}
