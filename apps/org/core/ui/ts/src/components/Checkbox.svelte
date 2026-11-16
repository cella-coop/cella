<script lang="ts">
  import type { Snippet } from 'svelte'
  import Check from 'phosphor-svelte/lib/Check'
  import Icon from './Icon.svelte'

  // The one checkbox and the one switch, never the browser's: one button
  // that says whether it is on (`aria-checked`), Space or a press anywhere
  // on it turning it once, its box and the text that names it inside it,
  // or, with no text, named by its `label`. A switch (`role="switch"`)
  // wears a track and a knob, a checkbox a box with a check. With a
  // `name` it posts `value` while on, as a form's checkbox does. Given
  // `checked`, it turns at once and follows the value as it changes, as
  // where the address follows it; bound, it reads only what holds it
  // says. A turn is handed to `onchange` and announced to what holds it
  // as a `change` event, so a setting commits as it is made.
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

<button type="button" class="check {role}" class:bare={!children} {role} aria-checked={checked} aria-label={label} {disabled} {onclick}>
  <span class="box">{#if role === 'checkbox' && checked}<Icon icon={Check} size="0.8em" />{/if}</span>
  {#if children}<span class="text">{@render children()}</span>{/if}
</button>
{#if name && checked}<input type="hidden" {name} {value} />{/if}

<style>
  .check {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--text);
    font-size: var(--text-sm);
    text-align: start;
    cursor: pointer;
  }
  .check:disabled {
    cursor: default;
    color: var(--text-muted);
  }
  .text {
    min-width: 0;
  }
  .box {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    border: 1px solid var(--line);
    background: var(--sunk);
    color: var(--on-accent);
    transition:
      background var(--fast) var(--ease),
      border-color var(--fast) var(--ease);
  }
  .check:disabled .box {
    opacity: 0.6;
  }
  .checkbox .box {
    width: 1rem;
    height: 1rem;
    border-radius: 4px;
  }
  .checkbox[aria-checked='true'] .box {
    border-color: var(--accent-fill);
    background: var(--accent-fill);
  }
  /* A switch: a track the knob crosses, filled with ink once on. */
  .switch .box {
    width: 1.75rem;
    height: 1rem;
    border-radius: var(--radius-pill);
  }
  .switch .box::after {
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
  .switch[aria-checked='true'] .box {
    border-color: var(--accent-fill);
    background: var(--accent-fill);
  }
  .switch[aria-checked='true'] .box::after {
    translate: 0.75rem 0;
    background: var(--on-accent);
  }
  .bare.checkbox:focus-visible {
    border-radius: 4px;
  }
  .bare.switch:focus-visible {
    border-radius: var(--radius-pill);
  }
</style>
