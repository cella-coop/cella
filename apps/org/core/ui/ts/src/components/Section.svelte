<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { Tone } from '../models/view.ts'
  import { useSection } from '../hooks/useSection.ts'
  import { useTab } from '../hooks/useTab.ts'
  import Heading from './Heading.svelte'

  // A titled block in a page's content, as a tab's: the one heading, as
  // a `Panel`'s, its icon, its count muted beside it, a state's pill and
  // quiet facts or small actions at its end, over what it holds, on the
  // panel itself, so blocks read as one page rather than boxes. Its
  // title, notes, forms and figures sit at the content's inset
  // (`--inset`), its tables' first column's. A heading heads content: a
  // section counting nothing whose title only repeats the open tab's
  // name, as an empty Postings in the Postings tab, shows its empty line
  // alone.
  let {
    title,
    icon,
    count,
    status,
    meta,
    actions,
    children,
  }: {
    title: string
    icon?: Component<any>
    count?: number
    status?: { label: string; tone?: Tone; ink?: number } | null
    meta?: string | (string | null | undefined | false)[] | null
    actions?: Snippet
    children: Snippet
  } = $props()

  useSection(() => title)
  const tab = useTab()
  const repeats = $derived.by(() => {
    const name = tab?.()?.toLowerCase()
    return !!name && title.toLowerCase().endsWith(name)
  })
  const headed = $derived(!(count === 0 && !status && !actions && repeats))
</script>

<section class="section" aria-label={headed ? undefined : title}>
  {#if headed}<div class="head"><Heading {title} {icon} {count} {status} {meta} {actions} /></div>{/if}
  {@render children()}
</section>

<style>
  .section {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .head {
    padding-inline: var(--inset, 0);
  }
</style>
