<script lang="ts">
  import { Collection } from '@cella/org-ui'
  import { collection, columns as all, extensions, shifts } from '#lib/slices.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  const mounted = $derived(collection(data.name))
  const added = $derived(extensions(data.name))
  const columns = $derived(all(data.name))
  const linked = $derived(mounted?.page && mounted.view.linked !== false)
  const href = (row: { id: string }) => `/${data.name}/${encodeURIComponent(row.id)}`
  // The New forms: the owner's, or those of the extensions that offer
  // their own, the owner's replaced, each under its title.
  const creates = $derived.by(() => {
    const own = added.flatMap((e) => (e.extension.create ? [{ title: e.extension.title, form: e.extension.create }] : []))
    return own.length ? own : mounted?.view.create ? [{ form: mounted.view.create }] : []
  })
</script>

{#if mounted}
  <!-- Another collection is another view: its filter and keyboard row start afresh. -->
  {#key data.name}
    <Collection
      title={mounted.view.title}
      caption={mounted.view.caption}
      {columns}
      rows={data.rows}
      kept={data.kept}
      matched={data.matched}
      about={data.about}
      href={mounted.view.href ?? (linked ? href : undefined)}
      creates={creates}
      status={[mounted.view.status, ...added.map((e) => e.extension.status)].filter((s) => s !== undefined)}
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
    />
  {/key}
{/if}
