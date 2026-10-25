<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import { categories, type Expense } from '@cella/org-expense/models'

  // A new expense, the acting member's own, as a draft, with its receipt
  // if they have it to hand: a photo or a scan, kept as a file.
  let { about }: { rows: Expense[]; about: { today: string } } = $props()

  const options = categories.map((c) => ({ value: c.code, label: `${c.label}, ${c.code}` }))
</script>

<Form action="capture" submit="Add expense">
  <Field label="What for" name="label" required wide />
  <Field label="Spent on" name="day" type="date" value={about.today} required />
  <Field label="Category" name="category" {options} value={options[0].value} />
  <Field label="Amount before VAT, €" name="net" required />
  <Field label="Deductible VAT, €" name="vat" placeholder="0" />
  <Field label="Receipt" name="file" type="file" accept="image/*,application/pdf" />
</Form>
