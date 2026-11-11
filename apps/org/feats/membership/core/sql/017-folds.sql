-- How each action that writes the membership feat's schema applies to
-- the state before it (architecture.md, "Folds"), by the same SQL its
-- handler runs, with the day and the values its entry carries, so the
-- triggers its handler's writes fire fire again.

-- membership:member:invite: the invited member from the entry's day, and
-- the link it carries, made that day.
CREATE FUNCTION membership.fold_invite(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO membership.member (address, status, invited) VALUES (p ->> 'member', 'invited', (entry ->> 'date')::date);
  IF p -> 'link' IS NOT NULL THEN
    INSERT INTO membership.link (digest, member, made) VALUES (decode(p ->> 'link', 'hex'), p ->> 'member', (entry ->> 'date')::date);
  END IF;
END
$$;

-- membership:member:apply: the applicant, invited and applied on the
-- entry's day, or one invited already who had not applied, applied then.
CREATE FUNCTION membership.fold_apply(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  on_day date := (entry ->> 'date')::date;
BEGIN
  INSERT INTO membership.member (address, status, invited, applied) VALUES (p ->> 'member', 'invited', on_day, on_day)
  ON CONFLICT (address) DO UPDATE SET applied = on_day
  WHERE membership.member.status = 'invited' AND membership.member.applied IS NULL;
END
$$;

-- membership:member:link: the link its entry carries, made that day.
CREATE FUNCTION membership.fold_link(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO membership.link (digest, member, made) VALUES (decode(p ->> 'link', 'hex'), p ->> 'member', (entry ->> 'date')::date);
END
$$;

-- membership:member:accept: the invitation taken up on the entry's day,
-- by the device key it carries, its label as its commitment.
CREATE FUNCTION membership.fold_accept(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  INSERT INTO membership.invitation (member, key, label, accepted)
  VALUES (p ->> 'member', decode(p ->> 'key', 'hex'), cella.commits('membership.invitation.label', p ->> 'member', (entry ->> 'n')::bigint, p -> 'label'),
          (entry ->> 'date')::date);
END
$$;

-- membership:member:admit: an invited member admitted on the entry's
-- day with the shares it names.
CREATE FUNCTION membership.fold_admit(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
BEGIN
  UPDATE membership.member SET status = 'active', since = (entry ->> 'date')::date, shares = (p ->> 'shares')::integer
  WHERE address = p ->> 'member' AND status = 'invited';
END
$$;

-- membership:member:suspend, exclude and withdraw: the member suspended,
-- or exited as excluded or withdrawn, on the entry's day, unless they
-- stand so already.
CREATE FUNCTION membership.fold_ending(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  on_day date := (entry ->> 'date')::date;
BEGIN
  IF entry ->> 'op' = 'membership:member:suspend' THEN
    UPDATE membership.member SET status = 'suspended', suspended = on_day, exit = NULL
    WHERE address = p ->> 'member' AND status <> 'suspended';
  ELSE
    UPDATE membership.member SET status = 'exited', exited = on_day,
      exit = CASE entry ->> 'op' WHEN 'membership:member:exclude' THEN 'excluded' ELSE 'withdrew' END
    WHERE address = p ->> 'member' AND status <> 'exited';
  END IF;
END
$$;

-- membership:member:erase changes no row of its own: its erasure folds
-- as the notary carried it out (`cella.fold_erasures`).
CREATE FUNCTION membership.fold_erase(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  NULL;
END
$$;

-- What `crediting` wrote, in the write of an extender that credits
-- shares, as account-membership-patronage-transaction's employing a
-- part of the work share does: what the member holds once it credits
-- them, the register's figure the entry keeps, while they are active, as
-- its handler credits them, since the shares it credits are theirs and
-- logged as their commitment.
CREATE FUNCTION membership.fold_credit(member text, holds integer) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  UPDATE membership.member SET shares = fold_credit.holds
  WHERE address = fold_credit.member AND membership.active(address, cella.verdict_date());
END;

SELECT cella.lets_fold('membership:member:invite', 1, 'membership.fold_invite(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:apply', 1, 'membership.fold_apply(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:link', 1, 'membership.fold_link(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:accept', 1, 'membership.fold_accept(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:admit', 1, 'membership.fold_admit(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:suspend', 1, 'membership.fold_ending(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:exclude', 1, 'membership.fold_ending(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:withdraw', 1, 'membership.fold_ending(jsonb)', 'membership');
SELECT cella.lets_fold('membership:member:erase', 1, 'membership.fold_erase(jsonb)', 'membership');
