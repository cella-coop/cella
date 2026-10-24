+++
title = "Log"
updated = 2026-10-24
+++

A signed, hash-chained log in CBOR, with an envelope every entry extends. It becomes the notary's log: receipts, verdicts and signed batches of confluent writes, folded deterministically into the state.

Copied from cella@2398d87 `distros/core/runtime/rust/log`, where its history lives. Its API still speaks of claims and cells; the notary's port renames them.
