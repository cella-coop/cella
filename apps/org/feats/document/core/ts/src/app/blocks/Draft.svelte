<script lang="ts">
  import { Button, Field, Form, Section } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'
  import { useDraft } from '../../hooks/useDraft.ts'

  // The draft in a plain text area: saving sends the difference as one Loro
  // update, merged with everyone else's. A live collaborative editor is not
  // built; two members editing at once each send their own update, and
  // Loro merges them.
  let { data }: { data: Page; id: string } = $props()

  const draft = useDraft(() => data.draft)
</script>

<Section title="Draft">
  <Form action="edit" submit="Save edit" reset={false}>
    <Field label="Markdown, merged from every update" name="text" rows={18} bind:value={draft.text} wide />
  </Form>
  {#if draft.dirty}
    <div><Button onclick={() => draft.revert()}>Discard changes</Button></div>
  {/if}
</Section>

<Section title="Versions">
  <Form action="version" submit="Save the draft as a version" tone="quiet" />
</Section>
