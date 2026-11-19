<script lang="ts">
  import { Button, verb, Field, Form } from '@cella/org-ui'
  import { categories, type Listed, type Recording } from '../../models/bill.ts'
  import { useRecord } from '../../hooks/useRecord.ts'

  // A supplier's bill as it came: who sent it and their number for it, the
  // date it bears, what it is charged to, and its lines, its amounts
  // computed in SQL from them.
  let { about }: { rows: Listed[]; about: Recording } = $props()

  const bill = useRecord()
  const options = categories.map((c) => ({ value: c.code, label: `${c.label}, ${c.code}` }))
</script>

<Form action="record" submit="Record bill">
  <Field label="Supplier" name="supplier" list={about.suppliers} required />
  <Field label="Their reference" name="reference" placeholder="FA-2026-1187" required />
  <Field label="What for" name="label" required wide />
  <Field label="Dated" name="issued" type="date" value={about.today} required />
  <Field label="Due (30 days if empty)" name="due" type="date" />
  <Field label="Category" name="category" {options} value={options[0].value} />
  {#each bill.lines as line, i (line.key)}
    <Field label="Line {i + 1}" name="description" placeholder="Description" required wide />
    <Field label="Quantity" name="quantity" value="1" required />
    <Field label="Unit price, €" name="unit_price" placeholder="1200.00" required />
    <Field label="VAT %" name="vat_rate" value="20" required />
    {#if bill.lines.length > 1}
      <div><Button lead={verb('Remove line')} onclick={() => bill.remove(line.key)}>Remove line</Button></div>
    {/if}
  {/each}
  <div><Button lead={verb('Add a line')} onclick={() => bill.add()}>Add a line</Button></div>
</Form>
