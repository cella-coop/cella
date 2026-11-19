<script lang="ts">
  import { Empty, icons, Panel, Sheet } from '@cella/org-ui'
  import type { Drawn } from '../../models/report.ts'
  import type { Statement } from '../../models/statement.ts'

  // A financial statement over a span against the span before it, in the
  // PCG's rubrics, a panel of its own; the spans to move between are the
  // page's Related.
  let { data }: { data: Drawn<Statement>; id: string } = $props()

  const titles = { income: 'Income statement', balance: 'Balance sheet' }
</script>

{#if data.report.kind === 'income' || data.report.kind === 'balance'}
  <Panel title={titles[data.report.kind]} icon={icons.ChartLine} meta={data.drawn ? `${data.drawn.span.id} against ${data.drawn.span.before}` : null}>
    {#if data.drawn}
      <Sheet columns={data.drawn.columns} rows={data.drawn.rubrics} />
    {:else}
      <Empty text={data.failed ?? 'Nothing to draw.'} />
    {/if}
  </Panel>
{/if}
