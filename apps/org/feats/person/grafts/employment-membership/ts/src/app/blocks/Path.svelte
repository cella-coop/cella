<script lang="ts">
  import { date, Section, Table, type Column } from '@cella/org-ui'
  import type { Path } from '../../models/path.ts'

  // The way someone came to membership, step by step: hired, on probation
  // as a candidate with the shares they pledge, invited or applied,
  // admitted, gone.
  // A step not taken yet reads as what comes next.
  let { data }: { data: Path | null; id: string } = $props()

  type Step = { id: string; step: string; day: string | null; what: string }
  const steps = $derived<Step[]>(
    !data
      ? []
      : [
          ...(data.hired ? [{ id: 'hired', step: 'Hired', day: data.hired, what: !data.left ? 'employed' : data.ended ? `left on ${date(data.left)}` : `employed until ${date(data.left)}` }] : []),
          ...(data.probation
            ? [{ id: 'probation', step: 'Candidate', day: data.probation, what: `probation to ${date(data.probationEnd)}, pledging ${data.pledged} shares` }]
            : []),
          ...(data.applied
            ? [{ id: 'applied', step: 'Applied', day: data.applied, what: 'applied to join by right: the assembly rules on it' }]
            : data.invited
              ? [{ id: 'invited', step: 'Invited', day: data.invited, what: 'asked to join' }]
              : []),
          ...(data.admitted ? [{ id: 'admitted', step: 'Member', day: data.admitted, what: 'admitted by the assembly' }] : []),
          ...(data.exited ? [{ id: 'exited', step: 'Gone', day: data.exited, what: 'membership ended' }] : []),
          ...(data.due ? [{ id: 'due', step: 'Next', day: null, what: 'the probation is over: the assembly may admit them' }] : []),
        ],
  )
  const columns: Column<Step>[] = [
    { key: 'step', label: 'Step', value: (s) => s.step },
    { key: 'day', label: 'Day', kind: 'date', value: (s) => s.day },
    { key: 'what', label: 'What', value: (s) => s.what },
  ]
</script>

{#if steps.length}
  <Section title="Path to membership">
    <Table {columns} rows={steps} />
  </Section>
{/if}
