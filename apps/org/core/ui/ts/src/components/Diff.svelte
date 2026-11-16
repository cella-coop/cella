<script lang="ts">
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight'
  import ArrowsDownUp from 'phosphor-svelte/lib/ArrowsDownUp'
  import Minus from 'phosphor-svelte/lib/Minus'
  import Plus from 'phosphor-svelte/lib/Plus'
  import { arranged, named as capital } from '../models/diff.ts'
  import Icon from './Icon.svelte'

  // A change as a diff, in its own terms (`models/diff.ts`): an
  // arrangement as its tree once changed, each choice marked added, moved
  // from where it was or reordered, a new accordion marked, and the
  // choices it no longer shows listed struck through; a plain value as
  // the one in force struck through and the new one after it. Each mark
  // is a word as well as a colour, so assistive technology reads it.
  let {
    shape,
    label,
    was,
    value,
    named = capital,
  }: {
    shape: 'arrangement' | 'value'
    label: string
    was: string
    value: string
    named?: (value: string) => string
  } = $props()

  const tree = $derived(shape === 'arrangement' ? arranged(was, value) : null)
</script>

<figure class="diff">
  <figcaption>{label}</figcaption>
  {#if tree}
    <ul class="tree">
      {#each tree.lines as line, i (line.kind === 'head' ? `h:${line.group}` : `c:${line.value}:${i}`)}
        {#if line.kind === 'head'}
          <li class="head" class:added={line.added}>
            {line.group}{#if line.added}<span class="tag"><Icon icon={Plus} size="0.8rem" /> new accordion</span>{/if}
          </li>
        {:else}
          <li class="choice" class:inner={line.depth === 1} data-mark={line.mark}>
            <span>{named(line.value)}</span>
            {#if line.mark === 'added'}
              <span class="tag"><Icon icon={Plus} size="0.8rem" /> added</span>
            {:else if line.mark === 'moved'}
              <span class="tag"><Icon icon={ArrowRight} size="0.8rem" /> moved from {line.from ?? 'the top level'}</span>
            {:else if line.mark === 'reordered'}
              <span class="tag"><Icon icon={ArrowsDownUp} size="0.8rem" /> reordered</span>
            {/if}
          </li>
        {/if}
      {:else}
        <li class="none">None on show</li>
      {/each}
    </ul>
    {#if tree.removed.length}
      <ul class="removed" aria-label="No longer shown">
        {#each tree.removed as p (p.value)}
          <li class="choice" data-mark="removed">
            <s>{named(p.value)}</s>
            <span class="tag"><Icon icon={Minus} size="0.8rem" /> removed{p.group ? ` from ${p.group}` : ''}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <p class="value">
      <s class="was">{was || 'Empty'}</s>
      <span class="to"><Icon icon={ArrowRight} size="0.85rem" /><span class="visually-hidden">to</span></span>
      <span class="now">{value || 'Empty'}</span>
    </p>
  {/if}
</figure>

<style>
  .diff {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--sunk);
    min-width: 0;
  }
  figcaption {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1px;
    font-size: var(--text-sm);
  }
  .removed {
    padding-top: var(--space-1);
    border-top: 1px dashed var(--line);
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: 600;
  }
  .choice {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .choice.inner {
    margin-inline-start: var(--space-3);
    padding-inline-start: var(--space-2);
    border-inline-start: 1px solid var(--line);
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: var(--text-xs);
    font-weight: 400;
    color: var(--text-muted);
  }
  .added .tag,
  [data-mark='added'] .tag,
  [data-mark='added'] > span:first-child {
    color: var(--positive-text);
  }
  [data-mark='moved'] .tag,
  [data-mark='reordered'] .tag {
    color: var(--accent-text);
  }
  [data-mark='removed'],
  [data-mark='removed'] .tag {
    color: var(--negative-text);
  }
  .none {
    color: var(--text-subtle);
  }
  .value {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .was {
    color: var(--text-muted);
  }
  .to {
    display: inline-flex;
    color: var(--text-subtle);
  }
  .now {
    font-weight: 500;
  }
</style>
