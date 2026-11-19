<script lang="ts">
  import { Button, Conversation, Empty, Form, Hidden, Icon, icons, Mention, Message, Note, plain, Remark, Rich, RichField, type Embeds } from '@cella/org-ui'
  import type { Detail } from '../../models/motion.ts'
  import { conversations, parts } from '../../models/thread.ts'
  import { useThread } from '../../hooks/useThread.ts'

  // The motion's deliberation, under its Activity like any record's
  // threads: each conversation a card, its messages in their rich text
  // under the one each answers, their mentions and links drawn by the
  // slices that know members and documents. While it is open, a message's
  // Reply, at its top right on hover, goes to the box at its card's foot,
  // which answers the card's first message, or the one Reply chose, said
  // inside its top; the box under the cards starts a conversation, `@`
  // mentioning a member and `[[…]]` linking a document. Members seated in
  // its circle post; the guards refuse anyone else.
  let { data, embeds = {} }: { data: Detail; id: string; embeds?: Embeds } = $props()

  const thread = useThread(() => data.messages)
  const cards = $derived(conversations(data.messages))
  const member = $derived(embeds.member)
  const document = $derived(embeds.document)
  const local = (address: string) => address.split('@')[0]
</script>

{#snippet person(ref: string, label: string)}{#if member}<member.embed.block {ref} data={member.data} />{:else}<Mention {label} />{/if}{/snippet}

{#snippet words(text: string)}{#each parts(text) as p, i (i)}{#if 'mention' in p}{@render person(p.mention, `@${p.mention}`)}{:else if 'link' in p}{#if document}<document.embed.block ref={p.link} data={document.data} />{:else}<Mention label={p.link} />{/if}{:else}{p.text}{/if}{/each}{/snippet}

{#each cards as card (card.root.receipt)}
  {const answering = $derived(card.messages.find((m) => m.receipt === thread.reply && m.receipt !== card.root.receipt) ?? null)}
  {#snippet answered()}
    {#if answering}
      <Remark on="Replying to {local(answering.member)}" quote={plain(answering.body)} ondrop={() => thread.drop()} />
    {/if}
  {/snippet}
  {#snippet replying()}
    <Form action="post" bare>
      <Hidden name="reply" value={answering?.receipt ?? card.root.receipt} />
      <RichField label="Reply to {local(card.root.member)}" name="body" rows={1} placeholder="Leave a reply…" send="Reply" head={answering ? answered : undefined} />
    </Form>
  {/snippet}
  <div data-thread={card.root.receipt}>
    <Conversation reply={data.closed ? undefined : replying}>
      {#each card.messages as m (m.receipt)}
        {#snippet who()}{@render person(m.member, local(m.member))}{/snippet}
        {#snippet actions()}
          <Button icon title="Reply" aria-label="Reply" onclick={() => thread.answer(m.receipt, card.root.receipt)}><Icon icon={icons.ArrowBendUpLeft} /></Button>
        {/snippet}
        <Message author={m.member} at={m.at} depth={m.depth} marked={thread.reply === m.receipt} {who} actions={data.closed ? undefined : actions}>
          <Rich text={m.body} {words} />
        </Message>
      {/each}
    </Conversation>
  </div>
{:else}
  <Empty text="No comments yet" />
{/each}
{#if !data.closed}
  <div data-box>
    <Form action="post" bare>
      <Hidden name="reply" value="" />
      <RichField label="Message" name="body" placeholder="Say why; @name mentions a member, [[document]] links one" send="Post" />
    </Form>
  </div>
{:else}
  <Note text="Closed on {data.closed}: the discussion is over." />
{/if}
