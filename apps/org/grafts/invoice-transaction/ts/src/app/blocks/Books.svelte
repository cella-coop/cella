<script lang="ts">
  import { Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { Posted } from '../../models/posting.ts'

  // The entries the invoice's events posted, and the writes that post
  // more: a payment, the bank debited and clients credited; a void, its
  // credit note, refused by `invoice.voids` once anything was paid.
  let { data }: { data: Posted[]; id: string } = $props()

  const columns: Column<Posted>[] = [
    { key: 'entry', label: 'Entry', kind: 'mono', value: (p) => p.entry },
    { key: 'event', label: 'Event', value: (p) => p.event },
    { key: 'date', label: 'Date', kind: 'date', value: (p) => p.date },
    { key: 'account', label: 'Account', kind: 'mono', value: (p) => p.account },
    { key: 'debit', label: 'Debit', kind: 'money', value: (p) => (p.side === 'debit' ? p.cents : null) },
    { key: 'credit', label: 'Credit', kind: 'money', value: (p) => (p.side === 'credit' ? p.cents : null) },
  ]
  const methods = ['transfer', 'card', 'cheque', 'cash'].map((m) => ({ value: m, label: m }))
</script>

<Section title="Postings" count={data.length}>
  <Table {columns} rows={data} href={(p: Posted) => `/transactions/${p.entry}`} />
</Section>

<Section title="Record a payment">
  <Form action="payment" submit="Record payment">
    <Field label="Received on" name="at" type="date" required />
    <Field label="Amount, €" name="amount" required />
    <Field label="Method" name="method" options={methods} placeholder="How it was paid" required />
    <Field label="Bank reference" name="reference" required />
  </Form>
</Section>

<Section title="Void">
  <Form action="void" submit="Void and post a credit note" tone="danger" inline>
    <Field label="Why" name="reason" required />
  </Form>
</Section>
