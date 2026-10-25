<script lang="ts">
  import { SignIn } from '@cella/org-ui'
  import type { PageProps } from './$types'

  let { data }: PageProps = $props()
</script>

<SignIn scope={data.scope.address} back={data.back} fixtures={data.fixtures} />
