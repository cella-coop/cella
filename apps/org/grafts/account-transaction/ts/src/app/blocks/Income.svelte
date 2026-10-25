<script lang="ts">
  import { Section, Sheet } from '@cella/org-ui'
  import type { Statements } from '../../models/statement.ts'

  // The span's income statement against the span before it.
  let { data }: { data: Statements; id: string } = $props()
</script>

<Section title="Income statement">
  <Sheet columns={data.columns} rows={data.income} />
</Section>
