<script lang="ts">
  import { changer, type Setting } from '../models/settings.ts'
  import { useSettings } from '../hooks/useSettings.ts'
  import Field from './Field.svelte'

  // One setting: its label, its value in force in its field, editable
  // whoever reads it, and under it, quietly, what changes it; a change a
  // Save left unsaved is marked so. A number field emptied reads as
  // empty, never as null.
  let { setting }: { setting: Setting } = $props()

  const state = useSettings()
  const unsaved = $derived(state.unsaved.includes(setting.name))
</script>

<div class="setting" class:unsaved>
  <Field
    label={setting.label}
    name={setting.name}
    type={setting.type}
    options={setting.options}
    rows={setting.rows}
    bind:value={() => state.value(setting), (v) => state.type(setting, v === null || v === undefined ? '' : String(v))}
  />
  <p class="how">
    {changer(setting, state.decider)}{#if unsaved}<span class="mark">Not saved</span>{/if}
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
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--text-subtle);
  }
  .mark {
    color: var(--warning-text);
  }
</style>
