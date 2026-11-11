<script lang="ts">
  import { date, Form, Note, Section, Table, type Column } from '@cella/org-ui'
  import type { Membership } from '../../models/member.ts'
  import { useLink } from '../../hooks/useLink.ts'

  // Joining's device: a key that signs the member's writes, the first one
  // made when they take up their invitation by its link. While they have
  // not, whoever may invite gives them a new link, shown here once.
  let { data }: { data: Membership; id: string } = $props()

  type Step = { id: string; step: string; state: string; detail: string }
  const held = $derived(data.devices.filter((d) => !d.revoked))
  const steps = $derived<Step[]>([
    {
      id: 'device',
      step: 'Enrol a device',
      state: held.length ? 'done' : 'to do',
      detail: held.length
        ? held.map((d) => `${d.label}, enrolled ${date(d.enrolled)}${d.key === data.first?.key ? ' when the invitation was taken up' : ''}`).join('; ')
        : data.links
          ? `${data.links === 1 ? 'a link waits' : `${data.links} links wait`} to be opened`
          : 'no link yet',
    },
  ])
  const columns: Column<Step>[] = [
    { key: 'step', label: 'Step', value: (x) => x.step },
    { key: 'state', label: 'State', kind: 'badge', value: (x) => x.state, tone: (x) => (x.state === 'done' ? 'positive' : 'accent') },
    { key: 'detail', label: 'What', value: (x) => x.detail },
  ]

  const link = useLink('membership:member:link')
  const offered = $derived(data.member?.status === 'invited' && !data.first)
</script>

<Section title="Devices">
  <Table {columns} rows={steps} />
  {#if offered}
    <Form action="link" submit="New invitation link" tone="quiet" inline ready={link.digest !== ''}>
      <input type="hidden" name="link" value={link.digest} />
    </Form>
    {#if link.made}
      <Note text="The new link, to pass on; it is shown once, and taken up once: {link.made}" />
    {/if}
  {/if}
</Section>
