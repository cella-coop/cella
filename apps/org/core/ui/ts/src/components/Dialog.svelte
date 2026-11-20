<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from './Button.svelte'
  import { verb } from '../verbs.ts'

  // The one modal: a dialog in the top layer, what lies behind it dimmed,
  // its title naming it, what it says above its form, the form's fields,
  // and under them, why the last submit was refused and the buttons,
  // Cancel and the one that confirms. A modal is no page: it confirms
  // what it holds. Submitting hands its fields, by name, to `onsubmit`;
  // Cancel, Escape or a click outside it calls `oncancel`, and its close
  // event `onclose`. Whoever opens it holds the element (`dialog`).
  // Without `onsubmit` it holds forms of their own, as New holds a
  // collection's create forms, each ending in its own confirming button
  // and Cancel (`Form` in a `useCreate` dialog), and draws no form or
  // buttons itself.
  let {
    dialog = $bindable(),
    title,
    submit,
    busy = false,
    problem = null,
    onsubmit,
    oncancel,
    onclose,
    lead,
    children,
  }: {
    dialog?: HTMLDialogElement
    title: string
    submit?: string
    busy?: boolean
    problem?: string | null
    onsubmit?: (fields: [string, string][]) => void
    oncancel?: () => void
    onclose?: () => void
    lead?: Snippet
    children: Snippet
  } = $props()

  const id = $props.id()

  const cancel = () => (oncancel ? oncancel() : dialog?.close())

  function submitted(e: SubmitEvent) {
    e.preventDefault()
    const form = new FormData(e.currentTarget as HTMLFormElement)
    onsubmit?.([...form].flatMap(([k, v]): [string, string][] => (typeof v === 'string' ? [[k, v]] : [])))
  }

  function onbackdrop(e: MouseEvent) {
    if (e.target === dialog) {
      cancel()
    }
  }

  // Escape cancels as Cancel does, so whoever opened it hears it first.
  function oncancelled(e: Event) {
    e.preventDefault()
    cancel()
  }
</script>

<dialog bind:this={dialog} class="dialog" aria-labelledby="{id}-title" {onclose} oncancel={oncancelled} onclick={onbackdrop}>
  <h2 id="{id}-title" class="title">{title}</h2>
  {@render lead?.()}
  {#if onsubmit}
    <form method="post" class="form" onsubmit={submitted}>
      {@render children()}
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
      <div class="buttons" data-run>
        <Button lead={verb('Cancel')} onclick={cancel}>Cancel</Button>
        <Button type="submit" tone="primary" lead={verb(submit)} {busy}>{submit}</Button>
      </div>
    </form>
  {:else}
    {@render children()}
  {/if}
</dialog>

<style>
  .dialog {
    width: min(34rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 4rem);
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--radius-float);
    --surface: var(--float);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-float);
  }
  /* A dialog holding something wide, as a week's grid, widens to show it
     whole where the screen allows. */
  .dialog:has(:global([data-wide])) {
    width: min(54rem, calc(100vw - 2rem));
  }
  .dialog[open] {
    display: grid;
    gap: var(--space-3);
  }
  /* What lies behind dims, untinted, as behind the command menu. */
  .dialog::backdrop {
    background: oklch(0 0 0 / 22%);
    backdrop-filter: blur(3px);
  }
  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 500;
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
