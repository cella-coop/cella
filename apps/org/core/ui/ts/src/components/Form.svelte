<script lang="ts">
  import type { Snippet } from 'svelte'
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
  // value follows the page's data.
  let {
    action,
    submit,
    tone = 'primary',
    inline = false,
    reset = true,
    ready = true,
    children,
  }: {
    action: string
    submit: string
    tone?: 'primary' | 'quiet' | 'danger'
    inline?: boolean
    reset?: boolean
    // Whether there is anything to post yet.
    ready?: boolean
    children?: Snippet
  } = $props()

  const form = useForm()
  const writes = useWrites()
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
        } else {
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

<form {...enhanced} enctype="multipart/form-data" class="form" class:inline data-write={action}>
  {#if children}
    <div class="fields">{@render children()}</div>
  {/if}
  <div class="submit"><Button type="submit" {tone} busy={form.pending} disabled={!ready}>{submit}</Button></div>
</form>

<style>
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
  .inline {
    display: flex;
    align-items: end;
    gap: var(--space-2);
  }
  .inline .fields {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
