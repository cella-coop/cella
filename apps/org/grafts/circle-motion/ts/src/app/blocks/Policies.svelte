<script lang="ts">
  import { Section, Table, type Column } from '@cella/org-ui'
  import type { Policy } from '@cella/org-policy'
  import type { Proposing } from '../../models/index.ts'

  // The policies the circle adopted that are in force: each sentence as
  // its legal wording reads, its kind, the motion that adopted it and its
  // days, linking to that motion.
  let { data }: { data: Proposing | null; id: string } = $props()

  const columns: Column<Policy>[] = [
    { key: 'sentence', label: 'Policy', value: (p) => p.sentence },
    { key: 'kind', label: 'Kind', value: (p) => p.kind },
    { key: 'motion', label: 'Adopted by', kind: 'mono', value: (p) => p.motion },
    { key: 'applies', label: 'Applies from', kind: 'date', value: (p) => p.applies },
    { key: 'ends', label: 'Until', kind: 'date', value: (p) => p.ends },
  ]
</script>

{#if data}
  <Section title="Policies" count={data.policies.length}>
    <Table {columns} rows={data.policies} href={(p: Policy) => `/motions/${p.motion}`} />
  </Section>
{/if}
