-- cella 0.2.0 to 0.3.0: each receipt keeps the salt of the request its
-- member signed, so `cella.signed(n, request)` can say later whether a
-- request is what they signed; the salt is the owner's, as anyone else
-- could confirm a guess of a request with it. `ALTER EXTENSION cella
-- UPDATE` runs it, with the 0.3.0 library loaded; a receipt taken before
-- it keeps no salt, and `signed` answers NULL for it.

ALTER TABLE cella.receipt ADD COLUMN salt text;
REVOKE SELECT ON cella.receipt FROM PUBLIC;
GRANT SELECT (n, op, actor, device, nonce, request, signature, payload, at, hash, sig, key) ON cella.receipt TO PUBLIC;

CREATE FUNCTION cella."signed"(
	"n" bigint /* i64 */,
	"request" jsonb /* JsonB */
) RETURNS bool /* Option < bool > */
STRICT STABLE SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
LANGUAGE c /* Rust */
AS 'MODULE_PATHNAME', 'signed_wrapper';
REVOKE EXECUTE ON FUNCTION cella.signed(bigint, jsonb) FROM PUBLIC;
