+++
title = "Db"
updated = 2026-10-24
+++

The shape every write handler takes (`@cella/org-db`). `write` runs one write in one transaction: the handler's state change, then its deferred constraint triggers made immediate (`SET CONSTRAINTS ALL IMMEDIATE`, so an unbalanced entry refuses before the verdict, not at commit), then `cella.submit` last, then commit. A refusal, SQLSTATE `09000` from a rule or a feat's trigger, rolls the transaction back and returns `Refused`, numbered by the last verdict it was judged after; any other error rolls back and is thrown. Every write takes this path, whatever its label: until rung 2 a confluent or bounded write still meets the server's rules and triggers, so it too may return `Refused` (`Outcome` in `@cella/org-ops`); only an ordered write may also be `Pending`.

`Db` is the one method a handler needs of a connection, which a `pg` client fits; `Deps` carries it and the authenticated actor.
