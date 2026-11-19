<script lang="ts">
  import { date, icons, Panel, Prose } from '@cella/org-ui'
  import type { Terms } from '../../models/terms.ts'

  // How the terms divide the work share, what of a worker's part buys
  // shares, and the most interest capital earns, said as the statutes
  // say them, adopted or still drafted: the overview's panel.
  let { data }: { data: Terms; id: string } = $props()

  const parts = $derived(
    [
      [data.salary, 'by pay'],
      [data.hours, 'by time worked'],
      [data.equal, 'in equal parts'],
    ]
      .filter(([n]) => Number(n) > 0)
      .map(([n, by]) => `${n} % ${by}`)
      .join(', '),
  )
</script>

<Panel
  title="Clauses"
  icon={icons.SealCheck}
  status={data.adopted ? { label: 'adopted', tone: 'positive' } : { label: 'drafted', tone: 'accent' }}
  meta={data.adopted ? date(data.adopted) : null}
>
  <Prose
    text={`The work share divides ${parts || 'by no basis'}. ${data.capital} % of a worker's part is employed in shares. Capital earns at most ${data.interest} % interest.`}
  />
</Panel>
