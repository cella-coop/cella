-- The work share's terms are a rule the members adopt by motion, its
-- values named for this feat, each a share in percent: the weights by
-- pay, by time worked and in equal parts, the part of an associate's part
-- employed in shares, and the highest rate of interest on capital. They
-- are copied into `patronage.terms` as it is adopted, from the fiscal year
-- it applies in; the register is org's core's, read here by its values,
-- never its wording.

-- The values a work share rule marks, typed, from its values by name as
-- written (`{"patronage_salary": "60 %"}`): each a percent, or null where
-- one is not a share.
CREATE FUNCTION patronage.work(marked jsonb) RETURNS TABLE (
  salary numeric, hours numeric, equal numeric, capital numeric, interest numeric
)
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT
    (SELECT (t.value #>> '{}')::numeric FROM policy.typed('patronage_salary', marked ->> 'patronage_salary') t WHERE t.type = 'share'),
    (SELECT (t.value #>> '{}')::numeric FROM policy.typed('patronage_hours', marked ->> 'patronage_hours') t WHERE t.type = 'share'),
    (SELECT (t.value #>> '{}')::numeric FROM policy.typed('patronage_equal', marked ->> 'patronage_equal') t WHERE t.type = 'share'),
    (SELECT (t.value #>> '{}')::numeric FROM policy.typed('patronage_capital', marked ->> 'patronage_capital') t WHERE t.type = 'share'),
    (SELECT (t.value #>> '{}')::numeric FROM policy.typed('patronage_interest', marked ->> 'patronage_interest') t WHERE t.type = 'share');
END;

-- Whether a rule's values, by name, are this feat's to read: it marks a
-- value named `patronage_…`.
CREATE FUNCTION patronage.reads(marked jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE
RETURN EXISTS (SELECT FROM jsonb_object_keys(coalesce(marked, '{}')) k WHERE k LIKE 'patronage\_%');

-- What is wrong with the terms a rule's values would make, by name as
-- written, or null: it marks the five shares, each a percent of at most
-- all, and no other value of this feat's; and its weights divide the
-- whole work share.
CREATE FUNCTION patronage.terms_flaw(marked jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN x.other IS NOT NULL THEN 'the work share''s terms mark patronage_salary, patronage_hours, patronage_equal, patronage_capital and patronage_interest, not ' || x.other
    WHEN x.missing IS NOT NULL THEN 'the work share''s terms mark ' || x.missing || ' too'
    WHEN x.wrong IS NOT NULL THEN x.wrong || ' is a share of at most all, as 50 %, not ' || (marked ->> x.wrong)
    WHEN w.salary + w.hours + w.equal <> 100
      THEN 'the work share''s terms divide ' || (w.salary + w.hours + w.equal) || ' % of the work share, not 100 %'
  END
  FROM patronage.work(marked) w,
  LATERAL (
    SELECT (SELECT k FROM jsonb_object_keys(coalesce(marked, '{}')) k
            WHERE k LIKE 'patronage\_%' AND k NOT IN ('patronage_salary', 'patronage_hours', 'patronage_equal', 'patronage_capital', 'patronage_interest')
            ORDER BY k LIMIT 1) AS other,
           (SELECT k FROM unnest(ARRAY['patronage_salary', 'patronage_hours', 'patronage_equal', 'patronage_capital', 'patronage_interest']) k
            WHERE NOT coalesce(marked, '{}') ? k LIMIT 1) AS missing,
           (SELECT k FROM unnest(ARRAY['patronage_salary', 'patronage_hours', 'patronage_equal', 'patronage_capital', 'patronage_interest'],
                                 ARRAY[w.salary, w.hours, w.equal, w.capital, w.interest]) AS s(k, v)
            WHERE s.v IS NULL OR s.v > 100 LIMIT 1) AS wrong
  ) x;
END;

-- A rule's values in the register, by name as written.
CREATE FUNCTION patronage.marked_by(ref text) RETURNS jsonb
LANGUAGE sql STABLE
RETURN (SELECT jsonb_object_agg(v.name, v.literal) FROM policy.value v WHERE v.policy = ref);

-- Copies a work share rule's values into the terms they make, in the
-- write that adopts them, from the fiscal year the rule applies in,
-- adopted the day it was.
-- Returns the terms, or null for a policy that is no rule of this feat's;
-- a rule copied already, or values that make no terms, are refused
-- (SQLSTATE 09000).
CREATE FUNCTION patronage.terms_from(ref text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  marked jsonb := patronage.marked_by(ref);
  wrong text;
  made text;
BEGIN
  IF NOT EXISTS (SELECT FROM policy.policy p WHERE p.id = ref AND p.kind = 'rule') OR NOT patronage.reads(marked) THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT FROM patronage.terms t WHERE t.policy = ref) THEN
    RAISE EXCEPTION '% are copied into terms already', ref USING ERRCODE = 'triggered_action_exception';
  END IF;
  wrong := patronage.terms_flaw(marked);
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION '%', wrong USING ERRCODE = 'triggered_action_exception';
  END IF;
  INSERT INTO patronage.terms (id, policy, "from", salary, hours, equal, capital, interest, adopted)
  SELECT replace(p.id, '/', '-'), p.id, extract(year FROM p.applies)::integer, w.salary, w.hours, w.equal, w.capital, w.interest,
         p.adopted
  FROM policy.policy p, patronage.work(marked) w
  WHERE p.id = ref
  RETURNING id INTO made;
  RETURN made;
END
$$;

-- patronage:terms:adopt — the terms the write copied are what the rule
-- they copy marks, from the fiscal year it applies in.
CREATE FUNCTION patronage.copies(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT t.id || ' are not what ' || t.policy || ' marks'
  FROM patronage.terms t
  WHERE t.policy = payload ->> 'policy' AND NOT EXISTS (
    SELECT FROM policy.policy p, patronage.work(patronage.marked_by(p.id)) w
    WHERE p.id = t.policy AND p.kind = 'rule' AND extract(year FROM p.applies) = t."from"
      AND (w.salary, w.hours, w.equal, w.capital, w.interest) = (t.salary, t.hours, t.equal, t.capital, t.interest)
  );
END;

INSERT INTO cella.guard (op, fn, owner) VALUES ('patronage:terms:adopt', 'patronage.copies(jsonb)', 'patronage');
