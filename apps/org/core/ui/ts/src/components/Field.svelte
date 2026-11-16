<script lang="ts">
  import type { Snippet } from 'svelte'
  import DateField from './DateField.svelte'
  import FilePicker from './FilePicker.svelte'
  import Select from './Select.svelte'
  import TimeField from './TimeField.svelte'
  import { useForm } from '../hooks/useForm.ts'

  let {
    label,
    name,
    type = 'text',
    value = $bindable(''),
    options,
    rows,
    required = false,
    placeholder,
    step,
    list,
    wide = false,
    accept,
    hint,
  }: {
    label: string
    name: string
    type?: 'text' | 'number' | 'date' | 'time' | 'url' | 'email' | 'file'
    value?: string | number
    options?: { value: string; label: string }[]
    rows?: number
    required?: boolean
    placeholder?: string
    step?: string
    list?: string[]
    wide?: boolean
    // For a file, the media types it offers to pick, such as image/*.
    accept?: string
    // What the field says beside its label, as who changes it.
    hint?: Snippet
  } = $props()

  const id = $props.id()
  // Its name as the form it is in posts it.
  const form = useForm()
  const posted = $derived(form.name(name))
</script>

<!-- Its label names the field by its id, never by wrapping it, so a press
     inside a select's list, a date's calendar or a time's list is no press
     on the label; a file's label names its Choose file. -->
<div class="field" class:wide>
  {#if hint}
    <div class="head"><label class="label" for={id} id="{id}-label">{label}</label>{@render hint()}</div>
  {:else}
    <label class="label" for={id} id="{id}-label">{label}</label>
  {/if}
  {#if options}
    <Select {id} labelledby="{id}-label" name={posted} {options} {placeholder} {required} bind:value={() => String(value ?? ''), (v) => (value = v)} />
  {:else if type === 'date'}
    <DateField {id} name={posted} {required} bind:value />
  {:else if type === 'time'}
    <TimeField {id} name={posted} {required} bind:value />
  {:else if type === 'file'}
    <FilePicker {id} labelledby="{id}-label" name={posted} {required} {accept} />
  {:else if rows}
    <textarea {id} name={posted} {rows} {required} {placeholder} bind:value></textarea>
  {:else}
    <input {id} name={posted} {type} {required} {placeholder} {step} bind:value list={list ? `${id}-list` : undefined} />
    {#if list}
      <datalist id="{id}-list">
        {#each list as l (l)}
          <option value={l}></option>
        {/each}
      </datalist>
    {/if}
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .label {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
</style>
