<script lang="ts">
  import { money, Section, Table, type Column } from '@cella/org-ui'
  import type { Rights } from '../../models/capital.ts'

  // Joining's capital: the shares the statutes ask an associate to
  // subscribe, at the share's value, and the instalments they may pay
  // them in; subscribed once the assembly admits them.
  let { data }: { data: Rights | null; id: string } = $props()

  type Step = { id: string; step: string; state: string; detail: string }
  const s = $derived(data?.statutes)
  const steps = $derived<Step[]>(
    !data || !s?.share
      ? []
      : [
          {
            id: 'subscribe',
            step: 'Subscribe capital',
            state: data.shares > 0 ? 'done' : 'to do',
            detail:
              data.shares > 0
                ? `${data.shares} shares of ${money(s.share)}, ${money(data.subscribed)}`
                : `at least ${s.minimum} shares of ${money(s.share)}, ${money((s.minimum ?? 0) * s.share)}, called on admission; up to ${s.instalments} monthly instalments`,
          },
        ],
  )
  const columns: Column<Step>[] = [
    { key: 'step', label: 'Step', value: (x) => x.step },
    { key: 'state', label: 'State', kind: 'badge', value: (x) => x.state, tone: (x) => (x.state === 'done' ? 'positive' : 'accent') },
    { key: 'detail', label: 'What', value: (x) => x.detail },
  ]
</script>

{#if steps.length}
  <Section title="Capital">
    <Table {columns} rows={steps} />
  </Section>
{/if}
