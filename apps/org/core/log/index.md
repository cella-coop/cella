+++
title = "Log"
updated = 2026-11-01
+++

A signed, hash-chained log in CBOR, with an envelope every entry extends. It becomes the notary's log: receipts, verdicts and signed batches of confluent writes, folded deterministically into the state.

Copied from cella@2398d87 `distros/core/runtime/rust/log`, where its history lives. Its API still speaks of claims and cells; the notary's port renames them.

## Reading the log

`ts/` (`@cella/org-log`) reads the notary's log as the shell shows it: its
entries, newest first, each with its action, actor, verdict date, receipt and
deciding guards' owners; an entry with its receipt, hashes and signatures
and each guard's text from `cella.guard_text`; whether `cella.verify_log()`
passes, which the collection's header shows as its status, and the head
and the scope's key; and the scope's address, and its name and legal
name (`named`, from `cella.scope_name` and `cella.scope_legal_name`). Its slice
mounts the `log` collection, the one a core library owns; it has no
writes, since only the notary appends.
