<script lang="ts">
  import { Section, short, Table, type Column } from '@cella/org-ui'
  import type { Page, Version } from '../../models/document.ts'

  // The saved versions, each named by its canonical hash, the adopted one
  // marked. The comments on them are the page's Activity.
  let { data }: { data: Page; id: string } = $props()

  const versions: Column<Version>[] = [
    { key: 'n', label: 'Version', kind: 'title', value: (v) => v.id },
    { key: 'saved', label: 'Saved', kind: 'date', value: (v) => v.saved },
    { key: 'hash', label: 'Hash', kind: 'mono', value: (v) => short(v.hash, 16) },
    { key: 'adopted', label: 'Binding', kind: 'badge', value: (v) => (v.adopted ? 'adopted' : null), tone: () => 'positive' },
  ]
</script>

<Section title="Saved versions" count={data.versions.length}>
  <Table columns={versions} rows={data.versions} />
</Section>
