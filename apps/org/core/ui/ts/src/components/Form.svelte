<script lang="ts">
  import type { Snippet } from 'svelte'
  import { applyAction } from '$app/forms'
  import { refreshAll } from '$app/navigation'
  import { page } from '$app/state'
  import { useForm } from '../hooks/useForm.ts'
  import { lost, post, type Result } from '../post.ts'
  import Button from './Button.svelte'

  // A write: the fields post to the page's named action, files and all,
  // and this browser's device signs what the server asks (`post`); the
  // outcome comes back as the page's form data. `reset` false keeps what
  // was typed after a settled write, for a field whose value follows the
  // page's data.
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

  // The fields a refused write names as already written.
  const spent = (data: Record<string, unknown> | undefined): string[] => {
    const done = data?.done as { spent?: unknown } | undefined
    return Array.isArray(done?.spent) ? done.spent.filter((n): n is string => typeof n === 'string') : []
  }

  // One post at a time: a press while one is under way is dropped, since
  // each post signs a write of its own.
  async function onsubmit(e: SubmitEvent) {
    e.preventDefault()
    const el = e.currentTarget as HTMLFormElement
    if (!form.start()) {
      return
    }
    try {
      // A post with no answer may have written all the same: its outcome
      // is unknown, and what was typed stays.
      const result: Result = await post(el.action, new FormData(el, e.submitter)).catch(lost)
      if (result.type === 'success') {
        if (reset) {
          el.reset()
        }
        await refreshAll()
      } else if (result.type === 'failure' && spent(result.data).length) {
        // A write of several that stopped part-way: what it wrote
        // stands, so its fields are emptied and the page shows it.
        for (const name of spent(result.data)) {
          const field = el.elements.namedItem(name)
          if (field instanceof HTMLInputElement) {
            field.value = ''
          }
        }
        await refreshAll()
      }
      await applyAction(result)
    } finally {
      form.done()
    }
  }

  // The action keeps the page's address, as its open tab, so the page
  // the write returns to is the one it was made from.
  const target = $derived.by(() => {
    const kept = [...page.url.searchParams].filter(([k]) => !k.startsWith('/'))
    return `?/${action}${kept.length ? `&${new URLSearchParams(kept)}` : ''}`
  })
</script>

<form method="post" enctype="multipart/form-data" action={target} class="form" class:inline {onsubmit}>
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
    gap: var(--space-2);
  }
</style>
