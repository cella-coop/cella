<script lang="ts">
  import { page as here } from '$app/state'
  import { Detail, type Block, type Embeds, type Placed, type Tab } from '@cella/org-ui'
  import { collection, extensions } from '#lib/slices.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // The owner's page over the item, and each extension's cards and blocks
  // over its own data on the item: one detail view whatever the kind. The
  // page's tabs are the owner's, then any an extension adds; a block sits
  // in the tab it names, a bare one in the first; the address holds the
  // open tab.
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
  // Each slice gives what happened newest first; the page shows them all
  // oldest first, merged by when, a tie in the order it was given.
  const activity = $derived(
    [...(page?.activity?.(data.item) ?? []).reverse(), ...added.flatMap((a) => (a.page.activity?.(a.data) ?? []).reverse())].sort((x, y) =>
      x.at < y.at ? -1 : x.at > y.at ? 1 : 0,
    ),
  )
  const tabs: Tab[] = $derived([...(page?.tabs ?? []), ...added.flatMap((a) => a.page.tabs ?? [])])
  const tab = $derived(tabs.find((t) => t.id === here.url.searchParams.get('tab'))?.id ?? tabs[0]?.id)
  const place = (p: Placed) => (typeof p === 'function' ? { tab: tabs[0]?.id, block: p } : p)
  const blocks = $derived(
    [
      ...(page?.blocks ?? []).map((p) => ({ ...place(p), data: data.item })),
      ...added.flatMap((a) => (a.page.blocks ?? []).map((p) => ({ ...place(p), data: a.data }))),
    ].filter((b) => b.tab === tab),
  )
  // What each slice draws inside the item's blocks, with its data on the
  // item: a graft's motion inside a document.
  const embeds: Embeds = $derived(
    Object.fromEntries([
      ...Object.entries(page?.embeds ?? {}).map(([k, embed]) => [k, { embed, data: data.item }]),
      ...added.flatMap((a) => Object.entries(a.page.embeds ?? {}).map(([k, embed]) => [k, { embed, data: a.data }])),
    ]),
  )
  // The box that adds a comment: the owner's, or an extension's where the
  // owner takes none.
  const comment = $derived(
    page?.comment ? { block: page.comment, data: data.item } : added.map((a) => (a.page.comment ? { block: a.page.comment as Block, data: a.data } : undefined)).find(Boolean),
  )
  // The record's subtitle: the owner's, or an extension's where the owner
  // gives none.
  const subtitle = $derived(page?.subtitle?.(data.item) ?? added.map((a) => a.page.subtitle?.(a.data)).find(Boolean))
  const writes = $derived([
    ...(page?.actions ? [{ block: page.actions, data: data.item }] : []),
    ...added.flatMap((a) => (a.page.actions ? [{ block: a.page.actions as Block, data: a.data }] : [])),
  ])
</script>

{#snippet header()}
  {#each writes as w}
    <w.block data={w.data} id={data.id} viewer={data.viewer} />
  {/each}
{/snippet}

{#snippet commenting()}
  {#if comment}
    <comment.block data={comment.data} id={data.id} viewer={data.viewer} />
  {/if}
{/snippet}

{#if mounted && page}
  <Detail
    eyebrow={page.eyebrow}
    title={page.title(data.item)}
    subtitle={subtitle}
    summary={page.summary?.(data.item)}
    back={{ href: `/${data.name}`, label: mounted.view.title }}
    {tabs}
    {tab}
    {properties}
    {related}
    {activity}
    actions={writes.length ? header : undefined}
    comment={comment ? commenting : undefined}
  >
    {#each blocks as b}
      <b.block data={b.data} id={data.id} {embeds} viewer={data.viewer} />
    {/each}
  </Detail>
{/if}
