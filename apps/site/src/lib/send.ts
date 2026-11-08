// How the site's forms send (index.md, the forms): each posts itself to
// its endpoint in the page, so the page stays put, and says what came of
// it from its `template[data-done]` or `template[data-failed]`. A form
// with no endpoint, as in the dev server, sends nothing and only says
// what it would.
export function wire(selector: string) {
  for (const form of document.querySelectorAll<HTMLFormElement>(selector)) {
    const said = form.querySelector<HTMLElement>('[role=status]')!
    const say = (which: 'done' | 'failed') => {
      said.textContent = form.querySelector<HTMLTemplateElement>(`template[data-${which}]`)!.content.textContent
      said.dataset.state = which
      said.hidden = false
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const endpoint = form.dataset.endpoint
      form.dataset.busy = ''
      try {
        if (endpoint) {
          const res = await fetch(endpoint, { method: 'POST', body: new FormData(form) })
          if (!res.ok) {
            throw new Error(String(res.status))
          }
        }
        form.reset()
        say('done')
      } catch {
        say('failed')
      } finally {
        delete form.dataset.busy
      }
    })
  }
}
