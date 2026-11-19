<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import { inCreate } from '../hooks/useCreate.ts'
  import { useForm } from '../hooks/useForm.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { formOf } from '../models/bound.ts'
  import { took, type Answer } from '../post.ts'
  import Button from './Button.svelte'

  // A write: the fields post to the route's `write` form for the named
  // write, files and all, each bound to it by name, and this browser's
  // device signs what the server asks (`post`); the outcome comes back
  // with what the page reads refreshed, and the shell shows it. `reset`
  // false keeps what was typed after a settled write, for a field whose
  // value follows the page's data. Under New's dialog (`useCreate`) it is
  // a create form: it ends in Cancel beside its button, a settled write
  // closes the dialog, and a refusal stays in it, saying why, with what
  // was typed.
  let {
    action,
    submit,
    tone = 'primary',
    inline = false,
    reset = true,
    ready = true,
    bare = false,
    button = false,
    lead,
    id,
    children,
  }: {
    action: string
    // Its id, for a submit drawn outside it, as a panel's footer holds the
    // key action of a bare form in its body (`Button`'s `form`).
    id?: string
    // Its button's words; a bare form's button, its children's, is named
    // by its own label.
    submit?: string
    // The form is its one button, its children only the hidden values it
    // posts, as a vote's stance: drawn in the run of buttons beside it,
    // as a panel's footer holds them, never on a line of its own.
    button?: boolean
    // An icon before its button's words.
    lead?: Component<any>
    // The form draws nothing of its own but a refusal: its children are
    // its fields and its submit, as a comment box's arrow inside its text
    // or a reaction's chip.
    bare?: boolean
    tone?: 'primary' | 'quiet' | 'danger' | 'positive'
    inline?: boolean
    reset?: boolean
    // Whether there is anything to post yet.
    ready?: boolean
    children?: Snippet
  } = $props()

  const form = useForm()
  const writes = useWrites()
  const create = inCreate()
  // Each form on a page binds a `write` instance of its own.
  const n = $props.id()
  const remote = $derived(writes.route.form(action, n))
  form.bind(() => formOf(remote.action))

  // The fields a refused write names as already written.
  const spent = (a: Answer): string[] => {
    const done = 'done' in a ? a.done : undefined
    return Array.isArray(done?.spent) ? done.spent.filter((n): n is string => typeof n === 'string') : []
  }

  // One post at a time: a press while one is under way is dropped, since
  // each post signs a write of its own. A post with no answer may have
  // written all the same: its outcome is unknown, and what was typed
  // stays.
  const enhanced = $derived(
    remote.enhance(async (f) => {
      if (!form.start()) {
        return
      }
      form.problem = null
      try {
        const answer = await writes.shown(
          writes.post(async () => {
            await f.submit().updates()
            return f.result as Answer
          }),
        )
        if (took(answer)) {
          if (reset) {
            f.element.reset()
          }
          create?.close()
        } else {
          if (create) {
            form.problem = ('done' in answer ? answer.done?.reason : undefined) ?? 'nothing was created'
          }
          // A write of several that stopped part-way: what it wrote
          // stands, so its fields are emptied and the page shows it.
          for (const name of spent(answer)) {
            const field = f.element.elements.namedItem(form.name(name))
            if (field instanceof HTMLInputElement) {
              field.value = ''
            }
          }
        }
      } finally {
        form.done()
      }
    }),
  )
</script>

<!-- A form that is its button passes the button's run through it
     (`data-through`, `attachments/cell.ts`). -->
<form {...enhanced} {id} enctype="multipart/form-data" class="form" class:inline class:bare={bare || button} data-write={action} data-through={button || undefined}>
  {#if button}
    {@render children?.()}
    <Button type="submit" {tone} {lead} busy={form.pending} disabled={!ready}>{submit}</Button>
  {:else if bare}
    {@render children?.()}
  {:else if children}
    <div class="fields">{@render children()}</div>
  {/if}
  {#if form.problem}<p class="problem" role="alert">{form.problem}</p>{/if}
  {#if !bare && !button}
    <div class="submit">
      {#if create}<Button onclick={() => create.close()}>Cancel</Button>{/if}
      <Button type="submit" {tone} {lead} busy={form.pending} disabled={!ready}>{submit}</Button>
    </div>
  {/if}
</form>

<style>
  /* A form's button floats right, as a dialog's does (the operator, 19
     Nov); a create form ends in Cancel, then its button. */
  .submit {
    display: flex;
    justify-content: end;
    gap: var(--space-2);
  }
  .problem {
    margin: 0;
    color: var(--negative-text);
    font-size: var(--text-sm);
  }
  .form {
    display: grid;
    gap: var(--space-3);
    padding-inline: var(--inset, 0);
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-3);
  }
  .bare {
    display: contents;
  }
  .inline {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .inline .fields {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
