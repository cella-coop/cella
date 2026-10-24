<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import { categories, type Expense } from '../../models/expense.ts'

  // A new expense, the acting member's own, as a draft: what it was for,
  // its category, its amount before VAT and the deductible VAT, and a
  // reference to its receipt until receipts are stored as files.
  let { about }: { rows: Expense[]; about: { today: string } } = $props()

  const options = categories.map((c) => ({ value: c.code, label: `${c.label}, ${c.code}` }))
</script>

<Form action="capture" submit="Add expense">
  <Field label="What for" name="label" required wide />
  <Field label="Spent on" name="day" type="date" value={about.today} required />
  <Field label="Category" name="category" {options} value={options[0].value} />
  <Field label="Amount before VAT, €" name="net" required />
  <Field label="Deductible VAT, €" name="vat" placeholder="0" />
  <Field label="Receipt" name="receipt" placeholder="a reference, such as the scan's name" />
</Form>
