-- The notary at 0.6.0: a guard reads the id of the action being judged
-- through `cella.action()`. A database made before it is upgraded in place:
-- `cella.op()` is renamed `cella.action()` and rebound to the new library,
-- so every guard whose SQL body calls it keeps calling it.
ALTER EXTENSION cella UPDATE;
