<script lang="ts">
  import { Field, Form, Section, Table, money, type Column } from '@cella/org-ui'
  import type { Granted, Pot } from '../../models/share.ts'

  // The project's budget split among the members who spend it, and
  // granting a share from what is left of it. A share beyond it is
  // refused.
  let { data }: { data: Pot; id: string } = $props()

  const columns: Column<Granted>[] = [
    { key: 'name', label: 'Member', kind: 'title', value: (s) => s.name },
    { key: 'amount', label: 'Share', kind: 'money', value: (s) => s.amount },
    { key: 'granted', label: 'Granted', kind: 'date', value: (s) => s.granted },
  ]
  const options = $derived(data.members.map((m) => ({ value: m.address, label: m.name })))
  const title = $derived(data.budget === null ? 'Shares' : `Shares: ${money(data.shared)} of ${money(data.budget)}, ${money(data.remaining)} left`)
</script>

<Section {title} count={data.shares.length}>
  <Table {columns} rows={data.shares} href={(s: Granted) => `/people/${s.member}`} />
  {#if data.budget !== null && !data.archived}
    <Form action="share" submit="Grant share" tone="quiet" inline>
      <Field label="Member" name="member" {options} placeholder="Choose a member" value="" required />
      <Field label="Amount, €" name="amount" placeholder="1500" required />
    </Form>
  {/if}
</Section>
