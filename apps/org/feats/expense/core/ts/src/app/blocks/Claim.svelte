<script lang="ts">
  import { date, icons, Panel, Table, type Total } from '@cella/org-ui'
  import type { Expense } from '../../models/expense.ts'

  // What the member spent and claims back, its VAT ruled off under it,
  // and how far the claim has come: the overview's first panel.
  let { data }: { data: Expense; id: string } = $props()

  const amounts: Total[] = $derived([
    { label: 'Before VAT', value: data.net },
    ...(data.vat === null ? [] : [{ label: 'VAT', value: data.vat }]),
    { label: 'Claimed', value: data.total, total: true },
  ])
  const stage = $derived(
    data.reimbursed
      ? `Reimbursed on ${date(data.reimbursed)}.`
      : data.status === 'refused'
        ? `Refused on ${date(data.decided)}.`
        : data.decided
          ? `Approved on ${date(data.decided)}, waiting to be reimbursed.`
          : data.submitted
            ? `Submitted on ${date(data.submitted)}, waiting for a decision.`
            : 'A draft: submit it to claim it.',
  )
</script>

{#snippet said()}{stage}{/snippet}

<Panel title="Claim" icon={icons.Wallet} meta="spent {date(data.day)}" help={said}>
  <Table dense columns={[]} rows={[]} totals={amounts} />
</Panel>
