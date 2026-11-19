-- A document generated from a circle's policies, as the statutes are from
-- the root circle's: the circle, by id as the policy register names it,
-- and the template, the fixed text of the coop's legal form as a JSON
-- array of fragments, an `embed` block of kind `policies` standing where
-- the policies read. It changes only as its circle's policies do, by
-- `document:document:generate`, and never by hand.
CREATE TABLE document.generated (
  document text PRIMARY KEY REFERENCES document.document,
  circle text NOT NULL REFERENCES circle.circle,
  template jsonb NOT NULL CHECK (jsonb_typeof(template) = 'array')
);

CREATE TRIGGER permanent BEFORE UPDATE OR DELETE ON document.generated
  FOR EACH ROW EXECUTE FUNCTION document.permanent();

-- What each generated version cites and reads: the motion whose adoption
-- or ending of a policy it follows, and the day whose policies it reads.
-- A version `generate` makes cites one motion; one the seed carries over
-- cites each motion whose change it first reads, on the one day it reads.
-- A motion is cited by versions in a row: `document.generates` refuses one
-- an earlier version cites unless the adopted one cites it too, so a
-- motion's several changes each generate a version, however many, and
-- none is cited again once a later motion's version is adopted.
CREATE TABLE document.generation (
  circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle,
  document text NOT NULL REFERENCES document.generated,
  version text NOT NULL REFERENCES document.version,
  motion text NOT NULL,
  day date NOT NULL,
  PRIMARY KEY (version, motion)
);

CREATE INDEX ON document.generation (document, motion);

CREATE TRIGGER permanent BEFORE UPDATE OR DELETE ON document.generation
  FOR EACH ROW EXECUTE FUNCTION document.permanent();
CREATE TRIGGER in_its_circle BEFORE INSERT ON document.generation
  FOR EACH ROW EXECUTE FUNCTION document.in_its_circle();

-- The day a generation from `base`, the adopted version it replaces,
-- reads for a motion whose change applies on `day`: the later of that day
-- and the day `base` reads, so a generation never goes back. `generate`
-- reads by it and `document.generates` judges by it.
CREATE FUNCTION document.reads(base text, day date) RETURNS date
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT greatest(reads.day, (SELECT max(g.day) FROM document.generation g WHERE g.version = reads.base));
END;

-- document:document:generate — the document is generated; no version of
-- it cites the motion unless the adopted one, the base, does; the motion adopted
-- a policy of its circle applying on the write's day, or ended one that
-- day; the version reads the day `document.reads` gives from the base,
-- never an earlier one; and it reads, each as a line as it reads, every
-- policy of the circle in force that day, and no other of its policies
-- but one reading as one in force does. A guard reads no wording: it
-- compares the sentences `circle_policy.says` quotes.
CREATE FUNCTION document.generates(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN g.document IS NULL THEN coalesce(p.document, 'the document') || ' is not generated from policies'
    WHEN cited.version IS NOT NULL
      THEN cited.version || ' cites ' || p.motion || ', and ' || coalesce(p.base, 'a later version') || ' is adopted since: a generation cites a motion that changed the policies after it'
    WHEN NOT EXISTS (
      SELECT FROM policy.policy c
      WHERE c.circle = g.circle
        AND ((c.motion = p.motion AND c.applies = p.day) OR (split_part(c.ended_by, '/', 1) = p.motion AND c.ends = p.day))
    ) THEN coalesce(p.motion, 'no motion') || ' adopts or ends no policy of ' || g.circle || ' on ' || coalesce(p.day::text, 'no day')
    WHEN v.id IS NULL THEN p.document || ' has no version ' || coalesce(p.version, 'named')
    WHEN r.day IS NULL THEN v.id || ' cites no motion: a generated version cites ' || p.motion || ' and the day it reads'
    WHEN r.day < d.reads
      THEN v.id || ' reads ' || r.day || ', earlier than ' || d.reads || ', the day ' || p.base || ' reads: a generation never goes back'
    WHEN r.day > d.reads
      THEN v.id || ' reads ' || r.day || ', not ' || d.reads || ', the later of ' || p.day || ' and the day ' || coalesce(p.base, 'no version') || ' reads'
    ELSE coalesce(
      (SELECT v.id || ' does not read ' || f.id FROM policy.in_force(g.circle, d.reads) f
       WHERE NOT circle_policy.says(f.id) = ANY (string_to_array(v.plain, E'\n'))
       ORDER BY f.id LIMIT 1),
      (SELECT v.id || ' reads ' || c.id || ', not in force on ' || d.reads FROM policy.policy c
       WHERE c.circle = g.circle
         AND c.id NOT IN (SELECT f.id FROM policy.in_force(g.circle, d.reads) f)
         AND circle_policy.says(c.id) = ANY (string_to_array(v.plain, E'\n'))
         AND circle_policy.says(c.id) NOT IN (SELECT circle_policy.says(f.id) FROM policy.in_force(g.circle, d.reads) f)
       ORDER BY c.id LIMIT 1)
    )
  END
  FROM (SELECT payload ->> 'document' AS document, payload ->> 'version' AS version, payload ->> 'base' AS base,
               payload ->> 'motion' AS motion, (payload ->> 'day')::date AS day) p
  CROSS JOIN LATERAL (SELECT document.reads(p.base, p.day) AS reads) d
  LEFT JOIN document.generated g ON g.document = p.document
  LEFT JOIN document.version v ON v.id = p.version AND v.document = p.document
  LEFT JOIN document.generation r ON r.document = p.document AND r.version = p.version AND r.motion = p.motion
  LEFT JOIN LATERAL (
    SELECT c.version FROM document.generation c
    WHERE c.document = p.document AND c.motion = p.motion AND c.version IS DISTINCT FROM p.version AND c.version IS DISTINCT FROM p.base
      AND NOT EXISTS (SELECT FROM document.generation b WHERE b.version = p.base AND b.motion = p.motion)
    ORDER BY (SELECT cv.n FROM document.version cv WHERE cv.id = c.version) DESC
    LIMIT 1
  ) cited ON true;
END;

-- document:document:edit, :version and :adopt — a generated document
-- changes only as its circle's policies do, by generate, never by hand.
CREATE FUNCTION document.handmade(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT g.document || ' is generated from the policies of ' || g.circle || ': it changes only as they do'
  FROM document.generated g WHERE g.document = payload ->> 'document';
END;

INSERT INTO cella.guard (op, fn, owner) VALUES
  ('document:document:generate', 'document.adopts(jsonb)', 'document'),
  ('document:document:generate', 'document.generates(jsonb)', 'document'),
  ('document:document:edit', 'document.handmade(jsonb)', 'document'),
  ('document:document:version', 'document.handmade(jsonb)', 'document'),
  ('document:document:adopt', 'document.handmade(jsonb)', 'document');

GRANT SELECT ON document.generated, document.generation TO cella_app, cella_guards;
GRANT INSERT ON document.generation TO cella_app;
