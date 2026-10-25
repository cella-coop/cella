<script lang="ts">
  import { Join } from '@cella/org-ui'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
</script>

<Join scope={data.scope} invited={data.invited} />
