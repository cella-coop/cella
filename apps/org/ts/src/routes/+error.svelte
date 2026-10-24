<script lang="ts">
  import { page } from '$app/state'
  import { Frame, Prose } from '@cella/org-ui'
</script>

<Frame eyebrow="Error {page.status}" title={page.status === 404 ? 'Not found' : 'Something broke'}>
  <Prose text={page.error?.message ?? 'An unexpected error.'} />
</Frame>
