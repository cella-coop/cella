<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Trigger } from '../models/rich.ts'
  import type { Suggest } from '../hooks/RichState.svelte.ts'
  import { useForm } from '../hooks/useForm.ts'
  import { useRich } from '../hooks/useRich.ts'
  import { ArrowUp } from '../icons.ts'
  import CaretMenu from './CaretMenu.svelte'
  import Floating from './Floating.svelte'
  import FormatBar from './FormatBar.svelte'
  import Hidden from './Hidden.svelte'
  import Icon from './Icon.svelte'

  // A comment box: its text written rich, set as a document's text is, with
  // no grip or slash menu, in a field with a faint edge, `rows` lines tall
  // at rest and growing as it is written. A toolbar over a selection marks
  // it bold, italic or code, links it or makes it a list, as Ctrl or Cmd
  // with B, I, E and K do; `- `, `1. `, `> `, `**x**`, `*x*` and `` `x` ``
  // typed become what they say; Enter breaks the line. Where `suggest`
  // answers, `@` or `[[` typed offers its suggestions, picked by arrow and
  // Enter or by a press, each put in as a chip that posts its token. Its
  // form posts it under `name` as the Markdown subset (`models/rich.ts`),
  // by the small round arrow at its bottom right, named `send`, bright
  // once there is text, or by Ctrl or Cmd with Enter; the form's reset
  // empties it. `head` sits inside its top, as a quote it answers. It has
  // no label of its own: `label` names it to assistive technology.
  let {
    label,
    name,
    value = $bindable(''),
    placeholder = '',
    rows = 2,
    send,
    suggest,
    head,
  }: {
    label: string
    name: string
    value?: string
    placeholder?: string
    rows?: number
    send?: string
    suggest?: Suggest
    head?: Snippet
  } = $props()

  const form = useForm()
  const rich = useRich(
    () => suggest,
    (v) => (value = v),
  )
  const tools = [
    { key: 'bold', label: 'B', title: 'Bold (Ctrl-B)' },
    { key: 'italic', label: 'I', title: 'Italic (Ctrl-I)' },
    { key: 'code', label: '</>', title: 'Code (Ctrl-E)' },
    { key: 'link', label: 'Link', title: 'Link (Ctrl-K)' },
    { key: 'bullet', label: '•', title: 'Bulleted list' },
    { key: 'numbered', label: '1.', title: 'Numbered list' },
  ]
  const heads: Record<Trigger, string> = { '@': 'Mention', '[[': 'Link a document' }

  function choose(key: string) {
    if (key === 'link') {
      rich.linking()
    } else if (key === 'bullet' || key === 'numbered') {
      rich.list(key)
    } else if (key === 'bold' || key === 'italic' || key === 'code') {
      rich.mark(key)
    }
  }
</script>

<div class="box" class:sends={!!send} data-box-field>
  {#if head}<div class="head">{@render head()}</div>{/if}
  <div
    class="text"
    contenteditable="true"
    role="textbox"
    tabindex="0"
    aria-multiline="true"
    aria-label={label}
    data-rich
    data-placeholder={placeholder}
    data-empty={rich.empty || undefined}
    style:--rows={rows}
    {@attach rich.attach}
  ></div>
  {#if send}
    <button type="submit" class="send" class:ready={!rich.blank} title="{send} (Ctrl-Enter)" aria-label={send} disabled={rich.blank} aria-busy={form.pending}>
      <Icon icon={ArrowUp} weight="regular" />
    </button>
  {/if}
  <Hidden {name} value={rich.value} />
</div>
{#if rich.bar}
  {#if rich.href === null}
    <FormatBar x={rich.bar.x} y={rich.bar.y} above={rich.bar.above} {tools} active={(k) => rich.marks[k as keyof typeof rich.marks]} onchoose={choose} />
  {:else}
    <Floating x={rich.bar.x} y={rich.bar.y} above={rich.bar.above} label="Format" role="toolbar">
      <div class="href">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          aria-label="Link to"
          placeholder="https://…"
          autofocus
          bind:value={rich.href}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              rich.link()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              rich.unlinking()
            }
          }}
        />
        <button onclick={() => rich.link()}>{rich.href ? 'Link' : 'Unlink'}</button>
      </div>
    </Floating>
  {/if}
{/if}
{#if rich.asking && rich.offered.length}
  <div data-picker>
    <CaretMenu x={rich.asking.x} y={rich.asking.y} above={rich.asking.above} label={heads[rich.asking.trigger]} items={rich.offered} active={rich.active} onchoose={(i) => rich.pick(rich.offered[i])}>
      {#snippet item(it)}
        {const s = $derived(it as (typeof rich.offered)[number])}
        <span>{s.label}</span>{#if s.sub}<span class="hint">{s.sub}</span>{/if}
      {/snippet}
    </CaretMenu>
  </div>
{/if}

<style>
  /* A field's well with a faint edge, the arrow inside it. */
  .box {
    position: relative;
    display: grid;
    border: 1px solid color-mix(in oklab, var(--text) 10%, transparent);
    border-radius: var(--radius-panel);
    background: var(--float);
    transition:
      border-color var(--fast) var(--ease),
      box-shadow var(--fast) var(--ease);
  }
  .box:focus-within {
    border-color: var(--accent-border);
  }
  .head {
    padding: var(--space-2) var(--space-3) 0;
  }
  /* Set as a document's text is. */
  .text {
    position: relative;
    min-height: calc(var(--rows) * 1lh + 2 * var(--space-2));
    max-height: 60vh;
    overflow-y: auto;
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-ui);
    font-size: var(--text-md);
    line-height: 1.55;
    color: var(--text);
    overflow-wrap: anywhere;
    cursor: text;
  }
  /* The box's edge says where the focus is; the ring, the keyboard's. */
  .text:focus-visible {
    outline: none;
    box-shadow: var(--focus);
    border-radius: var(--radius-panel);
  }
  .sends .text {
    padding-inline-end: calc(1.75rem + var(--space-3));
  }
  .text[data-empty]::before {
    content: attr(data-placeholder);
    position: absolute;
    color: var(--text-subtle);
    pointer-events: none;
  }
  .text :global(p),
  .text :global(div) {
    margin: 0;
  }
  .text :global(ul),
  .text :global(ol) {
    margin: 0;
    padding-inline-start: 1.6em;
  }
  .text :global(blockquote) {
    margin: 0;
    padding-inline-start: var(--space-3);
    border-inline-start: 3px solid var(--text);
    font-style: italic;
  }
  .text :global(code) {
    font-family: var(--font-mono);
    font-size: 0.8em;
    background: var(--sunk);
    border-radius: 4px;
    padding: 0.1em 0.25em;
    color: var(--negative-text);
  }
  .text :global(a) {
    color: var(--accent-text);
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
    text-underline-offset: 2px;
  }
  /* A mention or a link picked here, in the contenteditable surface
     itself rather than a component: `Chip`'s own `inline` look, raw DOM
     having no room for the component that draws it elsewhere. */
  .text :global(.token) {
    padding: 0 0.3em;
    border-radius: var(--radius-control);
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 500;
    white-space: nowrap;
  }
  /* The small round arrow that posts it: dim until there is text. */
  .send {
    position: absolute;
    inset-inline-end: var(--space-2);
    inset-block-end: calc((1.55 * var(--text-md) + 2 * var(--space-2) - 1.75rem) / 2);
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--sunk);
    color: var(--text-subtle);
    font-size: var(--text-md);
    cursor: default;
    transition:
      background var(--fast) var(--ease),
      color var(--fast) var(--ease);
  }
  .send.ready {
    background: var(--primary-fill);
    color: var(--primary-text);
    cursor: pointer;
  }
  .send.ready:hover {
    filter: brightness(0.94);
  }
  .send[aria-busy='true'] {
    opacity: 0.6;
    cursor: progress;
  }
  .href {
    display: flex;
    gap: 2px;
  }
  .href input {
    width: 16rem;
    min-height: 1.9rem;
    padding: 0 var(--space-2);
  }
</style>
