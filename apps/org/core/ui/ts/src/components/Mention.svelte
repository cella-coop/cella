<script lang="ts">
  // An item named inside a text, a member mentioned or a document linked:
  // a quiet chip linking to it, or plain when there is nothing to link.
  let { label, href, title }: { label: string; href?: string; title?: string } = $props()
</script>

<!-- On one line: it sits inside a sentence, which a space would break. -->
{#if href}<a class="mention" {href} {title}>{label}</a>{:else}<span class="mention unknown" {title}>{label}</span>{/if}

<style>
  .mention {
    padding: 0 0.3em;
    border-radius: var(--radius-control);
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
  }
  a.mention:hover {
    text-decoration: underline;
  }
  .unknown {
    background: var(--sunk);
    color: var(--text-muted);
  }
</style>
