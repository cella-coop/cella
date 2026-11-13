<script lang="ts">
  import { changer, type Setting } from '../models/settings.ts'
  import { useSettings } from '../hooks/useSettings.ts'
  import { committing } from '../attachments/committing.ts'
  import Arrange from './Arrange.svelte'
  import Field from './Field.svelte'

  // One setting: its label, its value in force in its field, editable
  // whoever reads it, and under it, quietly, what changes it and how its
  // last commit went, announced as it changes. A pick commits as it is
  // made, a typed value on leaving the field or on Enter, and Escape
  // takes a typed edit back; one declaring choices is an arrangement,
  // each change of it a commit. A number field emptied reads as empty,
  // never as null.
  let { setting }: { setting: Setting } = $props()

  const state = useSettings()
  const mark = $derived(state.marks[setting.name])
</script>

<div class="setting" {@attach committing({ commit: () => state.commit(setting), revert: () => state.revert(setting) })}>
  {#if setting.choices}
    <Arrange
      label={setting.label}
      value={state.value(setting)}
      choices={setting.choices}
      onchange={(v) => {
        state.type(setting, v)
        state.commit(setting)
      }}
    />
  {:else}
    <Field
      label={setting.label}
      name={setting.name}
      type={setting.type}
      options={setting.options}
      rows={setting.rows}
      bind:value={() => state.value(setting), (v) => state.type(setting, v === null || v === undefined ? '' : String(v))}
    />
  {/if}
  <p class="how">
    {changer(setting, state.decider)}<span class="mark" data-state={mark?.state} aria-live="polite"
      >{#if mark?.state === 'saving'}Saving…{:else if mark?.state === 'saved'}Saved{:else if mark?.state === 'proposed'}Proposed{:else if mark?.state === 'refused'}Not saved: {mark.reason}{/if}</span
    >
  </p>
</div>

<style>
  .setting {
    display: grid;
    gap: var(--space-1);
  }
  .how {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .mark[data-state='saved'],
  .mark[data-state='proposed'] {
    color: var(--positive-text);
  }
  .mark[data-state='refused'] {
    color: var(--negative-text);
  }
</style>
