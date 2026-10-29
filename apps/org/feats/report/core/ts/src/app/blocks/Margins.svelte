<script lang="ts">
  import { Note, Section, Stats, Table, type Column, type Tone } from '@cella/org-ui'
  import type { Drawn } from '../../models/report.ts'
  import type { Margin, Margins } from '../../models/margin.ts'

  // Each project's margin on the scope's day, its burn and its forecasts,
  // under the margin, the time cost and how many projects are watched.
  let { data }: { data: Drawn<Margins>; id: string } = $props()

  const tones: Record<Margin['watch'], Tone> = { 'on track': 'positive', 'budget spent': 'warning', 'over budget': 'negative', 'thin margin': 'warning', archived: 'neutral' }
  const columns: Column<Margin>[] = [
    { key: 'title', label: 'Project', value: (m) => m.title },
    { key: 'watch', label: 'Watch', kind: 'badge', value: (m) => m.watch, tone: (m) => tones[m.watch] },
    { key: 'invoiced', label: 'Invoiced', kind: 'money', value: (m) => m.invoiced },
    { key: 'cost', label: 'Time cost', kind: 'money', value: (m) => m.cost },
    { key: 'margin', label: 'Margin', kind: 'money', value: (m) => m.margin, tone: (m) => (m.margin < 0 ? 'negative' : 'neutral') },
    { key: 'percent', label: '%', kind: 'number', value: (m) => m.percent },
    { key: 'burn', label: 'Burn %', kind: 'number', value: (m) => m.burn },
    { key: 'landing', label: 'At completion', kind: 'money', value: (m) => m.landing },
  ]
  // A table keys its rows by id: a project's.
  const live = $derived((data.drawn?.projects ?? []).map((m) => ({ ...m, id: m.project })))
  const watched = $derived(live.filter((m) => m.watch !== 'on track' && m.watch !== 'archived').length)
</script>

{#if data.report.kind === 'margins'}
  {#if data.drawn}
    <Stats
      items={[
        { label: 'Margin', value: live.reduce((s, m) => s + m.margin, 0), kind: 'money' },
        { label: 'Time cost', value: live.reduce((s, m) => s + m.cost, 0), kind: 'money' },
        { label: 'To watch', value: watched, kind: 'number', tone: watched ? 'warning' : 'positive' },
      ]}
    />
    <Section title={`Projects on ${data.drawn.day}`} count={live.length}>
      <Table {columns} rows={live} href={(m: Margin) => `/projects/${m.project}`} />
      {#if data.drawn.threshold}
        <Note text={`A project is watched once its billable time has spent ${data.drawn.threshold.burn} % of its budget while under way, once its spend at completion passes its budget, or once its margin keeps less than ${data.drawn.threshold.margin} % of what it invoiced.`} />
      {/if}
    </Section>
  {:else}
    <Note text={data.failed ?? 'Nothing to draw.'} />
  {/if}
{/if}
