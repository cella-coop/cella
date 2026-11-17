<script lang="ts">
  import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown'
  import type { Option } from '../models/select.ts'
  import { place } from '../models/place.ts'
  import { useSelect } from '../hooks/useSelect.ts'
  import Choice from './Choice.svelte'
  import Icon from './Icon.svelte'
  import Pick from './Pick.svelte'

  // The one select, never the browser's: a combobox button that opens the
  // one picker, `Pick`, in the top layer, so nothing clips it, anchored
  // to the button and flipped to stay in the viewport. Its options are
  // drawn as the properties are elsewhere, with a search box once the list
  // is long; the chosen one wears a check and one may be marked, quietly,
  // as the default. Options take an icon, a tone, a kind or a person and
  // sit under a heading where they name a group. Escape closes it, the
  // focus back on the button. With a `name` it posts the value as a
  // form's field, `required` holding the form back while none is chosen;
  // without a placeholder and with no value of its own it reads as its
  // first option, as the browser's would. A choice is handed to `onchange`
  // and announced to what holds it as a `change` event, so a setting
  // commits as it is made.
  let {
    options,
    value = $bindable(''),
    name,
    id,
    label,
    labelledby,
    placeholder,
    required = false,
    disabled = false,
    fit = false,
    focus = false,
    onchange,
  }: {
    options: Option[]
    value?: string
    // The field's name in the form it posts in.
    name?: string
    // The button's id, which a `<label for>` names it by.
    id?: string
    // Its name where no label names it.
    label?: string
    labelledby?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    // As wide as what it shows, up to a bound, rather than its row.
    fit?: boolean
    // Takes the focus once drawn, as a picker just inserted.
    focus?: boolean
    onchange?: (value: string) => void
  } = $props()

  const uid = $props.id()
  const s = useSelect(
    () => options,
    () => current,
  )
  let trigger: HTMLButtonElement
  let list: HTMLElement

  // The value it holds: its own, else, with no placeholder to show, the
  // first option that may be chosen, as the browser's select reads.
  const own = $derived(options.find((o) => o.value === value))
  const shown = $derived(own ?? (placeholder === undefined ? options.find((o) => !o.disabled) : undefined))
  const current = $derived(shown?.value ?? '')

  const show = () => {
    // Shown from its button, so a press on the button closes it rather
    // than dismissing and reopening it; a browser without `source`
    // ignores it.
    if (!list.matches(':popover-open')) {
      ;(list as HTMLElement & { showPopover(o?: { source?: HTMLElement }): void }).showPopover({ source: trigger })
    }
  }

  function choose(v: string | string[]) {
    const next = String(v)
    trigger.focus()
    // A choice may take the select away, as an embed's picker goes once
    // it picks; the button it was is still told.
    const button = trigger
    if (next !== current || next !== value) {
      value = next
      onchange?.(next)
      button.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  function ontoggle(e: ToggleEvent) {
    if (e.newState === 'open') {
      s.start()
      if (!CSS.supports('position-anchor', '--a')) {
        place(list, trigger, 'bottom')
        list.style.minWidth = `${trigger.getBoundingClientRect().width}px`
      }
      // The search takes the focus; with none, the chosen option does.
      if (!list.querySelector('input')) {
        ;(list.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ?? list.querySelector<HTMLElement>('[role="option"]:not([disabled])'))?.focus()
      }
    } else {
      s.close()
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (!disabled && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      show()
    }
  }
</script>

<span class="select" class:fit>
  <button
    bind:this={trigger}
    {@attach (el) => {
      if (focus) {
        el.focus()
      }
    }}
    type="button"
    {id}
    class="trigger"
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={s.open}
    aria-controls="{uid}-list"
    aria-label={label}
    aria-labelledby={labelledby}
    aria-required={required || undefined}
    {disabled}
    data-value={current}
    data-name={name}
    popovertarget="{uid}-list"
    style:anchor-name="--{uid}"
    {onkeydown}
  >
    <span class="value" class:placeholder={!shown}>
      {#if shown}<Choice o={shown} />{:else}{placeholder ?? ''}{/if}
    </span>
    {#if !disabled}<span class="chevron"><Icon icon={CaretUpDown} /></span>{/if}
  </button>
  {#if name !== undefined && !required}
    <input type="hidden" {name} value={current} />
  {:else if name !== undefined}
    <!-- What the form posts, unseen and out of the tab order; required, it
         holds the form back while none is chosen and sends the focus to
         the button. -->
    <input
      class="proxy"
      tabindex="-1"
      aria-hidden="true"
      autocomplete="off"
      {name}
      value={current}
      {required}
      oninvalid={() => trigger.focus()}
    />
  {/if}
  <div bind:this={list} id="{uid}-list" popover="auto" class="list" style:position-anchor="--{uid}" {ontoggle}>
    {#key s.turn}
      <Pick {options} value={current} label={label ?? ''} onpick={choose} />
    {/key}
  </div>
</span>

<style>
  .select {
    position: relative;
    display: flex;
    min-width: 0;
    width: 100%;
  }
  .fit {
    width: auto;
    max-width: 11rem;
  }
  .trigger {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-width: 0;
    min-height: 2rem;
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text);
    text-align: start;
    cursor: pointer;
    transition: border-color var(--fast) var(--ease);
  }
  .trigger:hover:not(:disabled) {
    border-color: var(--line);
  }
  .trigger:focus-visible,
  .trigger[aria-expanded='true'] {
    border-color: var(--accent-border);
  }
  /* A select that offers no choice reads as its value: muted, with no
     field and no chevron. */
  .trigger:disabled {
    background: transparent;
    color: var(--text-muted);
    cursor: default;
  }
  .value {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .placeholder {
    color: var(--text-subtle);
  }
  .chevron {
    display: grid;
    place-items: center;
    flex: none;
    color: var(--text-subtle);
  }
  .proxy {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }
  .list {
    margin: var(--space-1) 0;
    min-width: anchor-size(width);
    width: max-content;
    max-width: min(22rem, calc(100vw - 2 * var(--space-2)));
    max-height: min(20rem, calc(100dvh - 2 * var(--space-2)));
    overflow-y: auto;
    padding: var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
    position-area: bottom span-right;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  }
</style>
