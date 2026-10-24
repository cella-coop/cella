+++
title = "Db"
updated = 2026-10-24
+++

The shape every write handler takes (`@cella/org-db`). `write` runs one write in one transaction. First the actor's device signs the write's request, the handler's input made plain (`@cella/org-sign`), as the member's device does before sending; then, in the transaction, the handler's state change, its deferred constraint triggers made immediate (`SET CONSTRAINTS ALL IMMEDIATE`, so an unbalanced entry refuses before the verdict, not at commit), then `cella.submit(op, payload, actor, { request, device, nonce, sig })` last, then commit. A refusal, SQLSTATE `09000` from the notary's signature check, a rule or a feat's trigger, rolls the transaction back and returns `Refused`, numbered by the last verdict it was judged after; any other error rolls back and is thrown. Every write takes this path, whatever its label: until rung 2 a confluent or bounded write still meets the server's rules and triggers, so it too may return `Refused` (`Outcome` in `@cella/org-ops`); only an ordered write may also be `Pending`.

It also holds a slice's server side as the shell mounts it (`src/slice.ts`):
`Slice`, its collections' reads and writes, what it adds to the
collections of the feats it joins and its reactions; `Action`, a write
from a page, the form read into a handler's input; `action(op, input,
handler)`, which makes one; and `Done`, a write's outcome made plain:
settled, pending, refused, or failed before any verdict, with the writes
that reacted to it.

`Db` is the one method a handler needs of a connection, which a `pg` client fits; `Deps` carries it, the actor and their `Signer`. A `Write` names its op, the `request` the member signs, the state change, which is handed the proof so a write can record the device that signed it (an enrolment does), and the payload the log commits to.
