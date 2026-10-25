<script lang="ts">
  import { Field, Form, Note, Section, Stats, Table, type Column } from '@cella/org-ui'
  import type { Called, Payment, Repayment } from '../../models/capital.ts'

  // A member's capital paid in and out: their subscription, what they paid
  // of it from the bank or their pay and what is left, and recording a
  // payment while some is; once they left, what they are owed, each
  // repayment with the day it falls due, and repaying the next. The rules
  // refuse a payment beyond what is owed and a repayment before its day.
  let { data }: { data: { called: Called }; id: string } = $props()

  const c = $derived(data.called)
  const via = { bank: 'from the bank', pay: 'from their pay' }
  const payments: Column<Payment>[] = [
    { key: 'entry', label: 'Entry', kind: 'mono', value: (p) => p.entry },
    { key: 'date', label: 'Date', kind: 'date', value: (p) => p.date },
    { key: 'via', label: 'Paid', kind: 'badge', value: (p) => via[p.via] },
    { key: 'amount', label: 'Amount', kind: 'money', value: (p) => p.amount },
  ]
  const repayments: Column<Repayment>[] = [
    { key: 'n', label: 'Repayment', kind: 'number', value: (r) => r.n },
    { key: 'due', label: 'Due', kind: 'date', value: (r) => r.due },
    { key: 'amount', label: 'Amount', kind: 'money', value: (r) => r.amount },
    { key: 'state', label: 'State', kind: 'badge', value: (r) => (r.paid ? `repaid ${r.paid}` : 'to repay'), tone: (r) => (r.paid ? 'positive' : 'accent') },
  ]
</script>

{#if c.subscribed !== null}
  <Section title="Subscription" count={c.payments.length}>
    <Stats
      items={[
        { label: 'Subscribed', value: c.subscribed, kind: 'money' },
        { label: 'Paid in', value: c.paid, kind: 'money' },
        { label: 'Left to pay', value: c.unpaid, kind: 'money' },
        ...(c.cancelled ? [{ label: 'Cancelled on exit', value: c.cancelled, kind: 'money' as const }] : []),
      ]}
    />
    <Table columns={payments} rows={c.payments} href={(p: Payment) => `/transactions/${p.entry}`} />
    {#if c.unpaid}
      <Form action="pay" submit="Record a payment" tone="quiet" inline>
        <Field label="Paid in, €" name="amount" required />
      </Form>
    {/if}
  </Section>
{/if}
{#if c.repayments.length}
  <Section title="Repayments" count={c.repayments.length}>
    <Stats
      items={[
        { label: 'Owed on exit', value: c.owed, kind: 'money' },
        { label: 'Repaid', value: c.repaid, kind: 'money' },
        { label: 'Left to repay', value: c.left, kind: 'money' },
      ]}
    />
    <Table columns={repayments} rows={c.repayments} href={(r: Repayment) => (r.entry ? `/transactions/${r.entry}` : undefined)} />
    {#if c.next !== null}
      <Form action="repay" submit={`Pay repayment ${c.next}`} tone="quiet" inline />
    {:else}
      <Note text="Repaid in full." />
    {/if}
  </Section>
{/if}
