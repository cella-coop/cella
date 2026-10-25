import { short, type Column } from '@cella/org-ui'
import type { Device } from '../../models/device.ts'

export const columns: Column<Device>[] = [
  { key: 'label', label: 'Device', kind: 'title', role: 'title', value: (d) => d.label },
  { key: 'address', label: 'Holder', kind: 'mono', role: 'sub', value: (d) => d.address },
  { key: 'key', label: 'Key', kind: 'mono', role: 'hidden', value: (d) => short(d.key, 16) },
  { key: 'enrolled', label: 'Enrolled', kind: 'date', role: 'meta', value: (d) => d.enrolled },
  {
    key: 'state',
    label: 'State',
    kind: 'badge',
    role: 'meta',
    value: (d) => d.state,
    tone: (d) => (d.state === 'revoked' ? 'neutral' : 'positive'),
  },
]
