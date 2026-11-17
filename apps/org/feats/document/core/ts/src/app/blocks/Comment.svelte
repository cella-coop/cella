<script lang="ts">
  import { Button, Conversation, Floating, Form, Hidden, Icon, icons, Message, Note, Remark, Rich, RichField } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'
  import { useQuote } from '../../hooks/useQuote.ts'

  // Where a document is commented on, under its Activity: each comment a
  // card, oldest first, in its rich text under the version it is on and
  // what it quotes, if anything, a resolved one folded to a line; and the
  // box under them, always there, which comments on the latest saved
  // version, the one the reader is viewing, as a whole. Select text in
  // its draft and a Comment button floats at the end of the selection; it
  // attaches the selection to the box as its quote, inside the box's top,
  // which `document.quotes` checks. A document with no version yet takes
  // no comment.
  let { data }: { data: Page; id: string } = $props()

  const quote = useQuote(() => data.comments.length)
  const latest = $derived(data.versions[0])
  const comments = $derived([...data.comments].reverse())
</script>

{#each comments as c (c.id)}
  <div data-thread={c.id} data-resolved={c.resolved ? 'true' : ''}>
    <Conversation resolved={c.resolved ? 'Resolved' : null}>
      <Message author={c.author} at={c.at}>
        {#if c.quote}
          <Remark on="On {c.version}" quote={c.quote} />
        {/if}
        <Rich text={c.text} />
      </Message>
    </Conversation>
  </div>
{/each}
{#if !latest}
  <Note text="Save a version to comment on it" />
{:else}
  {#snippet attached()}
    {#if quote.quote}
      {#key quote.quote}
        <Remark on="On version {latest.n}" quote={quote.quote} ondrop={() => quote.drop()} />
      {/key}
    {/if}
  {/snippet}
  <div data-box>
    <Form action="comment" bare>
      <Hidden name="version" value={latest.id} />
      <Hidden name="quote" value={quote.quote ?? ''} />
      <RichField label="Comment" name="text" placeholder="Comment on the document, or select text in it to quote" send="Comment" head={quote.quote ? attached : undefined} />
    </Form>
  </div>
  {#if quote.at}
    <Floating x={quote.at.x} y={quote.at.y} label="Comment on the selection" role="toolbar">
      <Button aria-label="Quote the selection" onclick={() => quote.attach()}><Icon icon={icons.ChatCircle} /> Comment</Button>
    </Floating>
  {/if}
{/if}
