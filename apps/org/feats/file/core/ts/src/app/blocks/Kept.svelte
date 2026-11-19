<script lang="ts">
  import { Button, Empty, Field, icons, Panel, Row } from '@cella/org-ui'
  import { kinds, sized, type File } from '../../models/file.ts'

  // What the coop keeps on file: its name, type and size, read-only, and
  // opening its bytes in its footer, or that they were erased. The
  // overview's panel.
  let { data }: { data: File; id: string } = $props()
</script>

{#snippet open()}
  <Button href="/files/{data.id}/content" lead={icons.ArrowSquareOut}>Open</Button>
{/snippet}

<Panel title="File" icon={icons.Paperclip} meta={kinds[data.class]} actions={data.hash ? open : undefined}>
  {#if data.hash}
    <Row spaced>
      <Field readonly label="Name" value={data.name} />
      <Field readonly label="Type" value={data.type} kind="mono" />
      <Field readonly label="Size" value={sized(data.size)} />
    </Row>
  {:else}
    <Empty text="{data.name}: its bytes were erased; the record of it stays." />
  {/if}
</Panel>
