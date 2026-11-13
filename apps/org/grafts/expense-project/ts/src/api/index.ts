// The graft's write, reads and slice, which the shell mounts: an
// expense's project, filing it under one from its page, and what each
// project's members spent for it, to bill on.
import { action, type Slice } from '@cella/org-db'
import { rebill } from '../handlers/rebill.ts'
import { filed, projects, spent } from '../drivers/rebill.ts'
import { contract } from './contract.ts'

export { rebill } from '../handlers/rebill.ts'
export { filed, projects, spent } from '../drivers/rebill.ts'

export const slice: Slice = {
  name: 'expense-project',
  queries: contract,
  extends: {
    expenses: {
      list: projects,
      item: filed,
      actions: {
        rebill: action('expense-project:expense:rebill', (form, id) => ({ expense: id ?? '', project: form.get('project') }), rebill),
      },
    },
    projects: { item: spent },
  },
}
