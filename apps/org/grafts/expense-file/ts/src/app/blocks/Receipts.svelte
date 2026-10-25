<script lang="ts">
  import { Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { Receipt } from '../../models/receipt.ts'

  // The receipts attached to the expense, each opening as its file, and
  // another attached; only the expense's member may attach one.
  let { data, id }: { data: { receipts: Receipt[] }; id: string } = $props()

  const columns: Column<Receipt>[] = [
    { key: 'name', label: 'Receipt', value: (r) => r.name },
    { key: 'type', label: 'Type', kind: 'mono', value: (r) => r.type },
    { key: 'uploaded', label: 'Attached', kind: 'date', value: (r) => r.uploaded },
  ]
</script>

<Section title="Receipts" count={data.receipts.length}>
  {#if data.receipts.length}
    <Table {columns} rows={data.receipts} href={(r: Receipt) => `/files/${r.id}/content`} />
  {/if}
  <Form action="attach" submit="Attach" tone="quiet" inline>
    <Field label={data.receipts.length ? 'Another receipt' : `A receipt for ${id}`} name="file" type="file" accept="image/*,application/pdf" required />
  </Form>
</Section>
