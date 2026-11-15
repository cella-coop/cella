<script lang="ts">
  import { browser } from '$app/env'
  import { page as here } from '$app/state'
  import { Detail, Failed, Skeleton, useWrites, type Block, type Embeds, type Placed, type Tab } from '@cella/org-ui'
  import { stamps } from '@cella/org-ui/models'
  import { item as read } from '#lib/remote/item.remote.ts'
  import { collection, extensions } from '#lib/slices.ts'
  import { onCollection } from '#lib/writes.ts'

  const name = $derived(here.params.collection ?? '')
  const id = $derived(here.params.id ?? '')
  // Its writes post to the item's.
  useWrites().serve(() => onCollection(() => name, () => id))
  // What the skeleton names while the item loads.
  const opening = $derived(collection(name))
  // The item as the address asks for it, read by its query, which a write
  // refreshes; the open tab is the page's alone, so a tab's change reads
  // nothing again.
  const search = $derived.by(() => {
    const q = new URLSearchParams(here.url.search)
    q.delete('tab')
    const s = q.toString()
    return s ? `?${s}` : ''
  })
  const one = $derived(read({ name, id, search }))

  type Data = Awaited<typeof one>

  // The owner's page over the item, and each extension's cards and blocks
  // over its own data on the item: one detail view whatever the kind. The
  // page's tabs are the owner's, then any an extension adds; a block sits
  // in the tab it names, a bare one in the first; the address holds the
  // open tab. All of it is the item's collection's, as the data names it,
  // never the address's, which runs ahead of the data while the next item
  // reads.
  function shown(data: Data) {
    const mounted = collection(data.name)
    const page = mounted?.page
    const added = extensions(data.name).map((e) => ({ page: e.extension.page ?? {}, data: (data.added as Record<string, unknown>)[e.slice] }))
    const all = <T,>(own: ((d: any) => T[]) | undefined, pick: (p: (typeof added)[number]['page']) => ((d: any) => T[]) | undefined) => [
      ...(own?.(data.item) ?? []),
      ...added.flatMap((a) => pick(a.page)?.(a.data) ?? []),
    ]
    // Each slice gives what happened newest first; the page shows them all
    // oldest first, merged by when, a tie in the order it was given.
    const activity = [...(page?.activity?.(data.item) ?? []).reverse(), ...added.flatMap((a) => (a.page.activity?.(a.data) ?? []).reverse())].sort((x, y) =>
      x.at < y.at ? -1 : x.at > y.at ? 1 : 0,
    )
    const tabs: Tab[] = [...(page?.tabs ?? []), ...added.flatMap((a) => a.page.tabs ?? [])]
    const tab = tabs.find((t) => t.id === here.url.searchParams.get('tab'))?.id ?? tabs[0]?.id
    const place = (p: Placed) => (typeof p === 'function' ? { tab: tabs[0]?.id, block: p } : p)
    const blocks = [
      ...(page?.blocks ?? []).map((p) => ({ ...place(p), data: data.item })),
      ...added.flatMap((a) => (a.page.blocks ?? []).map((p) => ({ ...place(p), data: a.data }))),
    ].filter((b) => b.tab === tab)
    // What each slice draws inside the item's blocks, with its data on the
    // item: a graft's motion inside a document.
    const embeds: Embeds = Object.fromEntries([
      ...Object.entries(page?.embeds ?? {}).map(([k, embed]) => [k, { embed, data: data.item }]),
      ...added.flatMap((a) => Object.entries(a.page.embeds ?? {}).map(([k, embed]) => [k, { embed, data: a.data }])),
    ])
    // The box that adds a comment: the owner's, or an extension's where the
    // owner takes none.
    const comment = page?.comment
      ? { block: page.comment, data: data.item }
      : added.map((a) => (a.page.comment ? { block: a.page.comment as Block, data: a.data } : undefined)).find(Boolean)
    // The record's subtitle: the owner's, or an extension's where the owner
    // gives none.
    const subtitle = page?.subtitle?.(data.item) ?? added.map((a) => a.page.subtitle?.(a.data)).find(Boolean)
    const writes = [
      ...(page?.actions ? [{ block: page.actions, data: data.item }] : []),
      ...added.flatMap((a) => (a.page.actions ? [{ block: a.page.actions as Block, data: a.data }] : [])),
    ]
    // Its slices' properties, then when and by whom it was created and last
    // updated, as the log has it, but what they already name.
    const properties = all(page?.properties, (p) => p.properties)
    return {
      mounted,
      page,
      properties: [...properties, ...stamps(data.made, properties)],
      related: all(page?.related, (p) => p.related),
      activity,
      tabs,
      tab,
      blocks,
      embeds,
      comment,
      subtitle,
      writes,
    }
  }
</script>

<!-- The skeleton while the browser reads a page it opens; the server
     renders the content, its queries awaited. A page reading again keeps
     its content, its frame busy. -->
{#snippet loading()}
  <Skeleton title={opening?.view.title} />
{/snippet}

<!-- The item, its query awaited, and what only it offers: its writes and
     its comment box. -->
{#snippet content()}
  {const data = $derived(await one)}
  {const v = $derived(shown(data))}
  {#if v.mounted && v.page}
    {const mounted = $derived(v.mounted)}
    {const page = $derived(v.page)}
    {#snippet header()}
      {#each v.writes as w}
        <w.block data={w.data} id={data.id} viewer={data.viewer} />
      {/each}
    {/snippet}

    {#snippet commenting()}
      {#if v.comment}
        <v.comment.block data={v.comment.data} id={data.id} viewer={data.viewer} />
      {/if}
    {/snippet}

    <Detail
      eyebrow={page.eyebrow}
      title={page.title(data.item)}
      subtitle={v.subtitle}
      summary={page.summary?.(data.item)}
      back={{ href: `/${data.name}`, label: mounted.view.title }}
      tabs={v.tabs}
      tab={v.tab}
      properties={v.properties}
      related={v.related}
      activity={v.activity}
      actions={v.writes.length ? header : undefined}
      comment={v.comment ? commenting : undefined}
    >
      {#each v.blocks as b}
        <b.block data={b.data} id={data.id} embeds={v.embeds} viewer={data.viewer} />
      {/each}
    </Detail>
  {/if}
{/snippet}

<svelte:boundary pending={browser ? loading : undefined}>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {@render content()}
</svelte:boundary>
