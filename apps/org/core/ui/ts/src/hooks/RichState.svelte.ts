import { asked, escape, literal, pasted, safe, unlisted, type Suggestion, type Trigger } from '../models/rich.ts'

// A comment box's rich text while it is written: the browser's own
// editable text, which keeps the caret, composition, undo and the
// clipboard, read back as the Markdown subset on every change; the
// toolbar over a selection and the marks under it; and the suggestion
// asked for at the caret. Every change goes through the browser's
// editing commands, so its undo undoes it.
export type Mark = 'bold' | 'italic' | 'code'
export type Kind = 'bullet' | 'numbered'
export type Suggest = (trigger: Trigger, query: string) => Suggestion[]

const lists: Record<Kind, string> = { bullet: 'insertUnorderedList', numbered: 'insertOrderedList' }
const lines = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'SECTION', 'ARTICLE'])

const run = (command: string, value?: string) => document.execCommand(command, false, value)

function wrap(mark: string, s: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : s
}

// An inline node as Markdown.
function inline(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) {
    return literal((n as Text).data.replace(/ /g, ' ').replace(/​/g, ''))
  }
  if (!(n instanceof HTMLElement)) {
    return ''
  }
  if (n.dataset.token) {
    return n.dataset.token
  }
  const inner = () => [...n.childNodes].map(inline).join('')
  switch (n.tagName) {
    case 'BR':
      return '\n'
    case 'B':
    case 'STRONG':
      return wrap('**', inner())
    case 'I':
    case 'EM':
      return wrap('*', inner())
    case 'CODE': {
      const t = (n.textContent ?? '').replace(/[`​]/g, '')
      return t ? `\`${t}\`` : ''
    }
    case 'A': {
      const href = n.getAttribute('href') ?? ''
      const text = inner()
      return safe(href) && text.trim() ? `[${text}](${href})` : text
    }
  }
  if (Number(n.style.fontWeight) >= 600 || n.style.fontWeight === 'bold') {
    return wrap('**', inner())
  }
  if (n.style.fontStyle === 'italic') {
    return wrap('*', inner())
  }
  return inner()
}

// A list's items as Markdown lines, a nested list's after its item.
function items(list: HTMLElement): string[] {
  const numbered = list.tagName === 'OL'
  const start = Number(list.getAttribute('start') ?? 1)
  const out: string[] = []
  let k = 0
  for (const li of list.children) {
    if (li.tagName === 'UL' || li.tagName === 'OL') {
      out.push(...items(li as HTMLElement))
      continue
    }
    let text = ''
    const nested: string[] = []
    for (const c of li.childNodes) {
      if (c instanceof HTMLElement && (c.tagName === 'UL' || c.tagName === 'OL')) {
        nested.push(...items(c))
      } else if (c instanceof HTMLElement && lines.has(c.tagName)) {
        text += ` ${block(c).join(' ')}`
      } else {
        text += inline(c).replace(/\n/g, ' ')
      }
    }
    out.push(`${numbered ? `${start + k}.` : '-'} ${text.trim()}`, ...nested)
    k++
  }
  return out
}

// An element's lines as Markdown: its text lines, broken where a break
// or a block ends one, its lists and its quotes.
function block(el: Element): string[] {
  const out: string[] = []
  let line: string | null = null
  const flush = () => {
    if (line !== null) {
      out.push(unlisted(line))
      line = null
    }
  }
  for (const n of el.childNodes) {
    const tag = n instanceof HTMLElement && !n.dataset.token ? n.tagName : ''
    if (tag === 'UL' || tag === 'OL') {
      flush()
      out.push(...items(n as HTMLElement))
    } else if (tag === 'BLOCKQUOTE') {
      flush()
      out.push(...block(n as Element).map((l) => (l ? `> ${l}` : '>')))
    } else if (lines.has(tag)) {
      flush()
      const inner = block(n as Element)
      out.push(...(inner.length ? inner : ['']))
    } else if (tag === 'BR') {
      out.push(unlisted(line ?? ''))
      line = null
    } else {
      line = (line ?? '') + inline(n)
    }
  }
  flush()
  return out
}

// The editor's text as Markdown, its blank ends dropped.
export function markdown(root: Element): string {
  return block(root)
    .join('\n')
    .replace(/^(\s*\n)+/, '')
    .replace(/\s+$/, '')
}

export class RichState {
  value = $state('')
  empty = $state(true)
  // Where the toolbar floats, over the selection, and the marks under it.
  bar = $state<{ x: number; y: number; above: number } | null>(null)
  marks = $state<Record<Mark | Kind | 'link', boolean>>({ bold: false, italic: false, code: false, link: false, bullet: false, numbered: false })
  // The address a link is being given, while its field is open.
  href = $state<string | null>(null)
  // The suggestion asked for at the caret, where its list floats, and the
  // one the arrows reached.
  asking = $state<{ trigger: Trigger; query: string; x: number; y: number; above: number } | null>(null)
  active = $state(0)
  #suggest: () => Suggest | undefined
  #changed: (value: string) => void
  #el: HTMLElement | null = null
  #saved: Range | null = null
  #at: { node: Text; from: number; to: number } | null = null

  constructor(suggest: () => Suggest | undefined, changed: (value: string) => void) {
    this.#suggest = suggest
    this.#changed = changed
  }

  // Whether there is nothing to post.
  get blank(): boolean {
    return this.value.trim() === ''
  }

  // The suggestions offered for what is asked, the first six.
  get offered(): Suggestion[] {
    const a = this.asking
    return a ? (this.#suggest()?.(a.trigger, a.query) ?? []).slice(0, 6) : []
  }

  // The editable element's listeners, for as long as it is mounted; its
  // form's reset empties it, as a settled post resets the form.
  attach = (el: HTMLElement) => {
    this.#el = el
    const form = el.closest('form')
    const input = (e: Event) => this.#input(e as InputEvent)
    const keydown = (e: KeyboardEvent) => this.#keydown(e)
    const paste = (e: ClipboardEvent) => {
      e.preventDefault()
      this.#insert(e.clipboardData?.getData('text/plain') ?? '')
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      const at = document.caretRangeFromPoint?.(e.clientX, e.clientY)
      if (at) {
        const s = document.getSelection()
        s?.removeAllRanges()
        s?.addRange(at)
      }
      this.#insert(e.dataTransfer?.getData('text/plain') ?? '')
    }
    const selection = () => this.#selection()
    const reset = () => {
      el.replaceChildren()
      this.#sync()
    }
    el.addEventListener('input', input)
    el.addEventListener('keydown', keydown)
    el.addEventListener('paste', paste)
    el.addEventListener('drop', drop)
    el.addEventListener('blur', selection)
    document.addEventListener('selectionchange', selection)
    form?.addEventListener('reset', reset)
    return () => {
      el.removeEventListener('input', input)
      el.removeEventListener('keydown', keydown)
      el.removeEventListener('paste', paste)
      el.removeEventListener('drop', drop)
      el.removeEventListener('blur', selection)
      document.removeEventListener('selectionchange', selection)
      form?.removeEventListener('reset', reset)
      this.#el = null
    }
  }

  focus() {
    this.#el?.focus()
  }

  #sync() {
    const el = this.#el
    if (!el) {
      return
    }
    this.value = markdown(el)
    this.empty = !el.textContent && !el.querySelector('li, blockquote, [data-token]')
    this.#changed(this.value)
  }

  #insert(md: string) {
    if (md) {
      run('insertHTML', pasted(md))
      this.#sync()
    }
  }

  // Whether the selection is inside the editor.
  #inside(): Selection | null {
    const s = document.getSelection()
    return s?.rangeCount && this.#el?.contains(s.anchorNode) ? s : null
  }

  #selection() {
    const s = this.#inside()
    if (!s || document.activeElement !== this.#el) {
      if (this.href === null) {
        this.bar = null
      }
      this.asking = null
      return
    }
    const range = s.getRangeAt(0)
    const at = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)
    const within = (selector: string) => !!at(s.anchorNode)?.closest(selector) && this.#el!.contains(at(s.anchorNode)!.closest(selector))
    this.marks = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      code: within('code'),
      link: within('a'),
      bullet: within('ul'),
      numbered: within('ol'),
    }
    if (s.isCollapsed) {
      this.bar = this.href === null ? null : this.bar
      this.#ask(s)
      return
    }
    this.asking = null
    const r = range.getClientRects()[0] ?? range.getBoundingClientRect()
    this.bar = { x: r.left, y: r.bottom + 6, above: r.top - 6 }
  }

  // The suggestion asked for before the caret, if the box offers any.
  #ask(s: Selection) {
    const node = s.anchorNode
    if (!this.#suggest() || !(node instanceof Text) || node.parentElement?.closest('code')) {
      this.asking = null
      return
    }
    const a = asked(node.data.slice(0, s.anchorOffset))
    if (!a) {
      this.asking = null
      return
    }
    this.#at = { node, from: s.anchorOffset - a.length, to: s.anchorOffset }
    const r = s.getRangeAt(0).getClientRects()[0] ?? this.#el!.getBoundingClientRect()
    if (this.asking?.query !== a.query) {
      this.active = 0
    }
    this.asking = { trigger: a.trigger, query: a.query, x: r.left, y: r.bottom + 4, above: r.top - 4 }
  }

  // A suggestion picked: what was typed for it becomes its token, a chip
  // the caret steps over, and a space.
  pick(item: Suggestion) {
    const at = this.#at
    const s = document.getSelection()
    const trigger = this.asking?.trigger
    if (!at || !s || !at.node.isConnected) {
      return
    }
    this.#el?.focus()
    const range = document.createRange()
    range.setStart(at.node, Math.max(0, at.from))
    range.setEnd(at.node, Math.min(at.node.length, at.to))
    s.removeAllRanges()
    s.addRange(range)
    // The browser's insertHTML moves an uneditable chip out of its line,
    // so it is put where the typed text was by hand, and the space after
    // it typed.
    run('delete')
    const chip = document.createElement('span')
    chip.className = 'token'
    chip.contentEditable = 'false'
    chip.dataset.token = item.token
    chip.textContent = `${trigger === '@' ? '@' : ''}${item.label}`
    const here = document.getSelection()?.getRangeAt(0)
    if (!here) {
      return
    }
    here.insertNode(chip)
    here.setStartAfter(chip)
    here.collapse(true)
    s.removeAllRanges()
    s.addRange(here)
    run('insertText', ' ')
    this.asking = null
    this.#sync()
  }

  mark(kind: Mark) {
    if (kind !== 'code') {
      run(kind)
      this.#sync()
      this.#selection()
      return
    }
    const s = this.#inside()
    if (!s) {
      return
    }
    const node = s.anchorNode
    const code = (node instanceof Element ? node : node?.parentElement)?.closest('code')
    if (code && this.#el?.contains(code)) {
      const range = document.createRange()
      range.selectNode(code)
      s.removeAllRanges()
      s.addRange(range)
      run('insertText', code.textContent ?? '')
    } else if (!s.isCollapsed) {
      run('insertHTML', `<code>${escape(s.toString())}</code>​`)
    }
    this.#sync()
    this.#selection()
  }

  list(kind: Kind) {
    run(lists[kind])
    this.#sync()
    this.#selection()
  }

  // Opens the link's field over the selection, keeping the selection to
  // link once the address is given.
  linking() {
    const s = this.#inside()
    if (!s) {
      return
    }
    const node = s.anchorNode
    const a = (node instanceof Element ? node : node?.parentElement)?.closest('a')
    if (a && this.#el?.contains(a) && s.isCollapsed) {
      const range = document.createRange()
      range.selectNodeContents(a)
      s.removeAllRanges()
      s.addRange(range)
    }
    this.#saved = s.getRangeAt(0).cloneRange()
    const r = this.#saved.getClientRects()[0] ?? this.#saved.getBoundingClientRect()
    this.bar = { x: r.left, y: r.bottom + 6, above: r.top - 6 }
    this.href = a?.getAttribute('href') ?? ''
  }

  // The link given: the selection linked to it, the text it was on kept,
  // or the address itself where nothing was selected; no address unlinks.
  // Only an address on the web, a mail or a path in the app is linked.
  link() {
    const saved = this.#saved
    const typed = (this.href ?? '').trim()
    const href = typed && !/^[a-z][a-z0-9+.-]*:|^\//i.test(typed) ? `https://${typed}` : typed
    if (href && !safe(href)) {
      return
    }
    this.href = null
    this.#saved = null
    this.#el?.focus()
    const s = document.getSelection()
    if (!saved || !s) {
      return
    }
    s.removeAllRanges()
    s.addRange(saved)
    if (!href) {
      run('unlink')
    } else if (saved.collapsed) {
      run('insertHTML', `<a href="${escape(href)}">${escape(href)}</a>`)
    } else {
      run('createLink', href)
    }
    this.#sync()
  }

  unlinking() {
    this.href = null
    this.#saved = null
    this.bar = null
    this.#el?.focus()
  }

  #keydown(e: KeyboardEvent) {
    const offered = this.offered
    if (this.asking && offered.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        this.active = (this.active + (e.key === 'ArrowDown' ? 1 : offered.length - 1)) % offered.length
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        this.pick(offered[this.active] ?? offered[0])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this.asking = null
        return
      }
    }
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key === 'Enter') {
      e.preventDefault()
      if (!this.blank) {
        this.#el?.closest('form')?.requestSubmit()
      }
      return
    }
    const marks: Record<string, Mark> = { b: 'bold', i: 'italic', e: 'code' }
    const key = e.key.toLowerCase()
    if (mod && !e.shiftKey && !e.altKey && marks[key]) {
      e.preventDefault()
      this.mark(marks[key])
      return
    }
    if (mod && key === 'k') {
      e.preventDefault()
      this.linking()
      return
    }
    // Enter on an empty line of a quote leaves the quote.
    if (e.key === 'Enter' && !e.shiftKey && !mod) {
      const s = this.#inside()
      const node = s?.anchorNode
      const el = node instanceof Element ? node : node?.parentElement
      const quote = el?.closest('blockquote')
      const line = el?.closest('div, p') ?? null
      const blank = !(line && quote?.contains(line) ? line : quote)?.textContent?.replace(/​/g, '')
      if (quote && this.#el?.contains(quote) && blank) {
        e.preventDefault()
        run('formatBlock', '<div>')
        this.#sync()
      }
    }
  }

  #input(e: InputEvent) {
    if (e.inputType === 'insertText' && e.data) {
      this.#shortcut(e.data)
    }
    this.#sync()
    const s = this.#inside()
    if (s?.isCollapsed) {
      this.#ask(s)
    }
  }

  // Markdown typed as it is written: `- `, `1. ` and `> ` at a line's
  // start make it a list item or a quote; `**x**`, `*x*` and `` `x` ``
  // as they close make x bold, italic or code.
  #shortcut(typed: string) {
    const s = this.#inside()
    const node = s?.anchorNode
    if (!s?.isCollapsed || !(node instanceof Text) || node.parentElement?.closest('code')) {
      return
    }
    const caret = s.anchorOffset
    const before = node.data.slice(0, caret)
    const select = (from: number, to: number) => {
      const range = document.createRange()
      range.setStart(node, from)
      range.setEnd(node, to)
      s.removeAllRanges()
      s.addRange(range)
    }
    if (typed === ' ') {
      // A line's start, in no list or quote: the browser nests lines in
      // lines as Enter leaves a list.
      let up: Element | null = node.parentElement
      while (up && up !== this.#el && lines.has(up.tagName)) {
        up = up.parentElement
      }
      const starts = (!node.previousSibling || node.previousSibling.nodeName === 'BR') && up === this.#el
      const block = /^([-*]|1[.)]|>)[\s ]$/.exec(before)
      if (starts && block) {
        select(0, caret)
        run('delete')
        if (block[1] === '>') {
          run('formatBlock', '<blockquote>')
        } else {
          run(block[1].startsWith('1') ? lists.numbered : lists.bullet)
        }
      }
      return
    }
    if (typed === '`') {
      const m = /`([^`]+)`$/.exec(before)
      if (m) {
        select(caret - m[0].length, caret)
        run('insertHTML', `<code>${escape(m[1])}</code>​`)
      }
      return
    }
    if (typed !== '*') {
      return
    }
    const bold = /\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/.exec(before)
    const italic = bold ? null : /(?:^|[^*\\])\*([^*\s](?:[^*]*[^*\s])?)\*$/.exec(before)
    const m = bold ?? italic
    if (!m) {
      return
    }
    const inner = m[1]
    const from = caret - inner.length - (bold ? 4 : 2)
    select(from, caret)
    run('insertText', inner)
    const after = document.getSelection()
    const at = after?.anchorNode
    if (!(at instanceof Text) || !after) {
      return
    }
    const end = after.anchorOffset
    const range = document.createRange()
    range.setStart(at, end - inner.length)
    range.setEnd(at, end)
    after.removeAllRanges()
    after.addRange(range)
    const kind = bold ? 'bold' : 'italic'
    run(kind)
    document.getSelection()?.collapseToEnd()
    // What is typed next is not bold or italic.
    if (document.queryCommandState(kind)) {
      run(kind)
    }
  }
}
