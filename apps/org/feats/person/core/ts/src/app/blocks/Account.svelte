<script lang="ts">
  import { Section, Settings, type Declared, type Theme, type Viewer } from '@cella/org-ui'
  import type { Device } from '../../models/device.ts'
  import type { Person } from '../../models/person.ts'
  import Devices from './Devices.svelte'

  // The acting person's Account settings: their name and contact
  // details, each saved by `profile`, every person's right on their own,
  // and their theme, saved in its cookie; then their devices, as on their
  // page. Every field is the reader's own, so none opens a motion.
  let { data, viewer, theme }: { data: Person & { devices: Device[] }; viewer: Viewer | null; theme: Theme } = $props()

  const settings: Declared[] = $derived([
    { name: 'name', label: 'Name', value: data.name, write: 'profile' },
    { name: 'email', label: 'Email', type: 'email', value: data.email ?? '', write: 'profile' },
    { name: 'phone', label: 'Phone', value: data.phone ?? '', write: 'profile' },
    {
      name: 'theme',
      label: 'Theme',
      value: theme,
      write: 'theme',
      options: [
        { value: 'system', label: 'The system’s' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ],
    },
  ])
</script>

<Section title="Profile">
  <Settings {settings} />
</Section>
<Devices {data} id={data.address} {viewer} />
