<script lang="ts">
  import type { Embeds } from '@cella/org-ui'
  import type { Block } from '../models/canonical.ts'
  import ReadList from './ReadList.svelte'
  import ReadEmbed from './ReadEmbed.svelte'
  import Runs from './Runs.svelte'

  // Sibling blocks as a reader shows them, in the editor's markup without
  // its editing: numbers counted among siblings, embeds drawn by the
  // slice that knows their kind.
  let { blocks, depth = 0, embeds = {} }: { blocks: Block[]; depth?: number; embeds?: Embeds } = $props()

  const numbers = $derived.by(() => {
    let n = 0
    return blocks.map((b) => (b.type === 'numbered' ? ++n : (n = 0)))
  })
  const bullet = $derived(['•', '◦', '▪'][depth % 3])
  const level = (b: Block) => (typeof b.level === 'number' ? b.level : 1)
</script>

{#each blocks as b, i (i)}
  <div class="block" data-kind={b.type}>
    <div class="line">
      <div class="body">
        {#if b.type === 'heading'}
          <div class="heading" data-level={level(b)} role="heading" aria-level={level(b) + 1}>
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </div>
        {:else if b.type === 'bullet' || b.type === 'numbered' || b.type === 'todo'}
          <div class="item" data-done={(b.type === 'todo' && b.checked === true) || undefined}>
            {#if b.type === 'todo'}
              <input type="checkbox" checked={b.checked === true} disabled aria-label="Done" />
            {:else if b.type === 'numbered'}
              <span class="marker" data-numbered aria-hidden="true">{numbers[i]}.</span>
            {:else}
              <span class="marker" aria-hidden="true">{bullet}</span>
            {/if}
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </div>
        {:else if b.type === 'quote'}
          <blockquote class="quote"><div class="text"><Runs runs={b.runs ?? []} /></div></blockquote>
        {:else if b.type === 'code'}
          <div class="code">
            <span class="language">{b.language ?? 'text'}</span>
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </div>
        {:else if b.type === 'divider'}
          <div class="divider"><hr /></div>
        {:else if b.type === 'embed'}
          <ReadEmbed kind={String(b.embed ?? '')} ref={String(b.ref ?? '')} {embeds} />
        {:else}
          <div class="text"><Runs runs={b.runs ?? []} /></div>
        {/if}
      </div>
    </div>
    {#if b.children?.length}
      <div class="children">
        <ReadList blocks={b.children} depth={depth + 1} {embeds} />
      </div>
    {/if}
  </div>
{/each}
