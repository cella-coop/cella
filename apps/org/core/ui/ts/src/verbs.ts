import type { Component } from 'svelte'
import Archive from 'phosphor-svelte/lib/Archive'
import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise'
import ArrowRight from 'phosphor-svelte/lib/ArrowRight'
import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck'
import CalendarPlus from 'phosphor-svelte/lib/CalendarPlus'
import CaretDoubleDown from 'phosphor-svelte/lib/CaretDoubleDown'
import Check from 'phosphor-svelte/lib/Check'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import Coins from 'phosphor-svelte/lib/Coins'
import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple'
import Envelope from 'phosphor-svelte/lib/Envelope'
import Eye from 'phosphor-svelte/lib/Eye'
import EyeSlash from 'phosphor-svelte/lib/EyeSlash'
import FileArrowUp from 'phosphor-svelte/lib/FileArrowUp'
import Fingerprint from 'phosphor-svelte/lib/Fingerprint'
import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk'
import HandCoins from 'phosphor-svelte/lib/HandCoins'
import Link from 'phosphor-svelte/lib/Link'
import LockSimple from 'phosphor-svelte/lib/LockSimple'
import PaperPlaneRight from 'phosphor-svelte/lib/PaperPlaneRight'
import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
import Play from 'phosphor-svelte/lib/Play'
import Plus from 'phosphor-svelte/lib/Plus'
import Prohibit from 'phosphor-svelte/lib/Prohibit'
import Receipt from 'phosphor-svelte/lib/Receipt'
import Scales from 'phosphor-svelte/lib/Scales'
import SignIn from 'phosphor-svelte/lib/SignIn'
import SignOut from 'phosphor-svelte/lib/SignOut'
import Trash from 'phosphor-svelte/lib/Trash'
import UploadSimple from 'phosphor-svelte/lib/UploadSimple'
import UserMinus from 'phosphor-svelte/lib/UserMinus'
import UserPlus from 'phosphor-svelte/lib/UserPlus'
import X from 'phosphor-svelte/lib/X'
import XCircle from 'phosphor-svelte/lib/XCircle'

// An action's icon by its verb, so the same verb wears the same icon on
// every button (the operator, 19 Nov): read from its words, the whole of
// them first, then their first two, then their first, as "Mark sent" is
// a sending and "Mark read" a check. A form's button takes it unless it
// names its own (`Form`'s `lead`).
const verbs: Record<string, Component<any>> = {
  approve: Check,
  take: Check,
  cast: Check,
  'mark read': Check,
  'mark myself': CheckCircle,
  complete: CheckCircle,
  refuse: X,
  cancel: XCircle,
  hold: CalendarCheck,
  schedule: CalendarPlus,
  file: FileArrowUp,
  attach: UploadSimple,
  upload: UploadSimple,
  submit: PaperPlaneRight,
  apply: PaperPlaneRight,
  'mark sent': PaperPlaneRight,
  issue: Receipt,
  pay: Coins,
  reimburse: Coins,
  draw: Coins,
  'record a': Coins,
  'record payment': Coins,
  distribute: HandCoins,
  propose: Scales,
  appoint: Scales,
  review: Scales,
  save: FloppyDisk,
  reset: ArrowCounterClockwise,
  delete: Trash,
  discard: Trash,
  remove: Trash,
  erase: Trash,
  void: Prohibit,
  revoke: Prohibit,
  withdraw: SignOut,
  forget: UserMinus,
  hire: UserPlus,
  invite: Envelope,
  enrol: Fingerprint,
  link: Link,
  'new invitation': Link,
  close: LockSimple,
  archive: Archive,
  run: Play,
  correct: PencilSimple,
  rename: PencilSimple,
  change: PencilSimple,
  export: DownloadSimple,
  continue: ArrowRight,
  choose: ArrowRight,
  see: ArrowRight,
  show: CaretDoubleDown,
  view: Eye,
  stop: EyeSlash,
  sign: SignIn,
  this: CalendarBlank,
  the: CalendarBlank,
  add: Plus,
  create: Plus,
  start: Plus,
  new: Plus,
  draft: Plus,
  prepare: Plus,
  log: Plus,
  open: Plus,
  record: Plus,
  grant: Plus,
  table: Plus,
  spread: Plus,
  begin: Plus,
}

/** The icon an action's words name by their verb, if any. */
export function verb(words: string | undefined): Component<any> | undefined {
  const all = (words ?? '').trim().toLowerCase().split(/\s+/)
  return verbs[all.join(' ')] ?? verbs[all.slice(0, 2).join(' ')] ?? verbs[all[0]]
}
