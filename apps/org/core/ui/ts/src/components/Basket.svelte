<script lang="ts">
  import X from 'phosphor-svelte/lib/X'
  import { useBasket } from '../hooks/useBasket.ts'
  import Button from './Button.svelte'
  import Icon from './Icon.svelte'

  // The changes to propose, in the settings pages' sidebar, standing
  // there while any wait: for each circle that decides some, how many
  // there are, each by whose setting and which, from what to what in a
  // line, with its own removal; Review and propose opens the one motion
  // proposing them all (`ProposeBasket`), and Discard drops them.
  const basket = useBasket()
</script>

{#if basket}
  <div class="basket">
    {#each basket.baskets as b (b.circle)}
      <section class="circle" aria-labelledby="basket-{b.circle}">
        <h2 id="basket-{b.circle}">
          {b.changes.length}
          {b.changes.length === 1 ? 'change' : 'changes'} to propose to {b.name}
        </h2>
        <ul>
          {#each b.changes as c (`${c.page}/${c.id}/${c.field}`)}
            <li>
              <span class="what"
                >{#if c.where}<span class="where">{c.where} ·</span>{/if}
                {c.label}</span
              >
              {#if c.shape === 'value'}
                <span class="line"><s>{c.shown?.was ?? (c.was || 'Empty')}</s> → {c.shown?.value ?? (c.value || 'Empty')}</span>
              {:else}
                <span class="line">{c.title}</span>
              {/if}
              <button type="button" class="remove" aria-label="Take {c.label} out of the changes to propose" title="Take it out" onclick={() => basket.remove(b.circle, c)}>
                <Icon icon={X} />
              </button>
            </li>
          {/each}
        </ul>
        <div class="buttons">
          <Button tone="primary" onclick={() => basket.review(b.circle)}>Review and propose</Button>
          <Button onclick={() => basket.discard(b.circle)}>Discard</Button>
        </div>
      </section>
    {:else}
      <p class="none">No changes to propose. A change only a motion makes waits here until you propose it.</p>
    {/each}
  </div>
{/if}

<style>
  .basket {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-3);
  }
  .circle {
    display: grid;
    gap: var(--space-2);
  }
  h2 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-1);
  }
  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-xs);
  }
  .what {
    font-weight: 500;
    color: var(--text);
  }
  .where {
    color: var(--text-muted);
    font-weight: 400;
  }
  .line {
    grid-column: 1;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  .line s {
    color: var(--text-subtle);
  }
  .remove {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-subtle);
    cursor: pointer;
  }
  .remove:hover {
    background: var(--hover);
    color: var(--negative-text);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .none {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
</style>
