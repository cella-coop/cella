<script lang="ts">
  import type { Snippet } from 'svelte'
  import Floating from './Floating.svelte'

  // The toolbar over a selection, floating above or below it: a run of
  // toggles, bold, italic, code, a link, a list's kind, each named and
  // titled with its keyboard shortcut, pressed where the selection
  // already carries it (`active`); a press never takes the focus, so the
  // caret stays. Whatever the caller puts after them, a link's own
  // control among them, is `children`. The body's editor and a comment's
  // `RichField` both float one over a selection, from the same `Floating`
  // this wraps.
  let {
    x,
    y,
    above,
    label = 'Format',
    tools,
    active = () => false,
    onchoose,
    children,
  }: {
    x: number
    y: number
    above?: number
    label?: string
    tools: { key: string; label: string; title: string }[]
    active?: (key: string) => boolean
    onchoose: (key: string) => void
    children?: Snippet
  } = $props()
</script>

<Floating {x} {y} {above} {label} role="toolbar">
  {#each tools as t (t.key)}
    <button class={t.key} title={t.title} aria-label={t.title} aria-pressed={active(t.key)} tabindex="-1" onclick={() => onchoose(t.key)}>{t.label}</button>
  {/each}
  {#if children}{@render children()}{/if}
</Floating>
