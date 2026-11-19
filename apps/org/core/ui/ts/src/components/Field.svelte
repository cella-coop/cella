<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { Kind, Tone } from '../models/view.ts'
  import { committing } from '../attachments/committing.ts'
  import DateField from './DateField.svelte'
  import FilePicker from './FilePicker.svelte'
  import Icon from './Icon.svelte'
  import Popover from './Popover.svelte'
  import Select from './Select.svelte'
  import TimeField from './TimeField.svelte'
  import Value from './Value.svelte'
  import { useForm } from '../hooks/useForm.ts'

  // A field: text, a number, a date, a time, an address, an email or a
  // file, or a choice among `options`, its label over it. Its modes:
  // - as a form's, it posts its value with the form it is in;
  // - `readonly`, its label and its value as text, no input drawn and
  //   nothing posted, the value drawn by `Value` as its `kind`, or as its
  //   `type` says where the two agree (a number, a day);
  // - `live`, it commits as it changes, as a setting does: a pick as it
  //   is made, a typed value as focus leaves it or on Enter, Escape
  //   taking a typed edit back (`oncommit`, `onrevert`).
  // `bare` draws it compactly, as the drawer's rows: its icon and its
  // value alone, its label only its tooltip and its accessible name; the
  // icon is the field's own (`icon`), or none where the value leads with
  // its own (a state's pill, a record's chip, a person's avatar); a quiet
  // word or two before the value (`lead`, "closes", "quorum") says what
  // it is where the value alone would not. A bare
  // live field fills on hover and opens its `editor` in a popover on a
  // press anywhere on it, never a pencil; a record's chip in it stays its
  // link (`href`).
  let {
    label,
    name = '',
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
    readonly = false,
    live = false,
    oncommit,
    onrevert,
    bare = false,
    kind,
    tone,
    href,
    record,
    icon,
    lead,
    editor,
    open = false,
    onclose,
    children,
  }: {
    label: string
    name?: string
    type?: 'text' | 'number' | 'date' | 'time' | 'url' | 'email' | 'file'
    value?: string | number | null
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
    readonly?: boolean
    live?: boolean
    oncommit?: () => void
    onrevert?: () => void
    bare?: boolean
    // How a read-only or bare value is drawn, where its type does not say.
    kind?: Kind
    tone?: Tone
    href?: string
    record?: string
    icon?: Component<any>
    // A bare field's quiet words before its value.
    lead?: string
    // A bare live field's popover, and whether it opens once drawn, as a
    // property just added opens to set it.
    editor?: Snippet
    open?: boolean
    onclose?: () => void
    // The value drawn some other way than `Value` draws it, as several
    // people's avatars.
    children?: Snippet
  } = $props()

  const id = $props.id()
  // Its name as the form it is in posts it.
  const form = useForm()
  const posted = $derived(form.name(name))
  const drawn = $derived<Kind>(kind ?? (type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'))
  const commits = $derived(live && !bare ? committing({ commit: () => oncommit?.(), revert: () => onrevert?.() }) : undefined)
</script>

{#snippet shown()}
  {#if children}
    {@render children()}
  {:else if href && !record}
    <a class="link" {href}><Value {value} kind={drawn} {tone} size={bare ? 'drawer' : 'cell'} /></a>
  {:else}
    <Value {value} kind={drawn} {tone} {record} {href} size={bare ? 'drawer' : 'cell'} />
  {/if}
{/snippet}

{#snippet line()}
  <span class="visually-hidden">{label}: </span>
  {#if icon}<span class="glyph" aria-hidden="true"><Icon {icon} size="1em" /></span>{/if}
  {#if lead}<span class="lead">{lead}</span>{/if}
  <span class="value">{@render shown()}</span>
{/snippet}

{#if bare && live && editor && href}
  <!-- A record both linked and edited: the button that opens its editor
       lies under the whole row, the link over it, each its own
       interactive element, never one inside the other. -->
  <div class="field bare live linked">
    <Popover {label} menu={false} wide {open} {onclose}>
      {#snippet trigger()}<span class="visually-hidden">Change {label}</span>{/snippet}
      {@render editor()}
    </Popover>
    <span class="line" title={label}>{@render line()}</span>
  </div>
{:else if bare && live && editor}
  <div class="field bare live">
    <Popover {label} menu={false} wide {open} {onclose}>
      {#snippet trigger()}<span class="line" title={label}>{@render line()}</span>{/snippet}
      {@render editor()}
    </Popover>
  </div>
{:else if bare}
  <div class="field bare"><span class="line" title={label}>{@render line()}</span></div>
{:else if readonly}
  <div class="field readonly" class:wide>
    <span class="label">{label}<span class="visually-hidden">: </span>{#if hint}{@render hint()}{/if}</span>
    <span class="value">{@render shown()}</span>
  </div>
{:else}
  <!-- Its label names the field by its id, never by wrapping it, so a press
       inside a select's list, a date's calendar or a time's list is no press
       on the label; a file's label names its Choose file. -->
  <div class="field" class:wide {@attach commits}>
    {#if hint}
      <div class="head"><label class="label" for={id} id="{id}-label">{label}</label>{@render hint()}</div>
    {:else}
      <label class="label" for={id} id="{id}-label">{label}</label>
    {/if}
    {#if options}
      <Select {id} labelledby="{id}-label" name={posted} {options} {placeholder} {required} bind:value={() => String(value ?? ''), (v) => (value = v)} />
    {:else if type === 'date'}
      <DateField {id} name={posted} {required} bind:value={() => value ?? '', (v) => (value = v)} />
    {:else if type === 'time'}
      <TimeField {id} name={posted} {required} bind:value={() => value ?? '', (v) => (value = v)} />
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
{/if}

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

  /* Read-only: the label over its value, in the reader's text. */
  .readonly {
    gap: 0.125rem;
  }
  .readonly .label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .readonly .value {
    display: block;
    min-width: 0;
    font-size: var(--text-sm);
    color: var(--text);
  }

  .link:hover {
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
  }

  /* Bare, as the drawer's rows: one height, a step in from the heading
     over it, its hover fill reaching a little past the heading's edge; an
     icon's box, then the value, which starts at the icon's box where it
     leads with its own. */
  .bare {
    display: block;
    position: relative;
    margin-inline: calc(-1 * var(--space-2));
    border-radius: var(--radius-control);
    font-size: var(--text-sm);
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    min-height: 1.875rem;
    padding-inline: calc(var(--space-2) + var(--space-3)) var(--space-2);
    line-height: 1.4;
    color: var(--text);
    text-align: start;
  }
  .glyph {
    display: inline-flex;
    flex: none;
    justify-content: center;
    width: 1rem;
    color: var(--text-muted);
  }
  /* The lead word, quieter than the value it names and set close to it,
     as one phrase: "closes 31 Oct". */
  .lead {
    flex: none;
    margin-inline-end: calc(var(--space-1) - var(--space-2));
    color: var(--text-muted);
    white-space: nowrap;
  }
  .line .value {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Live: the whole row is its button, filled on hover. */
  .live:hover {
    background: var(--hover);
  }
  .live > :global(.trigger) {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    border-radius: inherit;
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
  }
  .live > :global(.trigger:hover) {
    background: none;
  }
  .linked > :global(.trigger) {
    position: absolute;
    inset: 0;
  }
  .linked > .line {
    position: relative;
    pointer-events: none;
  }
  .linked > .line :global(a) {
    pointer-events: auto;
  }
</style>
