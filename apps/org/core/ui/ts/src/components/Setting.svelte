<script lang="ts">
  import { changer, type Setting } from '../models/settings.ts'
  import { useSettings } from '../hooks/useSettings.ts'
  import Arrange from './Arrange.svelte'
  import Field from './Field.svelte'

  // One setting: its label, its value in force in its field, editable
  // whoever reads it, and under it, quietly, what changes it and its last
  // write's outcome: saving, saved, or the reason it was refused; a
  // change left unsaved is marked so. It is left as focus leaves it, by
  // Enter in a one-line field, or as a choice is made; one declaring
  // choices is an arrangement, left at each move. A number field emptied
  // reads as empty, never as null.
  let { setting }: { setting: Setting } = $props()

  const state = useSettings()
  const unsaved = $derived(state.unsaved.includes(setting.name))
  const note = $derived(state.notes[setting.name])

  function onfocusout(e: FocusEvent) {
    if (!(e.relatedTarget instanceof Node && (e.currentTarget as HTMLElement).contains(e.relatedTarget))) {
      state.leave(setting)
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
      state.leave(setting)
    }
  }

  function onchange(e: Event) {
    if (e.target instanceof HTMLSelectElement) {
      state.leave(setting)
    }
  }
</script>

<div class="setting" class:unsaved>
  {#if setting.choices}
    <Arrange
      label={setting.label}
      value={state.value(setting)}
      choices={setting.choices}
      onchange={(v) => {
        state.type(setting, v)
        state.leave(setting)
      }}
    />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions: it hears its field leave, by focus, Enter or a choice, and is not itself a control -->
    <div class="left" {onfocusout} {onkeydown} {onchange}>
      <Field
        label={setting.label}
        name={setting.name}
        type={setting.type}
        options={setting.options}
        rows={setting.rows}
        bind:value={() => state.value(setting), (v) => state.type(setting, v === null || v === undefined ? '' : String(v))}
      />
    </div>
  {/if}
  <p class="how" aria-live="polite">
    {changer(setting, state.decider)}{#if note?.state === 'saving'}<span>Saving…</span>{:else if note?.state === 'saved'}<span class="saved">Saved</span>{/if}{#if unsaved}<span class="mark">Not saved</span>{/if}
  </p>
  {#if note?.state === 'refused'}<p class="refused" role="alert">{note.reason}</p>{/if}
</div>

<style>
  .setting {
    display: grid;
    gap: var(--space-1);
  }
  .left {
    display: grid;
  }
  .how {
    margin: 0;
    display: flex;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .saved {
    color: var(--positive-text);
  }
  .mark {
    color: var(--warning-text);
  }
  .refused {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--negative-text);
  }
</style>
