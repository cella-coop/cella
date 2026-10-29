<script lang="ts">
  import { Note, Section, Sheet } from '@cella/org-ui'
  import type { Drawn } from '../../models/report.ts'
  import type { Statement } from '../../models/statement.ts'

  // A financial statement over a span against the span before it, in the
  // PCG's rubrics; the spans to move between are the page's Related.
  let { data }: { data: Drawn<Statement>; id: string } = $props()

  const titles = { income: 'Income statement', balance: 'Balance sheet' }
</script>

{#if data.report.kind === 'income' || data.report.kind === 'balance'}
  <Section title={data.drawn ? `${titles[data.report.kind]}, ${data.drawn.span.id} against ${data.drawn.span.before}` : titles[data.report.kind]}>
    {#if data.drawn}
      <Sheet columns={data.drawn.columns} rows={data.drawn.rubrics} />
    {:else}
      <Note text={data.failed ?? 'Nothing to draw.'} />
    {/if}
  </Section>
{/if}
