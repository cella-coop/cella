<script lang="ts">
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
  }: {
    label: string
    name: string
    type?: 'text' | 'number' | 'date' | 'time' | 'url' | 'email'
    value?: string | number
    options?: { value: string; label: string }[]
    rows?: number
    required?: boolean
    placeholder?: string
    step?: string
    list?: string[]
    wide?: boolean
  } = $props()

  const id = $props.id()
</script>

<label class="field" class:wide for={id}>
  <span class="label">{label}</span>
  {#if options}
    <select {id} {name} {required} bind:value>
      {#if placeholder}
        <option value="" disabled>{placeholder}</option>
      {/if}
      {#each options as o (o.value)}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
  {:else if rows}
    <textarea {id} {name} {rows} {required} {placeholder} bind:value></textarea>
  {:else}
    <input {id} {name} {type} {required} {placeholder} {step} bind:value list={list ? `${id}-list` : undefined} />
    {#if list}
      <datalist id="{id}-list">
        {#each list as l (l)}
          <option value={l}></option>
        {/each}
      </datalist>
    {/if}
  {/if}
</label>

<style>
  .field {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .label {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
</style>
