-- A document generated from a circle's policies, as the statutes are from
-- the root circle's: the circle, by id as the policy register names it,
-- and the template, the fixed text of the co-op's legal form as a JSON
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

-- document:document:generate — the document is generated; the cited
-- motion adopted a policy of its circle applying on the write's day, or
-- ended one that day; and the version reads, each as a line as it reads,
-- every policy of the circle in force that day, and no other of its
-- policies but one reading as one in force does. A guard reads no
-- wording: it compares the sentences `policy.says` quotes.
CREATE FUNCTION document.generates(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN g.document IS NULL THEN coalesce(p.document, 'the document') || ' is not generated from policies'
    WHEN NOT EXISTS (
      SELECT FROM policy.policy c
      WHERE c.circle = g.circle
        AND ((c.motion = p.motion AND c.applies = p.day) OR (split_part(c.ended_by, '/', 1) = p.motion AND c.ends = p.day))
    ) THEN coalesce(p.motion, 'no motion') || ' adopts or ends no policy of ' || g.circle || ' on ' || coalesce(p.day::text, 'no day')
    WHEN v.id IS NULL THEN p.document || ' has no version ' || coalesce(p.version, 'named')
    ELSE coalesce(
      (SELECT v.id || ' does not read ' || f.id FROM policy.in_force(g.circle, p.day) f
       WHERE NOT policy.says(f.id) = ANY (string_to_array(v.plain, E'\n'))
       ORDER BY f.id LIMIT 1),
      (SELECT v.id || ' reads ' || c.id || ', not in force on ' || p.day FROM policy.policy c
       WHERE c.circle = g.circle
         AND c.id NOT IN (SELECT f.id FROM policy.in_force(g.circle, p.day) f)
         AND policy.says(c.id) = ANY (string_to_array(v.plain, E'\n'))
         AND policy.says(c.id) NOT IN (SELECT policy.says(f.id) FROM policy.in_force(g.circle, p.day) f)
       ORDER BY c.id LIMIT 1)
    )
  END
  FROM (SELECT payload ->> 'document' AS document, payload ->> 'version' AS version, payload ->> 'motion' AS motion,
               (payload ->> 'day')::date AS day) p
  LEFT JOIN document.generated g ON g.document = p.document
  LEFT JOIN document.version v ON v.id = p.version AND v.document = p.document;
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

GRANT SELECT ON document.generated TO cella_app, cella_guards;
