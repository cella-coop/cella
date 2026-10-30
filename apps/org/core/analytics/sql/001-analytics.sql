-- The analytics port's schema: what the analytics shell reads beside the
-- slices' contracts, the log's head each run is stamped with. Its one
-- view is published by `sql/analytics.sql`, which `cella migrate` grants
-- to cella_analytics with the slices' views; nothing here grants it.
CREATE SCHEMA analytics;
