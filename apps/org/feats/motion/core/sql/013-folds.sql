-- How the actions that write the motion feat's schema without its
-- proposer's words apply to the state before it (architecture.md,
-- "Folds"), by the same SQL their handlers run, with the day, the
-- receipt and the values the entry carries. A proposal and a message
-- keep their words out of the log, so neither folds yet.

-- motion:motion:vote: the stance, received at the entry's receipt on its
-- day, as its commitment where the ballot is secret.
CREATE FUNCTION motion.fold_vote(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO motion.vote (receipt, motion, member, stance, at)
  VALUES ((p ->> 'receipt')::bigint, p ->> 'motion', p ->> 'member',
          CASE WHEN jsonb_typeof(p -> 'stance') = 'object'
               THEN cella.commits('motion.vote.stance', p ->> 'member', (entry ->> 'n')::bigint, p -> 'stance')
               ELSE p ->> 'stance' END,
          (entry ->> 'date')::date);
END
$$;

-- motion:motion:close: the motion closed on the entry's day, its cutoff
-- the close's receipt, as the entry carries them.
CREATE FUNCTION motion.fold_close(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  UPDATE motion.motion SET closed = (entry ->> 'date')::date, cutoff = (p ->> 'cutoff')::bigint WHERE id = p ->> 'motion';
END
$$;

-- motion:policy:adopt: the policy the motion's action adopts, from the
-- day its entry says it applies, by `policy.adopt` on the action's terms
-- as the folded motion holds them, and the procedure it makes; one the
-- entry adopted none by adopts none, and a policy or a hash other than
-- the entry's refuses, naming both.
CREATE FUNCTION motion.fold_adopt(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  a jsonb;
  c text;
  made text;
  hashed text;
BEGIN
  IF nullif(p ->> 'policy', '') IS NULL THEN
    RETURN;
  END IF;
  SELECT m.args, d.circle INTO a, c FROM motion.action m JOIN motion.motion d ON d.id = m.motion
  WHERE m.motion = p ->> 'motion' AND m.n = (p ->> 'n')::integer AND m.kind = 'policy';
  made := policy.adopt(c, a ->> 'kind', a ->> 'wording', a ->> 'friendly', p ->> 'motion', (p ->> 'n')::integer,
                       (p ->> 'applies')::date, (a ->> 'until')::date, a ->> 'replaces', a ->> 'protected', nullif(a ->> 'takes', ''));
  PERFORM motion.procedure_from(made);
  SELECT encode(x.hash, 'hex') INTO hashed FROM policy.policy x WHERE x.id = made;
  IF made IS DISTINCT FROM p ->> 'policy' OR hashed IS DISTINCT FROM p ->> 'hash' THEN
    RAISE EXCEPTION 'motion: entry % adopts % hashed %, where the fold adopts % hashed %',
      entry ->> 'n', p ->> 'policy', p ->> 'hash', coalesce(made, 'none'), coalesce(hashed, 'none');
  END IF;
END
$$;

-- motion:policy:end: the policy its entry names ends by `policy.end`, as
-- its handler ends it; an end that ends none folds none, and a day other
-- than the entry's refuses.
CREATE FUNCTION motion.fold_end(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  ends date;
BEGIN
  IF nullif(p ->> 'policy', '') IS NULL THEN
    RETURN;
  END IF;
  ends := policy.end(p ->> 'policy', p ->> 'motion', (p ->> 'n')::integer);
  IF ends IS DISTINCT FROM (p ->> 'ends')::date THEN
    RAISE EXCEPTION 'motion: entry % ends % on %, where the fold ends it on %', entry ->> 'n', p ->> 'policy', p ->> 'ends', ends;
  END IF;
END
$$;

SELECT cella.lets_fold('motion:motion:vote', 1, 'motion.fold_vote(jsonb)', 'motion');
SELECT cella.lets_fold('motion:motion:close', 1, 'motion.fold_close(jsonb)', 'motion');
SELECT cella.lets_fold('motion:policy:adopt', 1, 'motion.fold_adopt(jsonb)', 'motion');
SELECT cella.lets_fold('motion:policy:end', 1, 'motion.fold_end(jsonb)', 'motion');
