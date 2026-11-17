<script lang="ts">
  import { AddReaction, Button, Conversation, Form, Hidden, Icon, icons, Mention, Message, Reactions, Rich, RichField, date, type Suggest } from '@cella/org-ui'
  import { label, parts, tally, type Comment, type Thread } from '../models/thread.ts'

  // One thread, a `Conversation`: its root and under it its replies, one
  // level, each in its rich text, drawing its mentions by the person's
  // name as it stands, and at its foot the box that replies, through the
  // feat's `post` write. At each comment's top right, shown on hover, a
  // smiley adds a reaction where the record's circle takes them, and on
  // the root Reply, which goes to that box, and Resolve, through the
  // feat's `resolve` write; a resolved root folds its thread to one line,
  // which opens it, and offers Reopen. Reactions given are chips under a
  // comment's text, toggled through the feat's `react` write. One who may
  // not discuss the record reads it all and has none of these.
  let {
    thread,
    post,
    resolve,
    react = '',
    reactions = false,
    discuss,
    suggest,
    onreply,
  }: {
    thread: Thread
    post: string
    resolve: string
    // The feat's write toggling a reaction, and whether the circle takes them.
    react?: string
    reactions?: boolean
    discuss: boolean
    suggest?: Suggest
    onreply?: () => void
  } = $props()

  const root = $derived(thread.root)
</script>

{#snippet said(c: Comment, depth: number)}
  {#snippet words(text: string)}{#each parts(text) as p, i (i)}{#if 'mention' in p}<Mention label="@{label(c.mentions.find((m) => m.person === p.mention), p.mention)}" title={p.mention} />{:else}{p.text}{/if}{/each}{/snippet}
  {#snippet chips()}<Reactions items={tally(c.reactions)} action={discuss && react ? react : undefined} fields={{ comment: c.id }} />{/snippet}
  {#snippet actions()}
    {#if discuss && reactions && react}
      <AddReaction items={tally(c.reactions)} action={react} fields={{ comment: c.id }} />
    {/if}
    {#if depth === 0 && discuss && !root.resolved}
      <Button icon title="Reply" aria-label="Reply" onclick={() => onreply?.()}><Icon icon={icons.ArrowBendUpLeft} /></Button>
    {/if}
    {#if depth === 0 && discuss}
      <Form action={resolve} bare>
        <Hidden name="comment" value={root.id} />
        <Hidden name="resolved" value={root.resolved ? '' : 'true'} />
        <Button type="submit" icon title={root.resolved ? 'Reopen' : 'Resolve'} aria-label={root.resolved ? 'Reopen' : 'Resolve'}>
          <Icon icon={root.resolved ? icons.ArrowCounterClockwise : icons.CheckCircle} />
        </Button>
      </Form>
    {/if}
  {/snippet}
  <div data-comment={c.id}>
    <Message
      author={c.author}
      name={c.name === 'redacted' ? 'erased' : c.name}
      at={c.posted}
      {depth}
      actions={discuss || (reactions && react) ? actions : undefined}
      foot={reactions && c.reactions.some((r) => r.count > 0) ? chips : undefined}
    >
      <Rich text={c.text} {words} />
    </Message>
  </div>
{/snippet}

{#snippet replying()}
  <Form action={post} bare>
    <Hidden name="parent" value={root.id} />
    <RichField label="Reply to {label({ person: root.author, name: root.name }, root.author)}" name="text" rows={1} placeholder="Leave a reply…" send="Reply" {suggest} />
  </Form>
{/snippet}

<div data-thread={root.id} data-resolved={root.resolved ?? ''}>
  <Conversation resolved={root.resolved ? `Resolved on ${date(root.resolved)}` : null} reply={discuss && !root.resolved ? replying : undefined}>
    {@render said(root, 0)}
    {#each thread.replies as r (r.id)}
      {@render said(r, 1)}
    {/each}
  </Conversation>
</div>
