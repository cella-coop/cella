<script lang="ts">
  import { date, Field, Form, Section, Table, type Column } from '@cella/org-ui'
  import type { Text, Texts } from '../../models/reading.ts'

  // Joining's reading: each text the coop adopted, in its binding
  // version, and whether the member has read it; a member marks their own.
  let { data }: { data: Texts; id: string } = $props()

  const columns: Column<Text>[] = [
    { key: 'step', label: 'Step', value: (t) => `Read ${t.title}` },
    { key: 'state', label: 'State', kind: 'badge', value: (t) => (t.read ? 'done' : 'to do'), tone: (t) => (t.read ? 'positive' : 'accent') },
    { key: 'what', label: 'What', value: (t) => (t.read ? `${t.version}, read ${date(t.read)}` : `${t.version}, adopted ${date(t.adopted)}`) },
  ]
  const unread = $derived(data.texts.filter((t) => !t.read).map((t) => ({ value: t.version, label: t.title })))
</script>

<Section title="Texts">
  <Table {columns} rows={data.texts} href={(t: Text) => `/documents/${t.document}`} empty="The coop has adopted no text yet." />
  {#if data.own && unread.length}
    <Form action="read" submit="Mark read" tone="quiet" inline>
      <Field label="Text" name="version" options={unread} value={unread[0].value} />
    </Form>
  {/if}
</Section>
