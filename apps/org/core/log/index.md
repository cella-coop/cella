+++
title = "Log"
updated = 2026-10-24
+++

A signed, hash-chained log in CBOR, with an envelope every entry extends. It becomes the notary's log: receipts, verdicts and signed batches of confluent writes, folded deterministically into the state.

Copied from cella@2398d87 `distros/core/runtime/rust/log`, where its history lives. Its API still speaks of claims and cells; the notary's port renames them.

## Reading the log

`ts/` (`@cella/org-log`) reads the notary's log as the shell shows it: its
entries, newest first, each with its op, actor, verdict date, receipt and
deciding rules' owners; an entry with its receipt, hashes and signatures
and each rule's text from `cella.rule_text`; whether `cella.verify_log()`
passes, which the collection's header shows as its status, and the head
and the scope's key; and the scope's address. Its slice
mounts the `log` collection, the one a core library owns; it has no
writes, since only the notary appends.
