\set ON_ERROR_STOP 0
DROP EXTENSION IF EXISTS cella CASCADE;
DROP TABLE IF EXISTS t;
CREATE EXTENSION cella;
\dx cella
-- operators live in schema cella: unqualified + needs cella on the search_path
SELECT '12.50'::cella.amount + '0.75'::cella.amount AS sum;
SELECT '12.50'::cella.amount OPERATOR(cella.+) '0.75'::cella.amount AS qualified_sum;
SET search_path = public, cella;
SELECT '12.50'::cella.amount + '0.75'::cella.amount AS sum;
SELECT '3'::cella.amount < '3.01'::cella.amount AS lt, '3'::cella.amount = '3.00'::cella.amount AS eq;
SELECT 1250::bigint::cella.amount AS from_cents, cella.cents('9.99') AS cents;
SELECT '0'::cella.amount;
SELECT '-5.00'::cella.amount;
SELECT cella.amount(-1);
SELECT '1.234'::cella.amount;
-- an amount column, sorted and indexed via the btree opclass; balances are signed numerics
CREATE TABLE t (id int, side text, amt cella.amount NOT NULL);
CREATE INDEX ON t (amt);
INSERT INTO t VALUES (1,'credit','100.00'),(2,'debit','30.25'),(3,'debit','70.00'),(4,'credit','0.50');
SELECT array_agg(amt ORDER BY amt) AS sorted,
       sum(CASE side WHEN 'credit' THEN amt::numeric ELSE -amt::numeric END) AS balance FROM t;
INSERT INTO t VALUES (5,'debit','0.00');
SELECT pg_column_size('12.50'::cella.amount) AS bytes_amount, pg_column_size(1250::bigint) AS bytes_bigint;
