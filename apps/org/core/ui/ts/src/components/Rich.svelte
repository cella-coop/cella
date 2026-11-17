<script lang="ts">
  import type { Snippet } from 'svelte'
  import { parse, type Inline } from '../models/rich.ts'

  // A comment's rich text, drawn from its Markdown subset
  // (`models/rich.ts`) by its nodes alone, never as HTML: a plain comment
  // reads as it was written, its lines broken where they were. `words`
  // draws each run of plain text, where a feat splits out its mentions and
  // links; without it the text is drawn as it is.
  let { text, words }: { text: string; words?: Snippet<[string]> } = $props()

  const blocks = $derived(parse(text))
  const away = (href: string) => /^https?:/i.test(href)
</script>

<!-- Inline runs on one line each: whitespace between them would be text. -->
{#snippet runs(items: Inline[])}{#each items as n, i (i)}{#if n.kind === 'text'}{#if words}{@render words(n.text)}{:else}{n.text}{/if}{:else if n.kind === 'break'}<br />{:else if n.kind === 'code'}<code>{n.text}</code>{:else if n.kind === 'bold'}<strong>{@render runs(n.children)}</strong>{:else if n.kind === 'italic'}<em>{@render runs(n.children)}</em>{:else if n.kind === 'link'}<a href={n.href} target={away(n.href) ? '_blank' : undefined} rel={away(n.href) ? 'noopener noreferrer' : undefined}>{@render runs(n.children)}</a>{/if}{/each}{/snippet}

<div class="rich">
  {#each blocks as b, i (i)}
    {#if b.kind === 'paragraph'}
      <p>{@render runs(b.children)}</p>
    {:else if b.kind === 'quote'}
      <blockquote>{@render runs(b.children)}</blockquote>
    {:else if b.kind === 'bullet'}
      <ul>
        {#each b.items as item, k (k)}<li>{@render runs(item)}</li>{/each}
      </ul>
    {:else if b.kind === 'numbered'}
      <ol start={b.start}>
        {#each b.items as item, k (k)}<li>{@render runs(item)}</li>{/each}
      </ol>
    {/if}
  {/each}
</div>

<style>
  /* Set as the box that wrote it, a document's text. */
  .rich {
    display: grid;
    gap: var(--space-2);
    white-space: normal;
    overflow-wrap: anywhere;
  }
  p,
  blockquote,
  ul,
  ol {
    margin: 0;
  }
  ul,
  ol {
    padding-inline-start: 1.6em;
  }
  blockquote {
    padding-inline-start: var(--space-3);
    border-inline-start: 3px solid var(--text);
    font-style: italic;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.8em;
    background: var(--sunk);
    border-radius: 4px;
    padding: 0.1em 0.25em;
    color: var(--negative-text);
  }
  a {
    color: var(--accent-text);
    text-decoration: underline;
    text-decoration-color: var(--accent-border);
    text-underline-offset: 2px;
  }
</style>
