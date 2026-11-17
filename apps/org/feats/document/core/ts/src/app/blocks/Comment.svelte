<script lang="ts">
  import { Button, Field, Floating, Form, Hidden, Icon, icons, Note, Remark } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'
  import { useQuote } from '../../hooks/useQuote.ts'

  // Where a document is commented on: the box under its Activity, always
  // there, comments on the latest saved version, the one the reader is
  // viewing, as a whole. Select text in its draft and a Comment button
  // floats at the end of the selection; it attaches the selection to the
  // box as its quote, which `document.quotes` checks, and the box then
  // says the version it is on. A document with no version yet takes no
  // comment.
  let { data }: { data: Page; id: string } = $props()

  const quote = useQuote(() => data.comments.length)
  const latest = $derived(data.versions[0])
</script>

{#if !latest}
  <Note text="Save a version to comment on it" />
{:else}
  <Remark on="on version {latest.n}" quote={quote.quote} ondrop={() => quote.drop()}>
    <Form action="comment" submit="Comment" end>
      <Hidden name="version" value={latest.id} />
      <Hidden name="quote" value={quote.quote ?? ''} />
      <Field label="Comment" name="text" rows={3} placeholder="Comment on the document, or select text in it to quote" required wide />
    </Form>
  </Remark>
  {#if quote.at}
    <Floating x={quote.at.x} y={quote.at.y} label="Comment on the selection" role="toolbar">
      <Button aria-label="Quote the selection" onclick={() => quote.attach()}><Icon icon={icons.ChatCircle} /> Comment</Button>
    </Floating>
  {/if}
{/if}
