<script lang="ts">
  import type { Snippet } from 'svelte'
  import Check from 'phosphor-svelte/lib/Check'
  import Icon from './Icon.svelte'

  // The one checkbox and the one switch, never the browser's: a button
  // that says whether it is on (`aria-checked`), Space or a press turning
  // it, its text beside it in the label that names it, or, with none, its
  // `label`. A switch (`role="switch"`) wears a track and a knob, a
  // checkbox a box with a check. With a `name` it posts `value` while on,
  // as a form's checkbox does. A turn is handed to `onchange` and
  // announced to what holds it as a `change` event, so a setting commits
  // as it is made.
  let {
    checked = $bindable(false),
    role = 'checkbox',
    label,
    disabled = false,
    name,
    value = 'on',
    onchange,
    children,
  }: {
    checked?: boolean
    role?: 'checkbox' | 'switch'
    // Its name where no text beside it names it.
    label?: string
    disabled?: boolean
    name?: string
    value?: string
    onchange?: (checked: boolean) => void
    children?: Snippet
  } = $props()

  function onclick(e: MouseEvent) {
    const next = !checked
    checked = next
    onchange?.(next)
    ;(e.currentTarget as HTMLElement).dispatchEvent(new Event('change', { bubbles: true }))
  }
</script>

{#snippet control()}
  <button type="button" class="box {role}" {role} aria-checked={checked} aria-label={label} {disabled} {onclick}>
    {#if role === 'checkbox' && checked}<Icon icon={Check} size="0.8em" />{/if}
  </button>
  {#if name && checked}<input type="hidden" {name} {value} />{/if}
{/snippet}

{#if children}
  <label class="check" class:disabled>{@render control()}<span class="text">{@render children()}</span></label>
{:else}
  {@render control()}
{/if}

<style>
  .check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .check.disabled {
    cursor: default;
    color: var(--text-muted);
  }
  .text {
    min-width: 0;
  }
  .box {
    display: inline-grid;
    place-items: center;
    flex: none;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--sunk);
    color: var(--on-accent);
    cursor: pointer;
    transition:
      background var(--fast) var(--ease),
      border-color var(--fast) var(--ease);
  }
  .box:disabled {
    cursor: default;
    opacity: 0.6;
  }
  .checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: 4px;
  }
  .checkbox[aria-checked='true'] {
    border-color: var(--accent-fill);
    background: var(--accent-fill);
  }
  /* A switch: a track the knob crosses, filled with ink once on. */
  .switch {
    position: relative;
    width: 1.75rem;
    height: 1rem;
    border-radius: var(--radius-pill);
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 1px;
    left: 1px;
    width: calc(1rem - 4px);
    height: calc(1rem - 4px);
    border-radius: 50%;
    background: var(--text-muted);
    transition:
      translate var(--fast) var(--ease),
      background var(--fast) var(--ease);
  }
  .switch[aria-checked='true'] {
    border-color: var(--accent-fill);
    background: var(--accent-fill);
  }
  .switch[aria-checked='true']::after {
    translate: 0.75rem 0;
    background: var(--on-accent);
  }
  .checkbox:focus-visible {
    border-radius: 4px;
  }
  .switch:focus-visible {
    border-radius: var(--radius-pill);
  }
</style>
