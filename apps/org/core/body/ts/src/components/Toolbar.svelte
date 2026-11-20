<script lang="ts">
  import { Button, verb, Field, FormatBar, Popover } from '@cella/org-ui'
  import { useEditor } from '../hooks/useEditor.ts'

  // The toolbar over a selection: bold, italic and code, and a link, whose
  // address is asked in the UI core's popover; Ctrl-B, -I, -E and -K do
  // the same from the keyboard.
  const ed = useEditor()
  const bar = $derived(ed.menu.bar)
  const tools = [
    { key: 'bold', label: 'B', title: 'Bold (Ctrl-B)' },
    { key: 'italic', label: 'I', title: 'Italic (Ctrl-I)' },
    { key: 'code', label: '</>', title: 'Code (Ctrl-E)' },
  ]
</script>

{#if bar && !ed.chosen.range}
  <FormatBar x={bar.x} y={bar.y} {tools} onchoose={(key) => ed.input.mark(key as 'bold' | 'italic' | 'code')}>
    <Popover label="Link (Ctrl-K)" menu={false}>
      {#snippet trigger()}
        <span data-link>Link</span>
      {/snippet}
      <form
        data-href
        onsubmit={(e) => {
          e.preventDefault()
          ed.menu.setLink()
        }}
      >
        <Field label="Link to" name="href" bind:value={ed.menu.href} />
        <Button lead={verb('Link')} type="submit">Link</Button>
      </form>
    </Popover>
  </FormatBar>
{/if}
