<script lang="ts">
  import { Home } from '@cella/org-ui'
  import { fields } from '@cella/org-ui/models'
  import { columns, nav, pinnable } from '#lib/slices.ts'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()

  // Every collection a widget on the home may run over, in the sidebar's
  // order, then the reports whose rows it may, each with its fields.
  const collections = [
    ...nav()
      .flatMap((g) => g.items)
      .filter((i) => i.href !== '/')
      .map((i) => ({ name: i.href.slice(1), title: i.title, fields: fields(columns(i.href.slice(1))) })),
    ...pinnable.map((p) => ({ name: p.name, title: p.title, fields: fields(p.columns) })),
  ]
</script>

<Home
  title="Home"
  caption="The co-op at a glance: widgets pinned from its collections and its reports."
  results={data.results}
  errors={data.errors}
  pins={data.pins}
  custom={data.custom}
  {collections}
  editing={data.editing}
  values={data.values}
/>
