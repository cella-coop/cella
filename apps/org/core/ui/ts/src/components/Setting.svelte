<script lang="ts">
  import { who, type Setting } from '../models/settings.ts'
  import { useSettings } from '../hooks/useSettings.ts'
  import { committing } from '../attachments/committing.ts'
  import Arrange from './Arrange.svelte'
  import Checkbox from './Checkbox.svelte'
  import Field from './Field.svelte'
  import Who from './Who.svelte'

  // One setting: its label, beside it who changes it where the reader's
  // own write does not (`Who`) and how to use it where it says (`help`),
  // its value in its field, editable whoever reads it, and under it,
  // quietly, how its last commit went, announced as it changes. A pick
  // commits as it is made, a typed value on leaving the field or on
  // Enter, and Escape takes a typed edit back; one declaring choices is an
  // arrangement, each drop a commit; a toggle is a switch, each turn a
  // commit, drawn under the setting before it at `depth` 1. A number
  // field emptied reads as empty, never as null.
  let { setting }: { setting: Setting } = $props()

  const state = useSettings()
  const mark = $derived(state.marks[setting.name])
  const waiting = $derived(state.waiting(setting))
  const changer = $derived(who(setting, state.decider, !!waiting))
</script>

{#snippet hint()}
  {#if changer}<Who who={changer} />{/if}
  {#if setting.help}<Who who={{ kind: 'help', label: `How to change ${setting.label.toLowerCase()}`, text: setting.help }} />{/if}
{/snippet}

<div class="setting" class:inner={setting.depth === 1} class:toggle={setting.type === 'toggle'} {@attach committing({ commit: () => state.commit(setting), revert: () => state.revert(setting) })}>
  {#if setting.choices}
    <Arrange
      label={setting.label}
      value={state.value(setting)}
      choices={setting.choices}
      grouped={setting.grouped}
      {hint}
      onchange={(v) => {
        state.type(setting, v)
        state.commit(setting)
      }}
    />
  {:else if setting.type === 'toggle'}
    <span class="line">
      <Checkbox
        role="switch"
        checked={state.value(setting) === 'yes'}
        disabled={setting.disabled}
        onchange={(on) => {
          state.type(setting, on ? 'yes' : 'no')
          state.commit(setting)
        }}>{setting.label}</Checkbox
      >
      {@render hint()}
    </span>
  {:else}
    <Field
      label={setting.label}
      name={setting.name}
      type={setting.type}
      options={setting.options}
      rows={setting.rows}
      hint={changer || setting.help ? hint : undefined}
      bind:value={() => state.value(setting), (v) => state.type(setting, v === null || v === undefined ? '' : String(v))}
    />
  {/if}
  {#if waiting && !setting.choices}
    <p class="was">In force <s>{waiting.shown?.was ?? (waiting.was || 'Empty')}</s>, proposed to {state.decider?.name}</p>
  {/if}
  <p class="how" aria-live="polite">
    <span class="mark" data-state={mark?.state}
      >{#if mark?.state === 'saving'}Saving…{:else if mark?.state === 'saved'}Saved{:else if mark?.state === 'proposed'}Proposed{:else if mark?.state === 'gathered'}Added to the changes to propose{:else if mark?.state === 'refused'}Not saved: {mark.reason}{/if}</span
    >
  </p>
</div>

<style>
  .setting {
    display: grid;
    gap: var(--space-1);
  }
  .setting.toggle {
    gap: 0;
  }
  .setting.inner {
    margin-inline-start: var(--space-4);
    padding-inline-start: var(--space-2);
    border-inline-start: 1px solid var(--line);
  }
  .line {
    display: flex;
    align-items: center;
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
  .was {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .was s {
    color: var(--text-subtle);
  }
  .mark[data-state='saved'],
  .mark[data-state='proposed'],
  .mark[data-state='gathered'] {
    color: var(--positive-text);
  }
  .mark[data-state='refused'] {
    color: var(--negative-text);
  }
</style>
