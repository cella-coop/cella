<script lang="ts">
  import { Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { OnFile } from '../../models/record.ts'

  // The records on the worker's file, each opening as its file, and another
  // filed; whoever hires files them.
  let { data }: { data: { records: OnFile[] }; id: string } = $props()

  const columns: Column<OnFile>[] = [
    { key: 'name', label: 'Record', value: (r) => r.name },
    { key: 'uploaded', label: 'Filed', kind: 'date', value: (r) => r.uploaded },
    { key: 'uploader', label: 'By', kind: 'mono', value: (r) => r.uploader },
  ]
</script>

<Section title="Employment records" count={data.records.length}>
  <Table {columns} rows={data.records} href={(r: OnFile) => `/files/${r.id}/content`} empty="No employment records yet: the contract, its amendments and the papers of the hire are filed here." />
  <Form action="contract" submit="File" tone="quiet" inline>
    <Field label="A record" name="file" type="file" required />
  </Form>
</Section>
