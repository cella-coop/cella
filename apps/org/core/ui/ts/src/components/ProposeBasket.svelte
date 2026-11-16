<script lang="ts">
  import { posted, titled } from '../models/basket.ts'
  import { useBasket } from '../hooks/useBasket.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { took } from '../post.ts'
  import Diff from './Diff.svelte'
  import Dialog from './Dialog.svelte'
  import Field from './Field.svelte'

  // One motion proposing a circle's changes to propose, all of them: a
  // `Dialog` showing each change as its diff (`Diff`), a tree for an
  // arrangement and the value in force struck through for the rest, and
  // the motions' New form prefilled, its title, the circle that decides,
  // its deadline and its proposal, which the reader may change. Propose
  // posts it to the settings page's `action` with where each change is
  // made and its value, which the server turns into the motion's actions;
  // once proposed the basket empties. A refusal keeps it open, saying
  // why; Cancel keeps the changes waiting.
  let { action = 'basket' }: { action?: string } = $props()

  const basket = useBasket()
  const writes = useWrites()

  async function onsubmit(fields: [string, string][]) {
    if (!basket?.propose()) {
      return
    }
    let proposed = false
    let reason: string | undefined
    try {
      const first = basket.under?.changes[0]
      const result = await writes.shown(writes.send(action, fields, first?.id, first?.page))
      proposed = took(result)
      reason = !proposed && 'done' in result ? result.done?.reason : undefined
    } finally {
      basket.answered(proposed, reason)
    }
  }
</script>

{#if basket}
  <Dialog
    bind:dialog={basket.dialog}
    title={basket.under ? `Propose to ${basket.under.name}` : ''}
    submit={basket.under ? `Propose ${basket.under.changes.length === 1 ? 'it' : `all ${basket.under.changes.length}`} to ${basket.under.name}` : 'Propose'}
    busy={basket.proposing}
    problem={basket.problem}
    {onsubmit}
    oncancel={() => basket.close()}
    onclose={() => basket.closed()}
  >
    {#snippet lead()}
      {#if basket.under}
        {const b = $derived(basket.under)}
        <p class="lead">
          One motion of {b.name} makes {b.changes.length === 1 ? 'this change' : `these ${b.changes.length} changes`}, since no write of yours does.
        </p>
        <div class="changes">
          {#each b.changes as c (`${c.page}/${c.id}/${c.field}`)}
            <Diff
              shape={c.shape}
              label={c.where ? `${c.where} · ${c.label}` : c.label}
              was={c.shape === 'value' ? (c.shown?.was ?? c.was) : c.was}
              value={c.shape === 'value' ? (c.shown?.value ?? c.value) : c.value}
            />
          {/each}
        </div>
      {/if}
    {/snippet}
    {#if basket.under}
      {const b = $derived(basket.under)}
      <Field label="Title" name="title" value={titled(b)} required wide />
      <Field label="Circle" name="circle" options={[{ value: b.circle, label: b.name }]} value={b.circle} required />
      <Field label="Deadline" name="deadline" type="date" value={b.deadline} required />
      <input type="hidden" name="changes" value={posted(b)} />
      <Field label="Proposal" name="body" rows={3} wide />
    {/if}
  </Dialog>
{/if}

<style>
  .lead {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
  .changes {
    display: grid;
    gap: var(--space-2);
    max-height: 40vh;
    overflow: auto;
  }
</style>
