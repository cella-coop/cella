<script lang="ts">
  import Frame from './PageFrame.svelte'
  import Prose from './Prose.svelte'

  // What a page draws when a query it reads throws, in place of its
  // content and inside the shell: not found, or broken, with the error's
  // message, as SvelteKit hands it to the boundary.
  let { error }: { error: unknown } = $props()

  const shown = $derived(error && typeof error === 'object' ? (error as { status?: unknown; message?: unknown }) : {})
  const status = $derived(typeof shown.status === 'number' ? shown.status : 500)
  const message = $derived(typeof shown.message === 'string' ? shown.message : 'An unexpected error.')
</script>

<Frame title={status === 404 ? 'Not found' : 'Something broke'} count="Error {status}">
  <div data-failed>
    <Prose text={message} />
  </div>
</Frame>
