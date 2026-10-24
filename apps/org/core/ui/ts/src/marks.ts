// The icons a view may wear in its tab, by name, so a preset and a saved
// view name one as plain data.
import Stack from 'phosphor-svelte/lib/Stack'
import CircleDashed from 'phosphor-svelte/lib/CircleDashed'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import Warning from 'phosphor-svelte/lib/Warning'
import Hourglass from 'phosphor-svelte/lib/Hourglass'
import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
import Star from 'phosphor-svelte/lib/Star'
import Flag from 'phosphor-svelte/lib/Flag'
import BookmarkSimple from 'phosphor-svelte/lib/BookmarkSimple'
import Lightning from 'phosphor-svelte/lib/Lightning'
import Eye from 'phosphor-svelte/lib/Eye'
import Tag from 'phosphor-svelte/lib/Tag'

export const marks = {
  all: Stack,
  open: CircleDashed,
  done: CheckCircle,
  warning: Warning,
  waiting: Hourglass,
  period: CalendarBlank,
  star: Star,
  flag: Flag,
  bookmark: BookmarkSimple,
  lightning: Lightning,
  eye: Eye,
  tag: Tag,
}

export type Mark = keyof typeof marks

export const mark = (name?: string) => marks[(name ?? '') as Mark] ?? BookmarkSimple
