<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'

  // The box under a document's Activity that comments on a version, on
  // text it quotes, which `document.quotes` checks; a document with no
  // version yet takes no comment; the box is on the latest.
  let { data }: { data: Page; id: string } = $props()

  const options = $derived(data.versions.map((v) => ({ value: v.id, label: v.id })))
</script>

{#if options.length}
  <Form action="comment" submit="Comment">
    <Field label="On version" name="version" {options} value={options[0].value} />
    <Field label="Quoting" name="quote" placeholder="text the version holds" required />
    <Field label="Comment" name="text" rows={3} required wide />
  </Form>
{/if}
