<script lang="ts">
  import { goto } from '$app/navigation'
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
  import type { Jump } from '../models/view.ts'
  import { nearest } from '../models/keys.ts'
  import { abandon } from '../models/navigation.ts'
  import { useCommand } from '../hooks/useCommand.ts'
  import type { Search } from '../hooks/CommandState.svelte.ts'
  import Icon from './Icon.svelte'

  // The command menu, Cmd/Ctrl-K: jump to any collection or item. The
  // collections are known; the items are read by `source`, the shell's
  // query, on first open.
  let { collections, source }: { collections: Jump[]; source: Search } = $props()

  const state = useCommand(() => collections, () => source)
  const results = $props.id()

  function go(i: number) {
    const item = state.shown[i]
    if (item) {
      state.close()
      goto(item.href).catch(abandon)
    }
  }

  function onwindow(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      state.toggle()
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      state.move(1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      state.move(-1)
      e.preventDefault()
    } else if (e.key === 'Enter') {
      go(state.active)
      e.preventDefault()
    }
  }

  function onbackdrop(e: MouseEvent) {
    if (e.target === state.dialog) {
      state.close()
    }
  }
</script>

<svelte:window onkeydown={onwindow} />

<button class="trigger" onclick={() => state.open()}>
  <Icon icon={MagnifyingGlass} />
  <span>Jump to…</span>
  <kbd>Ctrl K</kbd>
</button>

<dialog bind:this={state.dialog} class="menu" onclick={onbackdrop} aria-label="Jump to">
  <!-- svelte-ignore a11y_autofocus: the menu opens to type into, as Linear's does -->
  <!-- A combobox over its listbox: focus stays in the input, and the
       active option is announced through aria-activedescendant. -->
  <input
    bind:value={state.query}
    {onkeydown}
    oninput={() => state.typed()}
    placeholder="Jump to a collection or an item"
    aria-label="Jump to"
    role="combobox"
    aria-expanded="true"
    aria-autocomplete="list"
    aria-controls={results}
    aria-activedescendant={state.shown.length ? `${results}-${state.active}` : undefined}
    autofocus
  />
  <ul role="listbox" id={results} aria-label="Results">
    {#each state.shown as item, i (item.href)}
      <li
        role="option"
        id="{results}-{i}"
        tabindex="-1"
        aria-selected={i === state.active}
        class:active={i === state.active}
        {@attach nearest(i === state.active)}
        onclick={() => go(i)}
        {onkeydown}
        onmousemove={() => (state.active = i)}
      >
        <span class="title">{item.title}</span>
        {#if item.sub}<span class="sub">{item.sub}</span>{/if}
        <span class="kind">{item.kind}</span>
      </li>
    {:else}
      <li class="none">Nothing matches.</li>
    {/each}
  </ul>
</dialog>

<style>
  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: 2rem;
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-control);
    /* The sunk ground, lifted a step toward the text so it stands apart
       from the sidebar it sits in, in either theme. */
    background: color-mix(in oklab, var(--text) 5%, var(--sunk));
    color: var(--text-muted);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .trigger:hover {
    background: color-mix(in oklab, var(--text) 10%, var(--sunk));
    color: var(--text);
  }
  .trigger span {
    flex: 1;
    text-align: start;
  }
  kbd {
    font-family: var(--font-ui);
    font-size: var(--text-2xs);
    color: var(--text-muted);
  }
  .menu {
    width: min(36rem, calc(100vw - 2rem));
    margin-top: 12vh;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
  }
  /* What lies behind dims and softens, untinted. */
  .menu::backdrop {
    background: oklch(0 0 0 / 22%);
    backdrop-filter: blur(3px);
  }
  input {
    border: none;
    border-radius: 0;
    background: transparent;
    font-size: var(--text-lg);
    padding: var(--space-4);
    min-height: 3rem;
  }
  input:focus {
    border: none;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: var(--space-2);
    max-height: 50vh;
    overflow-y: auto;
  }
  [role='option'] {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: none;
    border-radius: var(--radius-control);
    background: none;
    text-align: start;
    cursor: pointer;
    font-size: var(--text-sm);
  }
  [role='option'].active {
    background: var(--hover);
  }
  .title {
    font-weight: 500;
  }
  .sub {
    color: var(--text-muted);
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .kind {
    margin-inline-start: auto;
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .none {
    color: var(--text-muted);
    padding: var(--space-3);
  }
</style>
