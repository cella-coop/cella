-- Who reads: the person a connection reads for, and the row-level policies
-- every personal or sensitive table keeps on what they may see. The server
-- sets `cella.actor` from the session on each connection it hands out, and
-- `write` sets it again, with `cella.writing`, for its own transaction.

-- The person this transaction reads for, or null where no one is signed in.
CREATE FUNCTION cella.reader() RETURNS text
LANGUAGE sql STABLE
RETURN nullif(current_setting('cella.actor', true), '');

-- Whether this transaction is a write's. A write's state change sees the
-- whole of the state it changes, whoever asked for it: the notary judges
-- whether they may, and the state is the same whoever wrote it.
CREATE FUNCTION cella.writing() RETURNS boolean
LANGUAGE sql STABLE
RETURN coalesce(current_setting('cella.writing', true), '') = 'on';

-- The registries of who reads what, registered as literal rows: the
-- functions that say whether a member holds a power on a day, `(actor,
-- power, cents, about, day) → boolean`, over a record of the circle
-- `about` or, null, of none, and which owning circles their mandates for
-- a power cover on a day, `(actor, power, day) → text[]`, a feat's; the powers that read a feat's
-- rows, `key` narrowing one to the rows the feat passes it, such as a
-- file's class; and the functions a graft registers to open a feat's rows
-- it joins to more readers, `(key, reader) → boolean`. Each is called by
-- the schema and name its function has, its arguments cast to the types
-- it was registered with, so a function overloaded under its name runs
-- the overload registered.
CREATE TABLE cella.authority (
  one boolean PRIMARY KEY DEFAULT true CHECK (one),
  fn regprocedure NOT NULL,
  covered regprocedure NOT NULL,
  owner text NOT NULL
);

CREATE TABLE cella.reading (
  what text NOT NULL,
  key text,
  power text NOT NULL,
  owner text NOT NULL,
  UNIQUE NULLS NOT DISTINCT (what, key, power)
);

CREATE TABLE cella.reach (
  what text NOT NULL,
  fn regprocedure NOT NULL,
  owner text NOT NULL,
  PRIMARY KEY (what, fn)
);

GRANT SELECT ON cella.authority, cella.reading, cella.reach TO PUBLIC;

-- Whether the reader holds a power on the verdict date, as the authority
-- says; no one does where none is registered. It runs as its owner, so
-- the authority reads the seats and the members past the row-level
-- policies that ask it, as `covered` does.
CREATE FUNCTION cella.may(power text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  call text;
  ok boolean;
BEGIN
  SELECT format('SELECT %I.%I($1::%s, $2::%s, NULL::%s, NULL::%s, $3::%s)', n.nspname, p.proname,
           p.proargtypes[0]::regtype, p.proargtypes[1]::regtype, p.proargtypes[2]::regtype, p.proargtypes[3]::regtype, p.proargtypes[4]::regtype)
  INTO call
  FROM cella.authority a
  JOIN pg_catalog.pg_proc p ON p.oid = a.fn
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace;
  IF call IS NULL OR power IS NULL OR cella.reader() IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE call INTO ok USING cella.reader(), may.power, cella.verdict_date();
  RETURN coalesce(ok, false);
END
$$;

-- The owning circles whose records the reader's mandates for a power
-- cover on the verdict date, as the authority says; none where no
-- authority is registered or no one reads.
CREATE FUNCTION cella.covered(power text) RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  call text;
  got text[];
BEGIN
  SELECT format('SELECT %I.%I($1::%s, $2::%s, $3::%s)', n.nspname, p.proname,
           p.proargtypes[0]::regtype, p.proargtypes[1]::regtype, p.proargtypes[2]::regtype)
  INTO call
  FROM cella.authority a
  JOIN pg_catalog.pg_proc p ON p.oid = a.covered
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace;
  IF call IS NULL OR power IS NULL OR cella.reader() IS NULL THEN
    RETURN '{}';
  END IF;
  EXECUTE call INTO got USING cella.reader(), covered.power, cella.verdict_date();
  RETURN coalesce(got, '{}');
END
$$;

-- The owning circles whose rows of `what` the reader reads by a power
-- its feat names as reading them, each by its mandates' scope. It does
-- not depend on the row, so a policy asks it once per query, as
-- `circle = ANY ((SELECT cella.circles(what))::text[])`.
CREATE FUNCTION cella.circles(what text) RETURNS text[]
LANGUAGE sql STABLE
RETURN ARRAY(
  SELECT DISTINCT c
  FROM cella.reading g, unnest(cella.covered(g.power)) c
  WHERE g.what = circles.what AND g.key IS NULL
  ORDER BY c
);

-- Whether the reader sees every row of `what`: this is a write's
-- transaction, or the role reading reads past row-level security (a
-- superuser's tools and tests, or a function running as its owner to sum
-- the whole). The server reads as `cella_app` whatever it logs in as.
-- It does not depend on the row, so a policy asks it once per query, as
-- `(SELECT cella.sees(what))`; a view that filters its rows by reader
-- asks it the same way. Anyone else reads the rows of the circles they
-- read in, `cella.circles`.
CREATE FUNCTION cella.sees(what text) RETURNS boolean
LANGUAGE sql STABLE
RETURN cella.writing()
  OR (SELECT r.rolsuper OR r.rolbypassrls FROM pg_catalog.pg_roles r WHERE r.rolname = current_user);

-- Whether the reader reaches one row of `what` beyond their own, by the
-- key its feat passes: a power that reads rows of that key, or a graft's
-- function that opens the row to them.
CREATE FUNCTION cella.reaches(what text, key text) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  call text;
  ok boolean;
BEGIN
  IF cella.reader() IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT FROM cella.reading g WHERE g.what = reaches.what AND g.key = reaches.key AND cella.may(g.power)) THEN
    RETURN true;
  END IF;
  FOR call IN
    SELECT format('SELECT %I.%I($1::%s, $2::%s)', n.nspname, p.proname, p.proargtypes[0]::regtype, p.proargtypes[1]::regtype)
    FROM cella.reach x
    JOIN pg_catalog.pg_proc p ON p.oid = x.fn
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE x.what = reaches.what
    ORDER BY x.owner
  LOOP
    EXECUTE call INTO ok USING reaches.key, cella.reader();
    IF ok THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END
$$;

-- The log's form, the payload with commitments in place of personal
-- values, is the owner's: every other column stays everyone's.
REVOKE SELECT ON cella.log FROM PUBLIC;
GRANT SELECT (n, op, actor, date, payload, receipt, guards, prev, hash, sig, cause, cause_hash, settled) ON cella.log TO PUBLIC;

-- An entry's payload, its commitments opened, for the reader who may read
-- it: who wrote it, the person every commitment in it is about, or a holder
-- of the power its op needs; null for anyone else. The app's only way to
-- the vault.
CREATE FUNCTION cella.disclosed(n bigint) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  e record;
BEGIN
  -- An effect has no receipt: its commitments are its decision's, the
  -- last entry before it with one, since a write's entries are consecutive.
  SELECT l.op, l.actor,
         coalesce(l.receipt, (SELECT d.receipt FROM cella.log d WHERE d.n < l.n AND d.receipt IS NOT NULL ORDER BY d.n DESC LIMIT 1)) AS receipt
  INTO e FROM cella.log l WHERE l.n = disclosed.n;
  IF NOT FOUND OR cella.reader() IS NULL THEN
    RETURN NULL;
  END IF;
  IF e.actor = cella.reader()
    OR NOT EXISTS (SELECT FROM vault.secret s WHERE s.receipt = e.receipt AND s.subject <> cella.reader())
    OR cella.may((SELECT p.power FROM cella.power p WHERE p.op = e.op)) THEN
    RETURN cella.opened(disclosed.n);
  END IF;
  RETURN NULL;
END
$$;

REVOKE EXECUTE ON FUNCTION cella.opened(bigint) FROM cella_app;
REVOKE EXECUTE ON FUNCTION cella.disclosed(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cella.disclosed(bigint) TO cella_app;
