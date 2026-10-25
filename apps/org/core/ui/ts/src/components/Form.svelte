<script lang="ts">
  import type { Snippet } from 'svelte'
  import { applyAction } from '$app/forms'
  import { refreshAll } from '$app/navigation'
  import { page } from '$app/state'
  import { useForm } from '../hooks/useForm.ts'
  import { post } from '../post.ts'
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

  // One post at a time: a press while one is under way is dropped, since
  // each post signs a write of its own.
  async function onsubmit(e: SubmitEvent) {
    e.preventDefault()
    const el = e.currentTarget as HTMLFormElement
    if (!form.start()) {
      return
    }
    try {
      const result = await post(el.action, new FormData(el, e.submitter))
      if (result.type === 'success') {
        if (reset) {
          el.reset()
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
