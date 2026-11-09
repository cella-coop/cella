<script lang="ts">
  import { Button, Form, Hidden, Mention, Message, Note } from '@cella/org-ui'
  import { label, parts, type Comment, type Thread } from '../models/thread.ts'

  // One thread: its root, and under it its replies, one level, each
  // drawing its mentions by the person's name as it stands. A resolved
  // root folds its replies away. One who may discuss the record replies
  // to the root and resolves or reopens it, through the feat's `resolve`
  // write; one who may not reads it.
  let {
    thread,
    resolve,
    discuss,
    replying = false,
    onreply,
  }: {
    thread: Thread
    resolve: string
    discuss: boolean
    replying?: boolean
    onreply?: () => void
  } = $props()

  const root = $derived(thread.root)
  const shown = $derived(root.resolved ? [] : thread.replies)
</script>

{#snippet said(c: Comment, depth: number)}
  <div data-comment={c.id}>
    <Message at={c.posted} {depth} marked={depth === 0 && replying}>
      {#snippet who()}<Mention label={label({ person: c.author, name: c.name }, c.author)} title={c.author} />{/snippet}
      {#each parts(c.text) as p, i (i)}{#if 'mention' in p}<Mention label="@{label(c.mentions.find((m) => m.person === p.mention), p.mention)}" title={p.mention} />{:else}{p.text}{/if}{/each}
      {#snippet actions()}
        {#if depth === 0 && discuss}
          {#if !root.resolved}
            <Button onclick={() => onreply?.()}>Reply</Button>
          {/if}
          <Form action={resolve} submit={root.resolved ? 'Reopen' : 'Resolve'} tone="quiet" inline>
            <Hidden name="comment" value={root.id} />
            <Hidden name="resolved" value={root.resolved ? '' : 'true'} />
          </Form>
        {/if}
      {/snippet}
    </Message>
  </div>
{/snippet}

<div data-thread={root.id} data-resolved={root.resolved ?? ''}>
  {@render said(root, 0)}
  {#if root.resolved}
    <Note text="Resolved on {root.resolved}{thread.replies.length ? `, its ${thread.replies.length === 1 ? 'reply' : `${thread.replies.length} replies`} folded away` : ''}." />
  {/if}
  {#each shown as r (r.id)}
    {@render said(r, 1)}
  {/each}
</div>
