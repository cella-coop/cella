<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Path } from '../../models/path.ts'

  // The way someone came to membership, step by step: hired, on probation
  // as a candidate with the shares they pledge, invited, admitted, gone.
  // A step not taken yet reads as what comes next.
  let { data }: { data: Path | null; id: string } = $props()

  type Step = { id: string; step: string; day: string | null; what: string }
  const steps = $derived<Step[]>(
    !data
      ? []
      : [
          ...(data.hired ? [{ id: 'hired', step: 'Hired', day: data.hired, what: data.left ? `left on ${data.left}` : 'employed' }] : []),
          ...(data.probation
            ? [{ id: 'probation', step: 'Candidate', day: data.probation, what: `probation to ${data.probationEnd}, pledging ${data.pledged} shares` }]
            : []),
          ...(data.invited ? [{ id: 'invited', step: 'Invited', day: data.invited, what: 'asked to join' }] : []),
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
