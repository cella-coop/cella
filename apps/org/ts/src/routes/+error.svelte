<script lang="ts">
  import { page } from '$app/state'
  import { Frame, Prose } from '@cella/org-ui'
</script>

<Frame title={page.status === 404 ? 'Not found' : 'Something broke'} count="Error {page.status}">
  <Prose text={page.error?.message ?? 'An unexpected error.'} />
</Frame>
