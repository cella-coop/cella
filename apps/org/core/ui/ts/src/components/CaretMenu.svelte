<script lang="ts">
  import type { Snippet } from 'svelte'
  import Floating from './Floating.svelte'

  // The menu at the caret, floating above or below it: the body's slash
  // menu, turning a block into another, and a comment's `@` or `[[`
  // suggestions, both filtered as they are typed, the arrows and Enter
  // moving and choosing from where the menu opens, which call `onchoose`
  // and read no key here. Each item is the caller's own (`item`); the one
  // the keyboard is on (`active`) scrolls into view as it moves past what
  // the menu shows at once.
  let {
    x,
    y,
    above,
    label,
    items,
    active,
    onchoose,
    item,
    empty = 'No match',
  }: {
    x: number
    y: number
    above?: number
    label: string
    items: unknown[]
    active: number
    onchoose: (i: number) => void
    item: Snippet<[unknown, number]>
    empty?: string
  } = $props()

  const shown = (i: number) => (el: HTMLElement) => {
    if (i === active) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }
</script>

<Floating {x} {y} {above} {label} role="listbox">
  {#each items as it, i (i)}
    <button role="option" aria-selected={i === active} tabindex="-1" onclick={() => onchoose(i)} {@attach shown(i)}>
      {@render item(it, i)}
    </button>
  {:else}
    <div class="none">{empty}</div>
  {/each}
</Floating>
