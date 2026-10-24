import {
  BlockExtension,
  BlockquoteExtension,
  CodeExtension,
  DEFAULT_SLASH_COMMANDS,
  DividerExtension,
  HeadingExtension,
  HtmlPasteExtension,
  ListExtension,
  ListItemExtension,
  MarkdownPasteExtension,
  MarkdownShortcutsExtension,
  Nabu,
  NabuPasteExtension,
  ParagraphExtension,
  PlainTextPasteExtension,
  RichTextExtension,
  type Extension,
} from '@aionbuilders/nabu'
import { DecisionExtension } from './decision.svelte.ts'

// The benchmark's block set, from nabu's own extensions plus the decision
// embed. Left out: typography (it rewrites "--" as an em dash), callout,
// toggle, dialogue, zone and the media blocks.
export const extensions: Extension[] = [
  ParagraphExtension,
  HeadingExtension,
  BlockquoteExtension,
  DividerExtension,
  CodeExtension,
  ListExtension,
  ListItemExtension,
  RichTextExtension,
  MarkdownShortcutsExtension,
  PlainTextPasteExtension,
  HtmlPasteExtension,
  MarkdownPasteExtension,
  NabuPasteExtension,
  BlockExtension,
  DecisionExtension,
]

const kept = new Set(['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Bulleted list', 'Numbered list', 'To-do list', 'Code', 'Quote', 'Divider'])

export const commands = [
  ...DEFAULT_SLASH_COMMANDS.filter((c) => kept.has(c.title)),
  { title: 'Decision', icon: '⚖', aliases: ['decision', 'vote', 'd-'], run: (e: Nabu) => e.exec('decision:insert', { ref: 'd-2026-011' }) },
]

export function engine(snapshot?: Uint8Array, extra: Extension[] = []) {
  return new Nabu({ snapshot, extensions: [...extensions, ...extra] })
}
