-- How each action that writes the motion feat's schema applies to the
-- state before it (architecture.md, "Folds"), by the same SQL its handler
-- runs, with the day, the receipt and the values the entry carries; the
-- proposer's words, a title, a text and a message's body, as their
-- commitments.

-- The motion a write proposes, as `proposing` wrote it and its payload
-- names it: under the id, in the circle and as the author it names, by
-- its procedure, whose method it keeps, and its ballot, proposed on the
-- entry's day by the entry's actor, open until its deadline, its title
-- and its text as their commitments, its proposer their subject, and the
-- actions it decides in the order listed. Published for a slice whose
-- own write proposes a motion by `proposing`, as membership-motion's
-- application does, to fold from its entry.
CREATE FUNCTION motion.fold_proposal(n bigint, actor text, day date, p jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO motion.motion (id, circle, author, proposer, title, method, procedure, ballot, proposed, deadline, body)
  SELECT p ->> 'motion', p ->> 'circle', p ->> 'author', fold_proposal.actor,
         cella.commits('motion.motion.title', fold_proposal.actor, fold_proposal.n, p -> 'title'), x.method, x.id, p ->> 'ballot', fold_proposal.day,
         (p ->> 'deadline')::date, cella.commits('motion.motion.body', fold_proposal.actor, fold_proposal.n, p -> 'body')
  FROM motion.procedure x WHERE x.id = p ->> 'procedure';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'motion: entry % proposes % by %, which is no procedure', n, p ->> 'motion', coalesce(p ->> 'procedure', 'none');
  END IF;
  INSERT INTO motion.action (motion, n, kind, args)
  SELECT p ->> 'motion', a.i, a.x ->> 'kind', coalesce(a.x -> 'args', '{}')
  FROM jsonb_array_elements(coalesce(p -> 'actions', '[]')) WITH ORDINALITY AS a (x, i);
END
$$;

-- motion:motion:propose: the motion its entry proposes, by
-- `motion.fold_proposal`.
CREATE FUNCTION motion.fold_propose(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  SELECT motion.fold_proposal((fold_propose.entry ->> 'n')::bigint, fold_propose.entry ->> 'actor',
                              (fold_propose.entry ->> 'date')::date, fold_propose.entry -> 'payload');
END;

-- motion:message:post: the message, received at the entry's receipt on
-- its day, its text as its commitment, its member its subject; the table
-- generates its mentions and its links, a generated column the state
-- hash leaves out.
CREATE FUNCTION motion.fold_post(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO motion.message (receipt, motion, member, reply, body, at)
  VALUES ((p ->> 'message')::bigint, p ->> 'motion', p ->> 'member', (p ->> 'reply')::bigint,
          cella.commits('motion.message.body', p ->> 'member', (entry ->> 'n')::bigint, p -> 'body'), (entry ->> 'date')::date);
END
$$;

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

SELECT cella.lets_fold('motion:motion:propose', 1, 'motion.fold_propose(jsonb)', 'motion');
SELECT cella.lets_fold('motion:message:post', 1, 'motion.fold_post(jsonb)', 'motion');
SELECT cella.lets_fold('motion:motion:vote', 1, 'motion.fold_vote(jsonb)', 'motion');
SELECT cella.lets_fold('motion:motion:close', 1, 'motion.fold_close(jsonb)', 'motion');
SELECT cella.lets_fold('motion:policy:adopt', 1, 'motion.fold_adopt(jsonb)', 'motion');
SELECT cella.lets_fold('motion:policy:end', 1, 'motion.fold_end(jsonb)', 'motion');
