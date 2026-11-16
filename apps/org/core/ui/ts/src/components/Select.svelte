<script lang="ts">
  import { tick } from 'svelte'
  import CaretUpDown from 'phosphor-svelte/lib/CaretUpDown'
  import Check from 'phosphor-svelte/lib/Check'
  import { grouped, type Option } from '../models/select.ts'
  import { place } from '../models/place.ts'
  import { useSelect } from '../hooks/useSelect.ts'
  import Icon from './Icon.svelte'

  // The one select, never the browser's: a combobox button that keeps the
  // focus and a listbox in the top layer, so nothing clips it, anchored
  // to the button and flipped to stay in the viewport. The arrows, Page
  // Up and Down, Home and End move among the options past disabled ones,
  // as the active descendant; typing a label's first letters reaches it;
  // Enter or Space chooses, Escape and Tab close, and the focus stays on
  // the button throughout. The chosen option wears a check, and one may
  // be marked, quietly, as the default. Options take an icon and sit
  // under a heading where they name a group. With a `name` it posts the
  // value as a form's field, `required` holding the form back while none
  // is chosen; without a placeholder and with no value of its own it
  // reads as its first option, as the browser's would. A choice is handed
  // to `onchange` and announced to what holds it as a `change` event, so a
  // setting commits as it is made.
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
  const groups = $derived(grouped(options))
  const option = (at: number) => `${uid}-o${at}`

  const show = () => {
    // Shown from its button, so a press on the button closes it rather
    // than dismissing and reopening it; a browser without `source`
    // ignores it.
    if (!list.matches(':popover-open')) {
      ;(list as HTMLElement & { showPopover(o?: { source?: HTMLElement }): void }).showPopover({ source: trigger })
    }
  }
  const hide = () => {
    s.close()
    if (list.matches(':popover-open')) {
      list.hidePopover()
    }
  }

  async function reveal() {
    await tick()
    list?.querySelector(`#${CSS.escape(option(s.active))}`)?.scrollIntoView({ block: 'nearest' })
  }

  function choose(at: number) {
    const o = options[at]
    if (!o || o.disabled) {
      return
    }
    hide()
    trigger.focus()
    // A choice may take the select away, as an embed's picker goes once
    // it picks; the button it was is still told.
    const button = trigger
    if (o.value !== current || o.value !== value) {
      value = o.value
      onchange?.(o.value)
      button.dispatchEvent(new Event('change', { bubbles: true }))
    }

  }

  function ontoggle(e: ToggleEvent) {
    if (e.newState === 'open') {
      if (!s.open) {
        s.start()
      }
      if (!CSS.supports('position-anchor', '--a')) {
        place(list, trigger, 'bottom')
        list.style.minWidth = `${trigger.getBoundingClientRect().width}px`
      }
      reveal()
    } else {
      s.close()
    }
  }

  const printable = (e: KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey

  function onkeydown(e: KeyboardEvent) {
    if (disabled) {
      return
    }
    const k = e.key
    if (!s.open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End'].includes(k)) {
        e.preventDefault()
        s.start(k === 'Home' ? 'first' : k === 'End' ? 'last' : undefined)
        show()
      } else if (printable(e)) {
        e.preventDefault()
        s.start()
        s.type(k)
        show()
      }
      return
    }
    if (k === 'Tab') {
      hide()
      return
    }
    if (k === 'Escape') {
      // Closes the list alone, never the dialog or the popover it sits in.
      e.preventDefault()
      e.stopPropagation()
      hide()
      return
    }
    const moves: Record<string, () => void> = {
      ArrowDown: () => s.move(1),
      ArrowUp: () => s.move(-1),
      PageDown: () => s.move(10),
      PageUp: () => s.move(-10),
      Home: () => s.to('first'),
      End: () => s.to('last'),
      Enter: () => choose(s.active),
      ' ': () => (s.typing ? s.type(' ') : choose(s.active)),
    }
    const act = moves[k] ?? (printable(e) ? () => s.type(k) : null)
    if (act) {
      e.preventDefault()
      act()
      reveal()
    }
  }
</script>

{#snippet item(o: Option, at: number)}
  {const chosen = $derived(o.value === current && !!shown)}
  <!-- svelte-ignore a11y_interactive_supports_focus, a11y_click_events_have_key_events: an option is the combobox's active descendant; the combobox keeps the focus and answers the keys -->
  <div
    role="option"
    id={option(at)}
    class="option"
    class:active={s.open && s.active === at}
    aria-selected={chosen}
    aria-disabled={o.disabled || undefined}
    data-value={o.value}
    onclick={() => choose(at)}
    onpointermove={() => s.hover(at)}
  >
    {#if o.icon}<span class="icon"><Icon icon={o.icon} /></span>{/if}
    <span class="text">{o.label}</span>
    {#if o.default}<span class="default" aria-hidden="true">default</span><span class="visually-hidden">, the default</span>{/if}
    <span class="check">{#if chosen}<Icon icon={Check} />{/if}</span>
  </div>
{/snippet}

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
    aria-activedescendant={s.open && s.active >= 0 ? option(s.active) : undefined}
    aria-label={label}
    aria-labelledby={labelledby}
    aria-required={required || undefined}
    {disabled}
    data-value={current}
    data-name={name}
    popovertarget="{uid}-list"
    style:anchor-name="--{uid}"
    {onkeydown}
    onkeyup={(e) => {
      // Space chooses on its press; its release clicks nothing more.
      if (e.key === ' ') {
        e.preventDefault()
      }
    }}
    onfocusout={hide}
  >
    {#if shown?.icon}<span class="icon"><Icon icon={shown.icon} /></span>{/if}
    <span class="value" class:placeholder={!shown}>{shown?.label ?? placeholder ?? ''}</span>
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
  <!-- svelte-ignore a11y_no_static_element_interactions: the combobox holds the keyboard; a press here keeps its focus -->
  <div
    bind:this={list}
    id="{uid}-list"
    popover="auto"
    role="listbox"
    class="list"
    aria-label={s.open ? label : undefined}
    aria-labelledby={s.open ? labelledby : undefined}
    tabindex="-1"
    style:position-anchor="--{uid}"
    {ontoggle}
    onmousedown={(e) => e.preventDefault()}
  >
    {#each groups as g, gi (gi)}
      {#if g.label}
        <div role="group" class="group" aria-labelledby="{uid}-g{gi}">
          <div class="heading" id="{uid}-g{gi}" role="presentation">{g.label}</div>
          {#each g.options as { option: o, at } (o.value)}{@render item(o, at)}{/each}
        </div>
      {:else}
        {#each g.options as { option: o, at } (o.value)}{@render item(o, at)}{/each}
      {/if}
    {/each}
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
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .placeholder {
    color: var(--text-subtle);
  }
  .icon,
  .chevron,
  .check {
    display: grid;
    place-items: center;
    flex: none;
  }
  .chevron {
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
  .list:popover-open {
    display: grid;
    gap: 1px;
  }
  .group {
    display: grid;
    gap: 1px;
  }
  .group + .group,
  .option + .group,
  .group + .option {
    margin-top: var(--space-1);
    padding-top: var(--space-1);
    border-top: 1px solid var(--line);
  }
  .heading {
    padding: var(--space-1) var(--space-2) 2px;
    font-size: var(--text-2xs);
    color: var(--text-subtle);
  }
  .option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 1.9rem;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
    cursor: pointer;
    user-select: none;
  }
  .option.active {
    background: var(--hover);
  }
  .option[aria-selected='true'] {
    font-weight: 500;
  }
  .option[aria-disabled='true'] {
    color: var(--text-subtle);
    cursor: default;
  }
  .option .text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .default {
    font-size: var(--text-2xs);
    color: var(--text-subtle);
  }
  .check {
    width: 1rem;
    color: var(--text);
  }
</style>
