+++
title = "Log"
updated = 2026-11-20
+++

A signed, hash-chained log in CBOR, with an envelope every entry extends. It becomes the notary's log: receipts, verdicts and signed batches of confluent writes, checked by their hashes and signatures and never replayed to rebuild the state, which a scope restores from its backup ([trust](../../../../_corpus/doc/trust.md#one-server)).

Copied from cella@2398d87 `distros/core/runtime/rust/log`, where its history lives. Its API still speaks of claims and cells; the notary's port renames them.

## Reading the log

`ts/` (`@cella/org-log`) reads the notary's log as the shell shows it: its
entries, newest first, each with its action, actor, verdict date, receipt and
deciding guards' owners; an entry with its receipt, hashes and signatures
and each guard's text from `cella.guard_text`; whether `cella.verify_log()`
passes, which the collection's header shows as its status, and the head
and the scope's key; and the scope's address, and its name and legal
name (`named`, from the coop's particulars in force, `circle.particulars()`). Its slice
mounts the `log` collection, the one a core library owns; it has no
writes, since only the notary appends.

## Activity

The shell lists the log as Activity, a list of who did what and when
(the `list` layout of [the UI core](../ui/index.md#components)), its
person and date columns its default fields: each
entry a line naming its actor, as their chip, then what they did, then
its verdict date, newest first. What they did is said from the op, its
verb in the past and its thing: `invoice:invoice:send` reads "sent
invoice F-2026-004", `circle:role:seat` "seated a role in circle
coordination"; an op whose thing is general, as a run or a period,
names its feat with it, "approved a payslip run". The line links to the
record the entry is about, the first of the ids `cella.records(n)`
reads whose kind has a page in the shell, its thing's before its
feats'; an entry about no record the shell shows links to the entry
itself. The entry's page holds the rest: its op as the log keeps it,
its receipt, hashes and signatures among its properties, and its deciding
guards, the panel it opens on (`panels`, with no body, [record page
layout](../../../../_corpus/doc/architecture.md#record-page-layout)). An entry keeps
nothing of what a write was about but these ids, its op and its actor,
so the list says no amount, title or name.
