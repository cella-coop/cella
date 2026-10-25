<script lang="ts">
  import { Section, Sheet } from '@cella/org-ui'
  import type { Statements } from '../../models/statement.ts'

  // The balance sheet at the end of the span and of the span before it.
  let { data }: { data: Statements; id: string } = $props()
</script>

<Section title="Balance sheet">
  <Sheet columns={data.columns} rows={data.balance} />
</Section>
