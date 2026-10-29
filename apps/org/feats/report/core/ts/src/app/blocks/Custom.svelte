<script lang="ts">
  import { Dashboard, Note, Section, Table, type Column } from '@cella/org-ui'
  import type { Value } from '@cella/org-analytics'
  import type { Custom, Drawn } from '../../models/report.ts'

  // A member's own report: its chart over its rows, as the port ran it.
  let { data }: { data: Drawn<Custom>; id: string } = $props()

  const numeric = /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|DECIMAL|DOUBLE|FLOAT)/
  const columns = $derived(
    (data.drawn?.result.columns ?? []).map(
      (c): Column<Record<string, Value>> => ({ key: c.name, label: c.name, kind: numeric.test(c.type) ? 'number' : undefined, value: (r) => r[c.name] }),
    ),
  )
  const chart = $derived(data.report.definition?.chart)
</script>

{#if data.report.kind === 'custom'}
  {#if data.drawn}
    {#if chart && data.drawn.bars.length}
      <Dashboard results={[{ kind: 'chart', title: `${chart.value} by ${chart.by}`, format: 'number', line: false, points: data.drawn.bars }]} />
    {/if}
    <Section title="Rows" count={data.drawn.result.rows.length}>
      <Table {columns} rows={data.drawn.result.rows.map((r, i) => ({ ...r, id: String(i) }))} />
      {#if data.drawn.result.more}<Note text="The report has more rows than it shows." />{/if}
    </Section>
  {:else}
    <Note text={data.failed ?? 'Nothing to draw.'} />
  {/if}
{/if}
