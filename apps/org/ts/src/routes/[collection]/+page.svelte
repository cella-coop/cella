<script lang="ts">
  import { browser } from '$app/env'
  import { snapshot } from '$app/navigation'
  import { page } from '$app/state'
  import { Collection, Failed, Skeleton, useRow, useWrites } from '@cella/org-ui'
  import { collection as read } from '#lib/remote/collection.remote.ts'
  import { collection, columns, extensions, shifts } from '#lib/slices.ts'
  import { onCollection } from '#lib/writes.ts'

  const name = $derived(page.params.collection ?? '')
  // Its writes post to the collection's, and a dropped card's to its item's.
  useWrites().serve(() => onCollection(() => name, () => undefined))
  // What the skeleton names while the collection loads.
  const opening = $derived(collection(name))
  // The collection as the address asks for it, read by its query, which
  // a write refreshes.
  const rows = $derived(read({ name, search: page.url.search }))
  // The keyboard's row, kept as the page is left and handed back when
  // history returns to it, by the page, which mounts with its route, for
  // the Collection, which mounts once its query answers.
  const row = useRow()
  snapshot({ id: 'collection-row', capture: () => row.capture(), restore: (i) => row.restore(i) })

  // How the collection the data is of shows, as the data names it, never
  // the address, which runs ahead of the data while the next one reads:
  // its view, its columns, its links and its New forms, the owner's or
  // those of the extensions that offer their own, the owner's replaced,
  // each under its title.
  function shown(name: string) {
    const mounted = collection(name)
    const added = extensions(name)
    const linked = mounted?.page && mounted.view.linked !== false
    const href = (row: { id: string }) => `/${name}/${encodeURIComponent(row.id)}`
    const own = added.flatMap((e) => (e.extension.create ? [{ title: e.extension.title, form: e.extension.create }] : []))
    return {
      mounted,
      added,
      columns: columns(name),
      linked,
      href,
      creates: own.length ? own : mounted?.view.create ? [{ form: mounted.view.create }] : [],
    }
  }
</script>

<!-- The skeleton while the browser reads a page it opens; the server
     renders the content, its queries awaited. A page reading again keeps
     its content, its frame busy. -->
{#snippet loading()}
  <Skeleton title={opening?.view.title} />
{/snippet}

<svelte:boundary pending={browser ? loading : undefined}>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {const data = $derived(await rows)}
  {const c = $derived(shown(data.name))}
  {#if c.mounted}
    {const mounted = $derived(c.mounted)}
    <!-- Another collection is another view: its filter and keyboard row start afresh. -->
    {#key data.name}
      <Collection
        title={mounted.view.title}
        icon={mounted.view.icon}
        caption={mounted.view.caption}
        columns={c.columns}
        rows={data.rows}
        kept={data.kept}
        matched={data.matched}
        about={data.about}
        href={mounted.view.href ?? (c.linked ? c.href : undefined)}
        own={c.linked ? c.href : undefined}
        creates={c.creates}
        status={[mounted.view.status, ...c.added.map((e) => e.extension.status)].filter((s) => s !== undefined)}
        empty={mounted.view.empty}
        name={data.name}
        views={data.views}
        view={data.view}
        spec={data.spec}
        errors={data.errors}
        today={data.today}
        look={data.look}
        shifts={shifts(data.name)}
        values={data.values}
        dashboard={data.dashboard}
        sorted={data.sorted}
        declared={data.declared}
        whole={data.whole}
      />
    {/key}
  {/if}
</svelte:boundary>
