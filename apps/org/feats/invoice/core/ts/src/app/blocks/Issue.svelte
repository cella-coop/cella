<script lang="ts">
  import { Button, Field, Form } from '@cella/org-ui'
  import type { Issuing, Listed } from '../../models/invoice.ts'
  import { useIssue } from '../../hooks/useIssue.ts'

  // A new invoice: numbered next in its series by the server, dated on the
  // verdict, its amounts computed in SQL from its lines.
  let { about }: { rows: Listed[]; about: Issuing } = $props()

  const issue = useIssue()
  const series = $derived(about.series.map((s) => ({ value: s.name, label: `${s.name}, next ${String(s.next).padStart(4, '0')}` })))
</script>

<Form action="issue" submit="Issue invoice">
  <Field label="Series" name="series" options={series} />
  <Field label="Bill to" name="bill_to" list={about.billed} required />
  <Field label="Label" name="label" required wide />
  <Field label="Due (30 days if empty)" name="due" type="date" />
  {#each issue.lines as line, i (line.key)}
    <Field label="Line {i + 1}" name="description" placeholder="Description" required wide />
    <Field label="Quantity" name="quantity" value="1" required />
    <Field label="Unit price, €" name="unit_price" placeholder="1200.00" required />
    <Field label="VAT %" name="vat_rate" value="20" required />
    {#if issue.lines.length > 1}
      <div><Button onclick={() => issue.remove(line.key)}>Remove line</Button></div>
    {/if}
  {/each}
  <div><Button onclick={() => issue.add()}>Add a line</Button></div>
</Form>
