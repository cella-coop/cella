CREATE SCHEMA account_decision;

-- The decision of the members that approves a surplus allocation's split.
-- Both sides are referenced by id, with no foreign key into either feat.
CREATE TABLE account_decision.approval (
  allocation text PRIMARY KEY,
  decision text NOT NULL
);

-- account:surplus:allocate — the cited decision is the one that approves
-- this allocation. That it closed and passed on its roll is
-- circle-decision-member's rule, attached through decision.cites.
CREATE FUNCTION account_decision.approves(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE
    WHEN d.id IS NULL THEN 'no decision ' || coalesce(p.decision, 'is cited')
    WHEN a.decision IS DISTINCT FROM d.id THEN d.id || ' does not approve ' || coalesce(p.allocation, 'an allocation')
  END
  FROM (SELECT payload ->> 'decision' AS decision, payload ->> 'allocation' AS allocation) p
  LEFT JOIN decision.decision d ON d.id = p.decision
  LEFT JOIN account_decision.approval a ON a.allocation = p.allocation;
END;

INSERT INTO cella.rule (op, fn, owner) VALUES ('account:surplus:allocate', 'account_decision.approves(jsonb)', 'account-decision');
INSERT INTO decision.cites (op, owner) VALUES ('account:surplus:allocate', 'account-decision');

GRANT USAGE ON SCHEMA account_decision TO cella_app, cella_rules;
GRANT SELECT, INSERT ON account_decision.approval TO cella_app;
GRANT SELECT ON account_decision.approval TO cella_rules;
