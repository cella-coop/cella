-- Rules read the members; they write nothing.
GRANT USAGE ON SCHEMA membership TO cella_rules;
GRANT SELECT ON ALL TABLES IN SCHEMA membership TO cella_rules;
