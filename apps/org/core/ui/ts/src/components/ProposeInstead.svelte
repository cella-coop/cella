<script lang="ts">
  import { useSettings } from '../hooks/useSettings.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { took } from '../post.ts'
  import Button from './Button.svelte'
  import Field from './Field.svelte'

  // The motion a setting's change needs, offered as the change commits: a
  // dialog in the top layer saying plainly that a motion of the deciding
  // circle makes it, the change from the value in force to the one typed,
  // and why, in the guard's own words; and the motions' New form,
  // prefilled, which the reader may change before it posts to the page's
  // `action`, by the page's `send`. Cancel, Escape or a click outside it
  // takes the change back.
  let { action }: { action: string } = $props()

  const state = useSettings()
  const writes = useWrites()
  const id = $props.id()

  async function onsubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!state.propose()) {
      return
    }
    let proposed = false
    let reason: string | undefined
    try {
      const fields = [...new FormData(e.currentTarget as HTMLFormElement)].flatMap(([k, v]): [string, string][] => (typeof v === 'string' ? [[k, v]] : []))
      const result = await writes.shown(writes.send(action, fields))
      proposed = took(result)
      reason = !proposed && 'done' in result ? result.done?.reason : undefined
    } finally {
      state.answered(proposed, reason)
    }
  }

  function onbackdrop(e: MouseEvent) {
    if (e.target === state.dialog) {
      state.close()
    }
  }
</script>

<dialog bind:this={state.dialog} class="propose" aria-labelledby="{id}-title" onclose={() => state.closed()} onclick={onbackdrop}>
  {#if state.offered}
    {const o = $derived(state.offered)}
    <h2 id="{id}-title" class="title">{o.name} changes it by motion</h2>
    <p class="change">
      <span class="label">{o.change.label}</span>
      <s class="was">{o.change.was || 'Empty'}</s>
      <span aria-hidden="true">→</span><span class="visually-hidden">to</span>
      <span class="value">{o.change.value || 'Empty'}</span>
    </p>
    <p class="why">{o.reason}</p>
    <p class="lead">Propose it as written here, or change it first.</p>
    <form method="post" class="form" {onsubmit}>
      <Field label="Title" name="title" value={o.title} required wide />
      <Field label="Circle" name="circle" options={[{ value: o.circle, label: o.name }]} value={o.circle} required />
      <Field label="Deadline" name="deadline" type="date" value={o.deadline} required />
      <input type="hidden" name="kind" value={o.kind} />
      {#each o.args as a (a.name)}
        {#if a.label}
          <Field label={a.label} name="arg.{a.name}" value={a.value} wide />
        {:else}
          <input type="hidden" name="arg.{a.name}" value={a.value} />
        {/if}
      {/each}
      <Field label="Proposal" name="body" rows={3} wide />
      {#if state.problem}<p class="problem" role="alert">{state.problem}</p>{/if}
      <div class="buttons">
        <Button onclick={() => state.close()}>Cancel</Button>
        <Button type="submit" tone="primary" busy={state.proposing}>Propose to {o.name}</Button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  .propose {
    width: min(34rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 4rem);
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    background: var(--float);
    color: var(--text);
    box-shadow: var(--shadow-float);
  }
  .propose[open] {
    display: grid;
    gap: var(--space-3);
  }
  /* What lies behind dims, untinted, as behind the command menu. */
  .propose::backdrop {
    background: oklch(0 0 0 / 22%);
    backdrop-filter: blur(3px);
  }
  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
  }
  .change {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .change .label {
    color: var(--text-muted);
  }
  .was {
    color: var(--text-subtle);
  }
  .value {
    font-weight: 500;
  }
  .why {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--sunk);
    font-size: var(--text-sm);
  }
  .lead {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--text-sm);
  }
  .form {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-3);
  }
  .problem {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--negative-text);
    font-size: var(--text-sm);
  }
  .buttons {
    grid-column: 1 / -1;
    display: flex;
    justify-content: end;
    gap: var(--space-2);
  }
</style>
