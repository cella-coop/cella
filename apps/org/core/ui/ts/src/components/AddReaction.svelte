<script lang="ts">
  import { SmileySticker } from '../icons.ts'
  import Form from './Form.svelte'
  import Hidden from './Hidden.svelte'
  import Icon from './Icon.svelte'
  import Popover from './Popover.svelte'

  // The way to a message's first reaction, or another: a smiley among its
  // actions, opening the six emoji in one tight row; each toggles the
  // reader's own through `action`, posting the `fields` given with it, and
  // closes the row.
  let {
    items,
    action,
    fields = {},
  }: {
    items: { emoji: string; count: number; mine: boolean }[]
    action: string
    fields?: Record<string, string | number>
  } = $props()

  const shut = (e: MouseEvent) => (e.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()
</script>

<Popover label="Add a reaction" icon menu={false} align="end">
  {#snippet trigger()}<Icon icon={SmileySticker} />{/snippet}
  <div class="row">
    {#each items as r (r.emoji)}
      <Form {action} bare>
        {#each Object.entries(fields) as [name, value] (name)}
          <Hidden {name} {value} />
        {/each}
        <Hidden name="emoji" value={r.emoji} />
        <Hidden name="on" value={r.mine ? '' : 'true'} />
        <button type="submit" class="emoji" class:mine={r.mine} aria-pressed={r.mine} aria-label={r.emoji} onclick={shut}>{r.emoji}</button>
      </Form>
    {/each}
  </div>
</Popover>

<style>
  .row {
    display: flex;
    gap: 2px;
  }
  .emoji {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    border-radius: var(--radius-control);
    background: none;
    font-size: var(--text-lg);
    cursor: pointer;
  }
  .emoji:hover {
    background: var(--hover);
  }
  .mine {
    background: var(--accent-soft);
  }
</style>
