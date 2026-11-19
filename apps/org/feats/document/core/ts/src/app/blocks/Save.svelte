<script lang="ts">
  import { Button, verb, Dialog, Form, Note, useCreate } from '@cella/org-ui'
  import type { Page } from '../../models/document.ts'

  // Saving the draft as a version, from the page's header: New version
  // opens the shared Dialog, saying what it saves, and ends in Save
  // version and Cancel; a generated document draws neither.
  let { data }: { data: Page; id: string } = $props()

  const create = useCreate()
  const latest = $derived(data.versions[0])
  const next = $derived((latest?.n ?? 0) + 1)
  const stands = $derived(!latest ? 'never saved before' : latest.hash === data.hash ? `unchanged since version ${latest.n}` : `changed since version ${latest.n}`)
</script>

{#if !data.generated}
  <Button lead={verb('New version')} tone="quiet" onclick={() => create.show()}>New version</Button>
  <Dialog bind:dialog={create.dialog} title="New version" oncancel={() => create.close()} onclose={() => create.closed()}>
    {#if create.open}
      <Note text="Saves the draft as version {next}, {stands}." />
      <Form action="version" submit="Save version" />
    {/if}
  </Dialog>
{/if}
