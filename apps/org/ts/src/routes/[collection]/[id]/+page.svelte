<script lang="ts">
  import { browser } from '$app/env'
  import { page as here } from '$app/state'
  import { Collection, Detail, Failed, recordIcon, Skeleton, useWrites, type Block, type Embeds, type Placed, type Scoped, type Tab } from '@cella/org-ui'
  import { stamps } from '@cella/org-ui/models'
  import { blank, type Canon } from '@cella/org-body/models'
  import { within } from '#lib/remote/collection.remote.ts'
  import { item as read } from '#lib/remote/item.remote.ts'
  import { readers as readRecordReaders } from '#lib/remote/readers.remote.ts'
  import { collection, columns, extensions } from '#lib/slices.ts'
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
  // page's tabs are the owner's, at most four, which the tabs check
  // holds; a block sits in the tab it names, a bare one in the first; a
  // tab past the first that holds no block is not shown; the address
  // holds the open tab. All of it is the item's collection's, as the data names it,
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
    const declared: Tab[] = page?.tabs ?? []
    const place = (p: Placed) => (typeof p === 'function' ? { tab: declared[0]?.id, block: p } : p)
    const placed = [
      ...(page?.blocks ?? []).map((p) => ({ ...place(p), data: data.item })),
      ...added.flatMap((a) => (a.page.blocks ?? []).map((p) => ({ ...place(p), data: a.data }))),
    ]
    // The collections its tabs list scoped to it, the owner's and those
    // of the slices joining it, each a tab that is shown as one a block
    // fills is; a collection pruned away lists nothing.
    const scopes: Scoped[] = [...(page?.scoped ?? []), ...added.flatMap((a) => a.page.scoped ?? [])].filter((s) => collection(s.collection))
    const tabs = declared.filter((t, i) => i === 0 || placed.some((b) => b.tab === t.id) || scopes.some((s) => s.tab === t.id))
    const tab = tabs.find((t) => t.id === here.url.searchParams.get('tab'))?.id ?? tabs[0]?.id
    const blocks = placed.filter((b) => b.tab === tab)
    const scope = scopes.find((s) => s.tab === tab)
    const at = `/${data.name}/${encodeURIComponent(data.id)}`
    // The overview's layout and the record's body, which opens it or is
    // the Notes at its foot; a record keeping a body in the block editor
    // reads it as `canon`, and the Notes offer only "Add a note" while
    // it holds nothing.
    const body = page?.body ? { block: page.body, data: data.item } : undefined
    const canon = (Object(data.item) as { canon?: Canon | null }).canon
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
    // What the slices set in the Details: the owner's fields, then each
    // extension's, as a graft sets a task's assignee.
    const fields = [
      ...(page?.details ?? []).map((block) => ({ block, data: data.item })),
      ...added.flatMap((a) => (a.page.details ?? []).map((block) => ({ block: block as Block, data: a.data }))),
    ]
    const writes = [
      ...(page?.actions ? [{ block: page.actions, data: data.item }] : []),
      ...added.flatMap((a) => (a.page.actions ? [{ block: a.page.actions as Block, data: a.data }] : [])),
    ]
    // Its slices' properties, then when and by whom it was created and last
    // updated, as the log has it, but what they already name; a page too
    // crowded for them keeps them out, in their own History instead.
    const properties = all(page?.properties, (p) => p.properties)
    const stamped = stamps(data.made, properties)
    return {
      mounted,
      page,
      properties: page?.history === false ? properties : [...properties, ...stamped],
      // Its slices' computed figures, one panel of them on the overview.
      figures: all(page?.figures, (p) => p.figures),
      history: page?.history === false ? stamped : [],
      // Its jumps, each collection holding rows that name it, by its
      // name, opening the tab that lists it where one does, then the
      // records its slices link to.
      related: [
        ...data.jumps.flatMap((j) => {
          const to = collection(j.collection)
          const listed = scopes.find((s) => s.collection === j.collection)
          return to ? [{ label: to.view.title, href: listed ? `${at}?tab=${listed.tab}` : j.href, collection: j.collection, count: j.count }] : []
        }),
        ...all(page?.related, (p) => p.related),
      ],
      activity,
      tabs,
      tab,
      scope,
      layout: page?.layout ?? 'panels',
      body,
      blank: blank(canon),
      blocks,
      embeds,
      comment,
      subtitle,
      writes,
      fields,
      // The item's own icon, of the curated set, where its kind of item
      // carries one at all (a project's, a circle's): its own where it
      // is set, else the collection's, as the sidebar shows it; a kind
      // with no `icon` field wears none here, as before.
      icon: 'icon' in Object(data.item) ? recordIcon((data.item as { icon?: string | null }).icon) ?? mounted?.view.icon : undefined,
    }
  }
</script>

<!-- The skeleton while the browser reads a page it opens; the server
     renders the content, its queries awaited. A page reading again keeps
     its content, its frame busy. -->
{#snippet loading()}
  <Skeleton title={opening?.view.title} icon={opening?.view.icon} />
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

    {#snippet setting()}
      {#each v.fields as f}
        <f.block data={f.data} id={data.id} viewer={data.viewer} />
      {/each}
    {/snippet}

    {#snippet bodied()}
      {#if v.body}
        <v.body.block data={v.body.data} id={data.id} embeds={v.embeds} viewer={data.viewer} />
      {/if}
    {/snippet}

    {#snippet commenting()}
      {#if v.comment}
        <!-- Keyed by the record shown, so a box reused for the next record
             starts afresh and fetches that record's readers, never keeps the last. -->
        {#key `${data.name}/${data.id}`}
          <v.comment.block data={v.comment.data} id={data.id} embeds={v.embeds} viewer={data.viewer} readers={() => readRecordReaders({ name: data.name, id: data.id })} />
        {/key}
      {/if}
    {/snippet}

    <Detail
      eyebrow={page.eyebrow}
      title={page.title(data.item)}
      icon={v.icon}
      subtitle={v.subtitle}
      summary={page.summary?.(data.item)}
      back={{ href: `/${data.name}`, label: mounted.view.title, icon: mounted.view.icon }}
      tabs={v.tabs}
      tab={v.tab}
      layout={v.layout}
      wide={!!v.scope}
      body={v.body ? bodied : undefined}
      blank={v.blank}
      record="{data.name}/{data.id}"
      properties={v.properties}
      figures={v.figures}
      history={v.history}
      related={v.related}
      activity={v.activity}
      actions={v.writes.length ? header : undefined}
      comment={v.comment ? commenting : undefined}
      fields={v.fields.length ? setting : undefined}
    >
      {#if v.scope}
        <!-- The collection the open tab lists, scoped to the record, as
             its own page shows it, under the record's header; its
             writes are the record's, so it offers no New and moves no
             card. -->
        {const listed = $derived(await within({ name: v.scope.collection, search, of: data.name, id: data.id }))}
        {const shows = $derived(collection(listed.name))}
        {#if shows}
          {#key `${data.name}/${data.id}/${listed.name}`}
            <Collection
              tab={v.tab}
              title={shows.view.title}
              icon={shows.view.icon}
              columns={columns(listed.name)}
              rows={listed.rows}
              kept={listed.kept}
              matched={listed.matched}
              about={listed.about}
              href={shows.page && shows.view.linked !== false ? (row: { id: string }) => `/${listed.name}/${encodeURIComponent(row.id)}` : undefined}
              empty={shows.view.empty}
              name={listed.name}
              views={listed.views}
              view={listed.view}
              spec={listed.spec}
              errors={listed.errors}
              today={listed.today}
              look={listed.look}
              shifts={[]}
              values={listed.values}
              groups={listed.groups}
              dashboard={listed.dashboard}
              sorted={listed.sorted}
              declared={listed.declared}
              whole={listed.whole}
            />
          {/key}
        {/if}
      {/if}
      <!-- Keyed by the collection shown, so a block of one kind of record
           is never handed another kind's data while the page moves on. -->
      {#key data.name}
        {#each v.blocks as b}
          <b.block data={b.data} id={data.id} embeds={v.embeds} viewer={data.viewer} />
        {/each}
      {/key}
    </Detail>
  {/if}
{/snippet}

<svelte:boundary pending={browser ? loading : undefined}>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {@render content()}
</svelte:boundary>
