<script lang="ts">
  import Form from './Form.svelte'
  import Hidden from './Hidden.svelte'

  // A message's reactions under its text: a small chip for each emoji
  // given, with how many gave it, the reader's own tinted; none given
  // draws nothing (`AddReaction` gives the first). Where `action` names a
  // write, a chip toggles the reader's own, posting the `fields` given
  // with its emoji and whether it turns on; where none does, it is read.
  let {
    items,
    action,
    fields = {},
  }: {
    items: { emoji: string; count: number; mine: boolean }[]
    action?: string
    fields?: Record<string, string | number>
  } = $props()

  const shown = $derived(items.filter((r) => r.count > 0))
</script>

{#if shown.length}
  <div class="reactions" data-reactions>
    {#each shown as r (r.emoji)}
      {const said = $derived(`${r.emoji} ${r.count}${r.mine ? ', yours' : ''}`)}
      {#if action}
        <Form {action} bare>
          {#each Object.entries(fields) as [name, value] (name)}
            <Hidden {name} {value} />
          {/each}
          <Hidden name="emoji" value={r.emoji} />
          <Hidden name="on" value={r.mine ? '' : 'true'} />
          <button type="submit" class="chip" class:mine={r.mine} aria-pressed={r.mine} aria-label={said} title={r.mine ? 'Take yours back' : 'Add yours'} data-reaction={r.emoji} data-count={r.count} data-mine={r.mine}>
            <span>{r.emoji}</span><span class="count">{r.count}</span>
          </button>
        </Form>
      {:else}
        <span class="chip" class:mine={r.mine} aria-label={said} data-reaction={r.emoji} data-count={r.count} data-mine={r.mine}>
          <span>{r.emoji}</span><span class="count">{r.count}</span>
        </span>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .reactions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    height: 1.5rem;
    padding: 0 0.5em;
    border: 1px solid color-mix(in oklab, var(--text) 10%, transparent);
    border-radius: var(--radius-pill);
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: var(--text-xs);
    line-height: 1;
  }
  button.chip {
    cursor: pointer;
  }
  button.chip:hover {
    background: var(--hover);
  }
  .mine {
    border-color: var(--accent-border);
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  button.mine:hover {
    background: var(--accent-soft);
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
</style>
