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
</script>

{#if mounted}
  <!-- Another collection is another view: its filter and keyboard row start afresh. -->
  {#key data.name}
    <Collection
      title={mounted.view.title}
      caption={mounted.view.caption}
      {columns}
      rows={data.rows}
      about={data.about}
      href={linked ? href : undefined}
      create={mounted.view.create}
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
