<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Policy, Standing } from '@cella/org-policy'
  import type { Proposing } from '../../models/circles.ts'

  // The policies the circle adopted that are in force: each sentence as
  // its legal wording reads, its kind, the default of its legal form it
  // takes, if any, the motion that adopted it and its days, linking to
  // that motion. Below them, every default of its form it left, with the
  // motion's action that left it and the day, or never took.
  let { data }: { data: Proposing | null; id: string } = $props()

  const columns: Column<Policy>[] = [
    { key: 'sentence', label: 'Policy', value: (p) => p.sentence },
    { key: 'kind', label: 'Kind', value: (p) => p.kind },
    {
      key: 'takes',
      label: 'Default',
      kind: 'badge',
      value: (p) => (p.takes ? (p.outdated ? 'Default, since updated' : 'Default') : 'Its own'),
      tone: (p) => (p.takes ? (p.outdated ? 'warning' : 'neutral') : 'accent'),
    },
    { key: 'motion', label: 'Adopted by', kind: 'mono', value: (p) => p.motion },
    { key: 'applies', label: 'Applies from', kind: 'date', value: (p) => p.applies },
    { key: 'ends', label: 'Until', kind: 'date', value: (p) => p.ends },
  ]

  const left: Column<Standing>[] = [
    { key: 'sentence', label: 'Default', value: (s) => s.sentence },
    { key: 'form', label: 'Of', value: (s) => s.form },
    { key: 'standing', label: 'Standing', kind: 'badge', value: (s) => (s.standing === 'left' ? 'Left' : 'Never taken'), tone: () => 'warning' },
    { key: 'leftBy', label: 'Left by', kind: 'mono', value: (s) => s.leftBy },
    { key: 'leftOn', label: 'On', kind: 'date', value: (s) => s.leftOn },
  ]
</script>

{#if data}
  <Section title="Policies" count={data.policies.length}>
    <Table {columns} rows={data.policies} href={(p: Policy) => `/motions/${p.motion}`} />
  </Section>
  {#if data.departures.length}
    <Section title="Defaults left" count={data.departures.length}>
      <Table columns={left} rows={data.departures} href={(s: Standing) => (s.leftBy ? `/motions/${s.leftBy.split('/')[0]}` : undefined)} />
    </Section>
  {/if}
{/if}
