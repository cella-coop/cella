+++
title = "Db"
updated = 2026-11-01
+++

The shape every write handler takes (`@cella/org-db`). `write` runs one write in one transaction. First the actor's device signs the write's request, the handler's input made plain (`@cella/org-sign`), as the member's device does before sending; then, in the transaction, the actor set as its reader and the transaction marked a write's (`cella.actor`, `cella.writing`, both local to it, so the row-level policies let the state change read the whole state, as the guards do), the handler's state change, its deferred constraint triggers made immediate (`SET CONSTRAINTS ALL IMMEDIATE`, so an unbalanced entry refuses before the verdict, not at commit), then `cella.submit(op, payload, actor, { request, device, salt, nonce, sig })` last, then commit. A payload marks each personal value it carries with `personal(field, subject, value)` and an erasure with `erasure(subject, classes?)`, which the notary turns into commitments and carries out ([the vault](../notary/index.md#the-vault)); it never carries a personal value unmarked. A refusal, SQLSTATE `09000` from the notary's signature check, a guard or a feat's trigger, rolls the transaction back and returns `Refused`, numbered by the last verdict it was judged after; any other error rolls back and is thrown. Every write takes this path, whatever its label: until rung 2 a confluent or bounded write still meets the server's guards and triggers, so it too may return `Refused` (`Outcome` in `@cella/org-ops`); only an ordered write may also be `Pending`.

It also holds a slice's server side as the shell mounts it (`src/slice.ts`):
`Slice`, its collections' reads and writes, an item's bytes (`content`),
what it adds to the collections of the feats it joins, whether it opens
bytes the owner keeps closed (`allows`), its reactions and the kinds of
file it imports (`imports`); `Action`, a write
from a page, the form read into a handler's input; `action(op, input,
handler)`, which makes one; `Form`, a form's fields and the files it
carries (`file`); `cents(typed, positive?)`, an amount typed in euros, a
comma or a point and spaces between thousands, in whole cents, refused
unless it is more than nothing where `positive` holds, as every slice's
form reads one; `hundredths(typed)`, a percentage typed the same way,
`5,5` or `20`, in whole hundredths of a percent (550, 2000), refused
past two decimals, as a VAT rate rides in a signed request; and `Done`, a write's outcome made plain:
settled, pending, refused, or failed before any verdict, with the writes
that reacted to it.

`Db` is the one method a handler needs of a connection, which a `pg` client fits; `Deps` carries it, the actor and their `Signer`. A `Write` names its op, the `request` the member signs, the state change, which is handed the proof so a write can record the device that signed it (an enrolment does), and the payload the log commits to.

`src/read.ts` reads a collection in SQL. A collection's rows are a `Read`, a select of `id` and each field under the key of the column that shows it, as the acting member sees them (`cella.reader()` and the row-level policies), with the order it lists in; an extension's fields are a select of `id` and what it adds to that row. A `Source` is a collection's: its owner's read and those of the extensions that add rows, and each extension's fields. One statement composes them, each row the JSON of its fields with every extension's merged over it, one join per extension, and keeps the rows a `Keep` keeps: each `Condition` (an enumeration among some values, a date within the month or year of `cella.verdict_date()`) and a text filter over some keys. `read` answers what a page asks in one statement over the rows composed once: those a keep keeps in the collection's order, a limit and an offset of them, how many each of several keeps, and each key's values; `page`, `counts` and `values` each ask one of them; `measures` each widget's figure, or its groups by an enumeration or a date's month, as SQL aggregates. `today` is the scope's day, `cella.verdict_date()`. The SQL is the slices'; the composition is this library's, so the shell writes none.

`src/import.ts` runs an import's records (`Imported`, as an `Importer`
reads them) as writes, in the file's order, as the importing member:
`importing(records, deps, dry)`. A dry run makes each write and rolls it
back where it would commit, since the notary takes one receipt for a
transaction, so each line is judged on the co-op as it stands. `csv(text)`
reads a CSV's records by its header's names, its separator the comma,
semicolon, tab or bar its header holds most of.
