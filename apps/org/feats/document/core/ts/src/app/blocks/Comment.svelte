<script lang="ts">
  import { Button, Field, Floating, Form, Hidden, Icon, icons, Note, Remark } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'
  import { useQuote } from '../../hooks/useQuote.ts'

  // Where a document is commented on: select text in its draft and a
  // Comment button floats at the end of the selection; it opens the box,
  // which quotes the selection, as `document.quotes` checks, and is on the
  // latest saved version, the one the reader is viewing. With nothing
  // selected it says how; a document with no version yet takes no comment.
  let { data }: { data: Page; id: string } = $props()

  const quote = useQuote(() => data.comments.length)
  const latest = $derived(data.versions[0])
</script>

{#if !latest}
  <Note text="Save a version to comment on it" />
{:else if quote.open}
  <Remark on="on version {latest.n}" quote={quote.quote} onclose={() => quote.close()}>
    <Form action="comment" submit="Comment" end>
      <Hidden name="version" value={latest.id} />
      <Hidden name="quote" value={quote.quote} />
      <Field label="Comment" name="text" rows={3} required wide />
    </Form>
  </Remark>
{:else}
  <Note text="Select text in the document to comment on it" />
  {#if quote.at}
    <Floating x={quote.at.x} y={quote.at.y} label="Comment on the selection" role="toolbar">
      <Button onclick={() => quote.begin()}><Icon icon={icons.ChatCircle} /> Comment</Button>
    </Floating>
  {/if}
{/if}
