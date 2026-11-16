<script lang="ts">
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple'
  import FileIcon from 'phosphor-svelte/lib/File'
  import X from 'phosphor-svelte/lib/X'
  import { useFile } from '../hooks/useFile.ts'
  import Icon from './Icon.svelte'

  // A file to upload, never the browser's field: a button, Choose file,
  // that opens the browser's dialog, the chosen file's name and size beside
  // it, read aloud as it is chosen, and a quiet button that clears it; the
  // whole a place a file may be dropped on. The file input it keeps hidden
  // inside is what the form posts. `accept` narrows the dialog to the
  // media types it offers and refuses a dropped file it does not take,
  // saying what it does; a `required` picker holds the form back while
  // empty, says so and sends the focus to its button.
  let {
    id,
    name,
    accept,
    required = false,
    labelledby,
  }: { id: string; name: string; accept?: string; required?: boolean; labelledby?: string } = $props()

  const uid = $props.id()
  const f = useFile()
  let input: HTMLInputElement
  let choose: HTMLButtonElement

  // The input's file, or a dropped one put in it, taken by the picker.
  function took(file: File | null) {
    if (!f.take(file, accept)) {
      return
    }
    if (file && input.files?.[0] !== file) {
      const put = new DataTransfer()
      put.items.add(file)
      input.files = put.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  function clear() {
    input.value = ''
    f.take(null)
    input.dispatchEvent(new Event('change', { bubbles: true }))
    choose.focus()
  }

  const files = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files')

  // Its form reset or posted, the picker is empty again.
  const resets = (el: HTMLInputElement) => {
    const form = el.form
    const reset = () => queueMicrotask(() => f.take(el.files?.[0] ?? null))
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions: dropping a file is a pointer's shortcut; Choose file is the keyboard's -->
<div
  class="file"
  class:dragging={f.dragging}
  class:chosen={!!f.chosen}
  class:complaining={!!f.complaint}
  ondragenter={(e) => {
    if (files(e)) {
      e.preventDefault()
      f.drag(true)
    }
  }}
  ondragover={(e) => {
    if (files(e)) {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
  }}
  ondragleave={(e) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
      f.drag(false)
    }
  }}
  ondrop={(e) => {
    e.preventDefault()
    took(e.dataTransfer?.files[0] ?? null)
    choose.focus()
  }}
>
  <input
    bind:this={input}
    {@attach resets}
    type="file"
    hidden
    {name}
    {accept}
    {required}
    onchange={(e) => {
      // A file the dialog let past its filter that `accept` refuses is
      // not posted.
      if (!f.take(e.currentTarget.files?.[0] ?? null, accept)) {
        e.currentTarget.value = ''
      }
    }}
    oninvalid={() => {
      f.missing()
      choose.focus()
    }}
  />
  <button
    bind:this={choose}
    {id}
    type="button"
    class="choose"
    aria-labelledby={labelledby ? `${labelledby} ${id}` : undefined}
    aria-describedby="{uid}-said"
    onclick={() => input.click()}
  >
    <Icon icon={UploadSimple} />
    {f.chosen ? 'Choose another' : 'Choose file'}
  </button>
  {#if f.chosen}
    <span class="name"><Icon icon={FileIcon} /><span class="text">{f.chosen.name}</span><span class="size">{f.size}</span></span>
    <button type="button" class="clear" aria-label="Clear {f.chosen.name}" onclick={clear}><Icon icon={X} /></button>
  {:else}
    <span class="hint" aria-hidden="true">or drop it here</span>
  {/if}
  <span id="{uid}-said" class="visually-hidden" aria-live="polite">{f.complaint || (f.chosen ? `Chosen: ${f.said}` : 'No file chosen')}</span>
</div>
{#if f.complaint}<p class="complaint" aria-hidden="true">{f.complaint}</p>{/if}

<style>
  .file {
    position: relative;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-width: 0;
    min-height: 2.75rem;
    padding: var(--space-1);
    border: 1px dashed var(--line);
    border-radius: var(--radius-control);
    background: var(--sunk);
    transition:
      border-color var(--fast) var(--ease),
      background var(--fast) var(--ease);
  }
  .chosen {
    border-style: solid;
    border-color: transparent;
  }
  .dragging {
    border-style: dashed;
    border-color: var(--accent-border);
    background: var(--accent-soft);
  }
  .choose {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 2rem;
    padding: 0 var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: var(--raised);
    font-size: var(--text-sm);
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }
  .choose:hover {
    background: var(--hover);
  }
  .complaining .choose {
    border-color: var(--error-text);
  }
  .name {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
  }
  .name .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .size,
  .hint {
    font-size: var(--text-xs);
    color: var(--text-subtle);
    white-space: nowrap;
  }
  .clear {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }
  .clear:hover {
    background: var(--hover);
    color: var(--text);
  }
  .complaint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--error-text);
  }
</style>
