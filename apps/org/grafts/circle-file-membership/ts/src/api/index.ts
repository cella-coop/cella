// The graft's read and slice, which the shell mounts: a personal file
// opened to whoever holds a power over what it records.
import type { Slice } from '@cella/org-db'
import { opens } from '../drivers/opens.ts'

export { opens } from '../drivers/opens.ts'

export const slice: Slice = {
  name: 'circle-file-membership',
  extends: {
    files: { allows: opens },
  },
}
