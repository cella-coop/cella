<script lang="ts">
  import Form from './Form.svelte'
  import Hidden from './Hidden.svelte'

  // A message's reactions, a line of its own at its foot: each emoji
  // with how many gave it. Where `action` names a write, each toggles the
  // reader's own, posting the `fields` given with its emoji and whether it
  // turns on, the reader's own filled; where none does, those given are
  // read, and none given shows nothing.
  let {
    items,
    action,
    fields = {},
  }: {
    items: { emoji: string; count: number; mine: boolean }[]
    action?: string
    fields?: Record<string, string | number>
  } = $props()

  const shown = $derived(action ? items : items.filter((r) => r.count > 0))
</script>

{#if shown.length}
  <div class="reactions" data-reactions>
    {#each shown as r (r.emoji)}
      <span class="reaction" class:mine={r.mine} data-reaction={r.emoji} data-count={r.count} data-mine={r.mine}>
        {#if action}
          <Form {action} submit={r.count ? `${r.emoji} ${r.count}` : r.emoji} tone={r.mine ? 'primary' : 'quiet'} inline>
            {#each Object.entries(fields) as [name, value] (name)}
              <Hidden {name} {value} />
            {/each}
            <Hidden name="emoji" value={r.emoji} />
            <Hidden name="on" value={r.mine ? '' : 'true'} />
          </Form>
        {:else}
          {r.emoji} {r.count}
        {/if}
      </span>
    {/each}
  </div>
{/if}

<style>
  .reactions {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
  }
  .reaction {
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .mine {
    color: var(--text);
  }
</style>
