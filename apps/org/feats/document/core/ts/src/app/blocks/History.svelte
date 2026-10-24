<script lang="ts">
  import { Field, Form, Section, short, Table, type Column } from '@cella/org-ui'
  import type { Note, Page, Version } from '../../models/document.ts'

  // The saved versions, the adopted one marked, and the comments on them,
  // each anchored by the text it quotes, which `document.quotes` checks.
  let { data }: { data: Page; id: string } = $props()

  const versions: Column<Version>[] = [
    { key: 'n', label: 'Version', kind: 'title', value: (v) => v.id },
    { key: 'saved', label: 'Saved', kind: 'date', value: (v) => v.saved },
    { key: 'hash', label: 'BLAKE3', kind: 'mono', value: (v) => short(v.hash, 16) },
    { key: 'adopted', label: 'Binding', kind: 'badge', value: (v) => (v.adopted ? 'adopted' : null), tone: () => 'positive' },
  ]
  const comments: Column<Note>[] = [
    { key: 'author', label: 'Author', kind: 'title', value: (c) => c.author.split('@')[0] },
    { key: 'version', label: 'On', kind: 'mono', value: (c) => c.version },
    { key: 'quote', label: 'Quoting', value: (c) => `“${c.quote}”` },
    { key: 'text', label: 'Comment', value: (c) => c.text },
    { key: 'at', label: 'At', kind: 'date', value: (c) => c.at },
  ]
  const options = $derived(data.versions.map((v) => ({ value: v.id, label: v.id })))
</script>

<Section title="Saved versions" count={data.versions.length}>
  <Table columns={versions} rows={data.versions} />
</Section>

<Section title="Comments" count={data.comments.length}>
  {#if data.comments.length}
    <Table columns={comments} rows={data.comments} />
  {/if}
  {#if options.length}
    <Form action="comment" submit="Comment">
      <Field label="On version" name="version" {options} />
      <Field label="Quoting" name="quote" placeholder="text the version holds" required />
      <Field label="Comment" name="text" required wide />
    </Form>
  {/if}
</Section>
