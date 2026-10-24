<script lang="ts">
  import { Detail, type Block } from '@cella/org-ui'
  import { collection, extensions } from '#lib/slices.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // The owner's page over the item, and each extension's cards and blocks
  // over its own data on the item: one detail view whatever the kind.
  const mounted = $derived(collection(data.name))
  const page = $derived(mounted?.page)
  const added = $derived(
    extensions(data.name).map((e) => ({ page: e.extension.page ?? {}, data: (data.added as Record<string, unknown>)[e.slice] })),
  )
  const all = <T,>(own: ((d: any) => T[]) | undefined, pick: (p: (typeof added)[number]['page']) => ((d: any) => T[]) | undefined) => [
    ...(own?.(data.item) ?? []),
    ...added.flatMap((a) => pick(a.page)?.(a.data) ?? []),
  ]
  const properties = $derived(all(page?.properties, (p) => p.properties))
  const related = $derived(all(page?.related, (p) => p.related))
  const activity = $derived(all(page?.activity, (p) => p.activity))
  const blocks = $derived([
    ...(page?.blocks ?? []).map((block: Block) => ({ block, data: data.item })),
    ...added.flatMap((a) => (a.page.blocks ?? []).map((block) => ({ block, data: a.data }))),
  ])
  const writes = $derived([
    ...(page?.actions ? [{ block: page.actions, data: data.item }] : []),
    ...added.flatMap((a) => (a.page.actions ? [{ block: a.page.actions as Block, data: a.data }] : [])),
  ])
</script>

{#snippet header()}
  {#each writes as w}
    <w.block data={w.data} id={data.id} />
  {/each}
{/snippet}

{#if mounted && page}
  <Detail
    eyebrow={page.eyebrow}
    title={page.title(data.item)}
    subtitle={page.subtitle?.(data.item)}
    back={{ href: `/${data.name}`, label: mounted.view.title }}
    {properties}
    {related}
    {activity}
    actions={writes.length ? header : undefined}
  >
    {#each blocks as b}
      <b.block data={b.data} id={data.id} />
    {/each}
  </Detail>
{/if}
