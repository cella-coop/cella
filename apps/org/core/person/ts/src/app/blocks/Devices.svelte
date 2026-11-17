<script lang="ts">
  import { page } from '$app/state'
  import { Form, Hidden, Note, Pairing, Section, Table, type Viewer } from '@cella/org-ui'
  import type { Device } from '../../models/device.ts'
  import { columns } from '../views/devices.ts'

  // A person's devices: the keys that sign their writes. On their own
  // page, the one this session signs with is marked, and each other
  // current one may be revoked from it, as a lost or stolen device is; a
  // device never revokes itself.
  // In Account settings, where the person enrols a later device: the key
  // another browser made, which that browser's sign-in page links here
  // with the key and its label filled in.
  let { data, id, viewer, enrolling = false }: { data: { devices: Device[] }; id: string; viewer?: Viewer | null; enrolling?: boolean } = $props()
  const named = $derived(page.url.searchParams.get('label') ?? '')

  const own = $derived(viewer?.actor === id)
  const here = (d: Device) => own && d.key === viewer?.device
  const shown = $derived(
    columns
      .filter((c) => c.key !== 'address')
      .map((c) => (c.key === 'label' ? { ...c, value: (d: Device) => (here(d) ? `${d.label}, this device` : d.label) } : c)),
  )
  const others = $derived(own ? data.devices.filter((d) => d.state === 'current' && !here(d)) : [])
</script>

<Section title="Devices" count={data.devices.length}>
  <Table columns={shown} rows={data.devices} />
  {#each others as d (d.key)}
    <Form action="revoke" submit="Revoke {d.label}" tone="danger" inline>
      <Hidden name="key" value={d.key} />
    </Form>
  {/each}
  {#if enrolling}
    <Pairing key={page.url.searchParams.get('enrol') ?? ''} label={named} />
  {/if}
  {#if own && !others.length}
    <Note text="This is your only current device. Recovering from the loss of every device is not built yet." />
  {/if}
</Section>
