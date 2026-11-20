<script lang="ts">
  import { blocks, type Embeds } from '@cella/org-ui'
  import type { Block } from '../models/canonical.ts'
  import ReadList from './ReadList.svelte'
  import ReadEmbed from './ReadEmbed.svelte'
  import Runs from './Runs.svelte'

  // Sibling blocks as a reader shows them, drawing the kit's own block
  // components, the editor's without its editing: numbers counted among
  // siblings, embeds drawn by the slice that knows their kind.
  let { blocks: list, depth = 0, embeds = {} }: { blocks: Block[]; depth?: number; embeds?: Embeds } = $props()

  const numbers = $derived.by(() => {
    let n = 0
    return list.map((b) => (b.type === 'numbered' ? ++n : (n = 0)))
  })
  const level = (b: Block) => (typeof b.level === 'number' ? b.level : 1) as 1 | 2 | 3
</script>

{#each list as b, i (i)}
  <div class="block" data-kind={b.type}>
    <div class="line">
      <div class="body" role={b.type === 'bullet' || b.type === 'numbered' ? 'list' : undefined}>
        {#if b.type === 'heading'}
          <blocks.Heading level={level(b)}>
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </blocks.Heading>
        {:else if b.type === 'todo'}
          <blocks.Todo checked={b.checked === true} disabled>
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </blocks.Todo>
        {:else if b.type === 'bullet' || b.type === 'numbered'}
          <blocks.Item numbered={b.type === 'numbered'} number={numbers[i]} {depth}>
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </blocks.Item>
        {:else if b.type === 'quote'}
          <blocks.Quote>
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </blocks.Quote>
        {:else if b.type === 'code'}
          <blocks.Code>
            {#snippet language()}{b.language ?? 'text'}{/snippet}
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </blocks.Code>
        {:else if b.type === 'divider'}
          <blocks.Divider />
        {:else if b.type === 'embed'}
          <ReadEmbed kind={String(b.embed ?? '')} ref={String(b.ref ?? '')} {embeds} />
        {:else}
          <blocks.Paragraph>
            <div class="text"><Runs runs={b.runs ?? []} /></div>
          </blocks.Paragraph>
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
