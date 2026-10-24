<script lang="ts">
  import { Collection } from '@cella/org-ui'
  import { collection, extensions } from '#lib/slices.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  const mounted = $derived(collection(data.name))
  const added = $derived(extensions(data.name))
  const columns = $derived([...(mounted?.view.columns ?? []), ...added.flatMap((e) => e.extension.columns ?? [])])
  const linked = $derived(mounted?.page && mounted.view.linked !== false)
  const href = (row: { id: string }) => `/${data.name}/${encodeURIComponent(row.id)}`
</script>

{#if mounted}
  <!-- Another collection is another view: its filter and keyboard row start afresh. -->
  {#key data.name}
    <Collection
      eyebrow={mounted.view.group}
      title={mounted.view.title}
      {columns}
      rows={data.rows}
      about={data.about}
      href={linked ? href : undefined}
      create={mounted.view.create}
      summaries={[mounted.view.summary, ...added.map((e) => e.extension.summary)].filter((s) => s !== undefined)}
      empty={mounted.view.empty}
    />
  {/key}
{/if}
