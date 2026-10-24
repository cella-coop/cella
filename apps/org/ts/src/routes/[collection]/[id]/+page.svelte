<script lang="ts">
  import { page as here } from '$app/state'
  import { Detail, type Block, type Placed, type Tab } from '@cella/org-ui'
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
  const activity = $derived(all(page?.activity, (p) => p.activity))
  const tabs: Tab[] = $derived([...(page?.tabs ?? []), ...added.flatMap((a) => a.page.tabs ?? [])])
  const tab = $derived(tabs.find((t) => t.id === here.url.searchParams.get('tab'))?.id ?? tabs[0]?.id)
  const place = (p: Placed) => (typeof p === 'function' ? { tab: tabs[0]?.id, block: p } : p)
  const blocks = $derived(
    [
      ...(page?.blocks ?? []).map((p) => ({ ...place(p), data: data.item })),
      ...added.flatMap((a) => (a.page.blocks ?? []).map((p) => ({ ...place(p), data: a.data }))),
    ].filter((b) => b.tab === tab),
  )
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
    {tabs}
    {tab}
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
