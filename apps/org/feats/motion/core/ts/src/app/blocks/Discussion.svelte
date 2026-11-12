<script lang="ts">
  import { Button, Field, Form, Hidden, Mention, Message, Note, Section, type Embeds } from '@cella/org-ui'
  import type { Detail } from '../../models/motion.ts'
  import { parts, threaded } from '../../models/thread.ts'
  import { useThread } from '../../hooks/useThread.ts'

  // The motion's deliberation: each message under the one it answers,
  // its mentions and links drawn by the slices that know members and
  // documents, and, while it is open, a message as the acting member,
  // `@` mentioning a member and `[[…]]` linking a document. Members seated
  // in its circle post; the guards refuse anyone else.
  let { data, embeds = {} }: { data: Detail; id: string; embeds?: Embeds } = $props()

  const thread = useThread(() => data.messages)
  const shown = $derived(threaded(data.messages))
  const member = $derived(embeds.member)
  const document = $derived(embeds.document)
  const local = (address: string) => address.split('@')[0]
</script>

{#snippet person(ref: string, label: string)}{#if member}<member.embed.block {ref} data={member.data} />{:else}<Mention {label} />{/if}{/snippet}

<Section title="Discussion" count={data.messages.length}>
  {#each shown as m (m.receipt)}
    <Message at={m.at} depth={m.depth} marked={thread.reply === m.receipt}>
      {#snippet who()}{@render person(m.member, local(m.member))}{/snippet}
      {#each parts(m.body) as p, i (i)}{#if 'mention' in p}{@render person(p.mention, `@${p.mention}`)}{:else if 'link' in p}{#if document}<document.embed.block ref={p.link} data={document.data} />{:else}<Mention label={p.link} />{/if}{:else}{p.text}{/if}{/each}
      {#snippet actions()}
        {#if !data.closed}
          <Button onclick={() => thread.answer(m.receipt)}>Reply</Button>
        {/if}
      {/snippet}
    </Message>
  {:else}
    <Note text="No one has said anything yet." />
  {/each}
  {#if !data.closed}
    {#if thread.answering}
      <Note text="Replying to {local(thread.answering.member)}, {thread.answering.at}." />
      <Button onclick={() => thread.drop()}>Not a reply</Button>
    {/if}
    <Form action="post" submit={thread.answering ? 'Reply' : 'Post'}>
      <Hidden name="reply" value={thread.reply ?? ''} />
      <Field label="Message" name="body" rows={3} placeholder="Say why; @name mentions a member, [[document]] links one" required wide />
    </Form>
  {:else}
    <Note text="Closed on {data.closed}: the discussion is over." />
  {/if}
</Section>
