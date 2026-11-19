<script lang="ts">
  import type { Composed } from '../models/compose.ts'
  import type { Decider } from '../models/settings.ts'
  import { useCompose } from '../hooks/useCompose.ts'
  import Button from './Button.svelte'
  import { verb } from '../verbs.ts'
  import Dialog from './Dialog.svelte'
  import Field from './Field.svelte'

  // Something new composed and proposed as one motion: a button opening
  // a `Dialog` of its fields, which says why a motion makes it and
  // proposes it to the circle that decides it, posting the motions' New
  // form to the page's `action`, its title from what was typed and the
  // deadline the decider asks. The guard judges it: a refusal stays in
  // the dialog, saying why, with what was typed.
  let {
    label,
    title,
    decider,
    kind,
    fields,
    args,
    says,
    why,
    action = 'propose',
  }: {
    // The button's text, as `Add a role…`, and the dialog's title.
    label: string
    title: string
    decider: Decider
    kind: string
    fields: Composed[]
    // The arguments the motion carries as they are, as the circle a role
    // is made in.
    args?: Record<string, string>
    says: (values: Record<string, string>) => string
    why?: string
    action?: string
  } = $props()

  const state = useCompose(() => ({ decider, kind, fields, args, says }))
</script>

<div class="compose">
  <Button lead={verb(label)} onclick={() => state.open()}>{label}</Button>
</div>
<Dialog bind:dialog={state.dialog} {title} submit="Propose to {decider.name}" busy={state.proposing} problem={state.problem} onsubmit={() => state.propose(action)}>
  {#snippet lead()}
    {#if why}<p class="why">{why}</p>{/if}
  {/snippet}
  {#each fields as f (f.name)}
    <Field
      label={f.label}
      name="arg.{f.name}"
      type={f.type}
      rows={f.rows}
      wide={f.wide ?? !!f.rows}
      bind:value={() => state.values[f.name], (v) => state.type(f.name, v === null || v === undefined ? '' : String(v))}
    />
  {/each}
</Dialog>

<style>
  .compose {
    display: flex;
    padding-inline: var(--inset, 0);
  }
  .why {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-sm);
  }
</style>
