-- How a policy's adoption and end apply to the circles before them
-- (architecture.md, "Folds"): a function of the entry alone, which takes
-- its ids from the entry, runs the same SQL as its handler, through the
-- circles' writes, and refuses a result that is not what the entry says.

-- The mandate, the right or the disclosure values its entry's policy
-- grants or revokes, by the SQL its handler runs, `circle_policy.mandate_from`
-- or `circle_policy.mandate_ended`, on the policy register as the entry's own
-- slice folded it, with the mandate's id the entry's; a mandate or a
-- revocation other than the entry's refuses.
CREATE FUNCTION circle_policy.folded_grant(entry jsonb, made bigint, gone bigint[]) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  said bigint[] := ARRAY(SELECT r::bigint FROM jsonb_array_elements_text(coalesce(p -> 'revoked', '[]')) r);
BEGIN
  IF made IS DISTINCT FROM (p ->> 'mandate')::bigint OR coalesce(gone, '{}') <> said THEN
    RAISE EXCEPTION 'circle-policy: entry % says mandate % revoking %, where the fold gives mandate % revoking %',
      entry ->> 'n', coalesce(p ->> 'mandate', 'none'), said, coalesce(made::text, 'none'), coalesce(gone, '{}');
  END IF;
END
$$;

CREATE FUNCTION circle_policy.fold_granting(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  r record;
BEGIN
  IF nullif(p ->> 'policy', '') IS NULL THEN
    RETURN;
  END IF;
  IF p ->> 'mandate' IS NOT NULL THEN
    PERFORM circle.pin_mandate((p ->> 'mandate')::bigint);
  END IF;
  SELECT * INTO r FROM circle_policy.mandate_from(p ->> 'policy');
  PERFORM circle_policy.folded_grant(entry, r.mandate, r.revoked);
END
$$;

CREATE FUNCTION circle_policy.fold_revoking(entry jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  p jsonb := entry -> 'payload';
  r record;
BEGIN
  IF nullif(p ->> 'policy', '') IS NULL THEN
    RETURN;
  END IF;
  SELECT * INTO r FROM circle_policy.mandate_ended(p ->> 'policy');
  PERFORM circle_policy.folded_grant(entry, r.mandate, r.revoked);
END
$$;

SELECT cella.lets_fold('motion:policy:adopt', 1, 'circle_policy.fold_granting(jsonb)', 'circle-policy');
SELECT cella.lets_fold('motion:policy:end', 1, 'circle_policy.fold_revoking(jsonb)', 'circle-policy');
