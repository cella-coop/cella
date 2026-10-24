-- One schema per feat and per graft; the app role owns none of the log.
\set ON_ERROR_STOP 1
DROP SCHEMA IF EXISTS member, decision, invoice, client, decision_member, client_invoice CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app LOGIN;
  END IF;
END $$;
CREATE SCHEMA member;
CREATE TABLE member.member (address text PRIMARY KEY, status text NOT NULL);
CREATE SCHEMA decision;
CREATE TABLE decision.decision (id text PRIMARY KEY, circle text NOT NULL, rule text NOT NULL);
CREATE TABLE decision.vote (
  decision text NOT NULL REFERENCES decision.decision, member text NOT NULL,
  stance text NOT NULL, at date NOT NULL);
CREATE SCHEMA invoice;
CREATE TABLE invoice.invoice (id text PRIMARY KEY, total cella.amount NOT NULL, status text NOT NULL);
CREATE SCHEMA client;
CREATE TABLE client.client (id text PRIMARY KEY, name text NOT NULL);
-- grafts hold the junctions; no foreign key crosses a feat
CREATE SCHEMA client_invoice;
CREATE TABLE client_invoice.billed (client text NOT NULL, invoice text NOT NULL, PRIMARY KEY (client, invoice));
CREATE SCHEMA decision_member;
GRANT USAGE ON SCHEMA member, decision, invoice, client, client_invoice, decision_member, cella TO app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA member, decision, invoice, client, client_invoice TO app;
GRANT SELECT ON cella.log TO app;
