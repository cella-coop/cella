<script lang="ts">
  import { Field, Form, Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Granted, Pot } from '../../models/share.ts'

  // The project's budget split among the members who spend it, what is
  // shared of it and left as figures, and granting a share from what is
  // left. A share beyond it is refused.
  let { data }: { data: Pot; id: string } = $props()

  const columns: Column<Granted>[] = [
    { key: 'member', label: 'Member', kind: 'person', value: (s) => s.member },
    { key: 'amount', label: 'Share', kind: 'money', value: (s) => s.amount },
    { key: 'granted', label: 'Granted', kind: 'date', value: (s) => s.granted },
  ]
  const options = $derived(data.members.map((m) => ({ value: m.address, label: m.name })))
</script>

<Section title="Shares" count={data.shares.length}>
  {#if data.budget !== null}
    <Stats
      items={[
        { label: 'Shared', value: data.shared, kind: 'money' },
        { label: 'Left', value: data.remaining, kind: 'money' },
      ]}
    />
  {/if}
  <Table {columns} rows={data.shares} href={(s: Granted) => `/people/${s.member}`} />
  {#if data.budget !== null && !data.archived}
    <Form action="share" submit="Grant share" tone="quiet" inline>
      <Field label="Member" name="member" {options} placeholder="Choose a member" value="" required />
      <Field label="Amount, €" name="amount" placeholder="1500" required />
    </Form>
  {/if}
</Section>
