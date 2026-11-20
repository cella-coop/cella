<script lang="ts">
  import { Bars, Empty, icons, Panel, Table, type Column } from '@cella/org-ui'
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

{#snippet more()}The report has more rows than it shows.{/snippet}

{#if data.report.kind === 'custom'}
  {#if data.drawn}
    {#if chart && data.drawn.bars.length}
      <Panel title={`${chart.value} by ${chart.by}`} icon={icons.ChartLine}>
        <Bars points={data.drawn.bars} />
      </Panel>
    {/if}
    <Panel title="Rows" icon={icons.SquaresFour} count={data.drawn.result.rows.length} help={data.drawn.result.more ? more : undefined}>
      <Table dense {columns} rows={data.drawn.result.rows.map((r, i) => ({ ...r, id: String(i) }))} />
    </Panel>
  {:else}
    <Panel title="Rows" icon={icons.SquaresFour}>
      <Empty text={data.failed ?? 'Nothing to draw.'} />
    </Panel>
  {/if}
{/if}
