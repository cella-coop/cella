<script lang="ts">
  import { onMount } from 'svelte'
  import { Form, Hidden, RichField } from '@cella/org-ui'
  import { threads, type Comment, type Named } from '../models/thread.ts'
  import { useThreads } from '../hooks/useThreads.ts'
  import Thread from './Thread.svelte'

  // A record's threads in its Activity, oldest first, each a card that
  // replies at its foot, and under them the box that starts one, through
  // the feat's `post` write, written rich (`RichField`); typing `@` opens
  // the mention picker, which offers the people who may read the record
  // and puts in their name as a chip, posted as their `@[address]`. One
  // who may not discuss the record reads the threads and has no box.
  // Each comment takes reactions where `reactions` says its circle has
  // them on, toggled through `react`. `readers` is edit-time data: who the
  // mention picker may offer, fetched in the browser once the box mounts,
  // empty until it arrives, never awaited with the record at SSR.
  let {
    comments,
    readers = async () => [],
    discuss,
    post,
    resolve,
    react = '',
    reactions = false,
  }: {
    comments: Comment[]
    readers?: () => Promise<Named[]>
    discuss: boolean
    post: string
    resolve: string
    react?: string
    reactions?: boolean
  } = $props()

  const box = useThreads(() => readers())
  // Only a box that can be written in needs whom to mention.
  onMount(() => {
    if (discuss) {
      box.load()
    }
  })
  const shown = $derived(threads(comments))
</script>

{#each shown as t (t.root.id)}
  <Thread thread={t} {post} {resolve} {react} {reactions} {discuss} suggest={box.suggest} onreply={() => box.answer(t.root.id)} />
{/each}
{#if discuss}
  <div data-box>
    <Form action={post} bare>
      <Hidden name="parent" value="" />
      <RichField label="Comment" name="text" placeholder="Leave a comment…" send="Comment" suggest={box.suggest} />
    </Form>
  </div>
{/if}
