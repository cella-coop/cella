<script lang="ts">
  import { Button, Field, Form, Hidden, Note } from '@cella/org-ui'
  import { label, threads, type Comment, type Named } from '../models/thread.ts'
  import { useThreads } from '../hooks/useThreads.ts'
  import Thread from './Thread.svelte'

  // A record's threads in its Activity, oldest first, and the box that
  // posts a comment through the feat's `post` write, or a reply to the
  // root chosen; typing `@` opens the mention picker, which offers the
  // people who may read the record and inserts their `@name`, posted as
  // their `@[address]`. One who may not discuss the record reads the
  // threads and has no box. Each comment takes reactions where
  // `reactions` says its circle has them on, toggled through `react`.
  let {
    comments,
    readers,
    discuss,
    post,
    resolve,
    react = '',
    reactions = false,
  }: {
    comments: Comment[]
    readers: Named[]
    discuss: boolean
    post: string
    resolve: string
    react?: string
    reactions?: boolean
  } = $props()

  const box = useThreads(
    () => comments,
    () => readers,
  )
  const shown = $derived(threads(comments))
  const answering = $derived(shown.find((t) => t.root.id === box.reply)?.root ?? null)
  const posted = $derived(box.posted)
</script>

{#each shown as t (t.root.id)}
  <Thread thread={t} {resolve} {react} {reactions} {discuss} replying={box.reply === t.root.id} onreply={() => box.answer(t.root.id)} />
{/each}
{#if discuss}
  {#if answering}
    <Note text="Replying to {label({ person: answering.author, name: answering.name }, answering.author)}, {answering.posted}." />
    <Button onclick={() => box.drop()}>Not a reply</Button>
  {/if}
  <div data-box>
    <Form action={post} submit={answering ? 'Reply' : 'Comment'} ready={posted.text.trim() !== ''}>
      <Hidden name="parent" value={answering?.id ?? ''} />
      <Hidden name="text" value={posted.text} />
      <Field label="Comment" name="typed" rows={3} placeholder="Say what you think; @ mentions someone" wide bind:value={box.typed} />
    </Form>
    {#if box.offered.length}
      <div data-picker>
        {#each box.offered as r (r.person)}
          <Button onclick={() => box.pick(r)}>{r.name}</Button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
