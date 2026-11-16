# The NixOS tests of services.cella, each a VM booted with test keys that
# a unit makes by `cella key init` before Postgres starts, as a host's
# operator makes its keys once, by hand; never a real scope's.
#
# - `scope`: a co-op's scope. It migrates and serves a sign-in offering no
#   one; Lanterne is founded in it, the log's first write, and a member
#   signs in with their TEST-ONLY device and signs a write of their own;
#   the nightly backup is taken and restored into a database of its own,
#   whose log verifies at the same head.
# - `demo`: a demo scope. Its template is built at the unit's first start,
#   and the scope serves a copy of it: its sign-in offers Lanterne's
#   members, each marked as a demo member, under the demo's banner, and
#   one signs in and signs a write. The template built again from nothing
#   holds the same log, and both verify.
# - `visitors`: a demo serving each visitor a copy of their own through
#   its front. A request with no cookie makes none; two visitors get two
#   copies, and one's write reaches neither the other's nor the template;
#   a copy's role reaches its own database alone; Reset now drops a copy
#   for a fresh one; at the cap the idlest ends; one address is refused
#   past its rate; an idle copy ends leaving no database, role, server or
#   socket; and a front killed outright has its copies ended by the next.
{ self, pkgs, kind }:
let
  keys = "/var/lib/cella-keys";
  cella = "${self.packages.${pkgs.stdenv.hostPlatform.system}.cella-org}/bin/cella";
  url = db: "postgresql://postgres@/${db}?host=/run/postgresql";
  # As the cluster's superuser, over its socket.
  as = cmd: "sudo -u postgres env PGHOST=/run/postgresql ${cmd}";
  psql = db: sql: as ''psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} -c "${sql}"'';
  probe = db: port: as "PGDATABASE=${db} PGUSER=postgres node ${self.packages.${pkgs.stdenv.hostPlatform.system}.cella-org}/share/cella/apps/org/ts/_e2e/probe.ts http://127.0.0.1:${toString port}";
  scope = if kind == "scope" then "scope" else "demo";
  probeTs = "${self.packages.${pkgs.stdenv.hostPlatform.system}.cella-org}/share/cella/apps/org/ts/_e2e/probe.ts";
  notice = "This is a prototype environment for demo purposes and can't be used for real work.";
  port = 3000;
in
pkgs.testers.runNixOSTest {
  name = "cella-${kind}";

  nodes.host = { pkgs, ... }: {
    imports = [ self.nixosModules.cella ];
    virtualisation = {
      memorySize = 3072;
      cores = 2;
      diskSize = 4096;
    };
    environment.systemPackages = [ pkgs.curl pkgs.nodejs ];

    # The test's keys, made once before Postgres reads them.
    systemd.services.cella-test-keys = {
      before = [ "postgresql.service" ];
      requiredBy = [ "postgresql.service" ];
      serviceConfig.Type = "oneshot";
      script = ''
        mkdir -p ${keys}
        [ -e ${keys}/notary.key ] || ${cella} key init ${keys}/notary.key
        [ -e ${keys}/vault.key ] || ${cella} key init --vault ${keys}/vault.key
        chown -R postgres:postgres ${keys}
        chmod 0700 ${keys}
      '';
    };

    services.cella = {
      enable = true;
      keyFile = "${keys}/notary.key";
      vaultKeyFile = "${keys}/vault.key";
      scopes.${scope} = {
        inherit port;
        analyticsPort = 54343;
        demo = {
          enable = kind != "scope";
        } // (if kind == "visitors" then {
          # Two copies at most, each ending after 90 s idle, so the cap and
          # the expiry are reached within the test.
          visitors = 2;
          idle = 90;
          evictAfter = 1;
          memory = 512;
          perIp = 5;
        } else { visitors = null; });
      } // (if kind == "scope" then { timezone = "Europe/Paris"; } else { });
    };
  };

  testScript =
    if kind == "demo" then ''
      notice = ${builtins.toJSON notice}
      host.start()
      host.wait_for_unit("cella-${scope}.service", timeout=3600)
      host.wait_for_open_port(${toString port}, timeout=600)

      with subtest("nobody is served the template, closed to every connection"):
          host.succeed("""${psql "postgres" "SELECT datistemplate AND NOT datallowconn FROM pg_database WHERE datname = 'demo_template'"} | grep -qx t""")
          host.succeed("""${psql "postgres" "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = 'demo'"} | grep -q '^a copy of demo_template: cella demo template: '""")

      with subtest("the demo's sign-in offers Lanterne's members, each marked as a demo member, under its banner"):
          page = host.succeed("curl -sf http://127.0.0.1:${toString port}/sign-in")
          members = int(host.succeed("""${psql "demo" "SELECT count(DISTINCT address) FROM person.device WHERE revoked IS NULL"} """).strip())
          assert "Demo members" in page, "the sign-in offers no demo members"
          assert "Camille Martin" in page, "Camille is not offered"
          assert page.count("demo member</span>") == members, f"{page.count('demo member</span>')} marked, of {members} members"
          assert notice in page, "the sign-in wears no demo banner"

      with subtest("a demo member signs in with their derived key and signs a write"):
          head = int(host.succeed("""${psql "demo" "SELECT n FROM cella.head"} """).strip())
          print(host.succeed("${probe "demo" port}"))
          after = int(host.succeed("""${psql "demo" "SELECT n FROM cella.head"} """).strip())
          assert after > head, f"the log's head stayed at {head}"
          host.succeed("${as "${cella} log verify --url '${url "demo"}'"}")

      with subtest("the template, built again from nothing, holds the same log, and both verify"):
          ops = "SELECT string_agg(n || ' ' || op || ' ' || date, ',' ORDER BY n) FROM cella.log"
          host.succeed("${as "${cella} demo copy first --url '${url "demo_template"}'"}")
          host.succeed("${as "${cella} demo template --again --url '${url "demo_template"}'"}")
          host.succeed("${as "${cella} demo copy second --url '${url "demo_template"}'"}")
          first = host.succeed(f"${as "psql -X -q -t -A -d first"} -c \"{ops}\"")
          second = host.succeed(f"${as "psql -X -q -t -A -d second"} -c \"{ops}\"")
          assert first and first == second, "the two templates' logs differ"
          host.succeed("${as "${cella} log verify --url '${url "first"}'"}")
          host.succeed("${as "${cella} log verify --url '${url "second"}'"}")
    '' else if kind == "visitors" then ''
      import re, time
      notice = ${builtins.toJSON notice}
      front = "http://127.0.0.1:${toString port}"
      host.start()
      host.wait_for_unit("cella-${scope}.service", timeout=3600)
      host.wait_for_open_port(${toString port}, timeout=600)

      def copies():
          return host.succeed("""${psql "postgres" "SELECT datname FROM pg_database WHERE datname ~ '^demo_v_' ORDER BY 1"}""").split()

      def roles():
          return host.succeed("""${psql "postgres" "SELECT rolname FROM pg_roles WHERE rolname ~ '^demo_v_' ORDER BY 1"}""").split()

      def head(db):
          return int(host.succeed(f"""${as "psql -X -q -t -A -d {db} -c 'SELECT n FROM cella.head'"}""").strip())

      def cookie(jar):
          return host.succeed(f"awk '$6 == \"cella-visitor\" {{ print $7 }}' {jar}").strip()

      def start(jar):
          return host.execute(f"curl -s -o /dev/stderr -w '%{{http_code}}' -c {jar} -b {jar} -X POST -H 'Origin: {front}' {front}/_demo/start")[1].strip()

      # A visitor's first visit: the page saying their copy is being
      # prepared, its script's POST, then the sign-in of their own copy.
      def visit(jar):
          before = set(copies())
          begun = time.monotonic()
          page = host.succeed(f"curl -sf -c {jar} -b {jar} {front}/")
          assert "is being prepared" in page and notice in page, "no page saying the copy is being prepared"
          assert start(jar) == "200", "no copy was made"
          page = host.succeed(f"curl -sf -b {jar} {front}/sign-in")
          ms = round((time.monotonic() - begun) * 1000)
          made = sorted(set(copies()) - before)
          assert len(made) == 1, f"{made} made, not one copy"
          print(f"first request to a served sign-in: {ms} ms")
          return made[0], page

      def password(db):
          for pid in host.succeed("pgrep -u cella-visitors node || true").split():
              env = host.succeed(f"tr '\\0' '\\n' < /proc/{pid}/environ || true")
              if re.search(rf"^PGDATABASE={db}$", env, re.M):
                  return re.search(r"^PGPASSWORD=(.*)$", env, re.M).group(1), pid
          raise Exception(f"no server serves {db}")

      def probe(db, jar):
          print(host.succeed(f"""${as "PROBE_COOKIE=cella-visitor={cookie(jar)} PGDATABASE={db} PGUSER=postgres node ${probeTs} {front}"}"""))

      with subtest("a request with no cookie is shown its copy being prepared, and makes none; the template is closed"):
          page = host.succeed(f"curl -sf {front}/inbox")
          assert "is being prepared" in page, "no page saying a copy is being prepared"
          assert copies() == [], f"a GET made a copy: {copies()}"
          host.succeed(f"curl -sf {front}/robots.txt | grep -qx 'Disallow: /'")
          host.succeed("""${psql "postgres" "SELECT datistemplate AND NOT datallowconn FROM pg_database WHERE datname = 'demo_template'"} | grep -qx t""")
          code = host.succeed(f"curl -s -o /dev/null -w '%{{http_code}}' -X POST -H 'Origin: http://elsewhere.example' {front}/_demo/start").strip()
          assert code == "403", f"a cross-site start answered {code}"

      with subtest("a visitor's first visit copies the template into a scope of their own, marked a copy, under the banner"):
          a, page = visit("/tmp/a")
          assert re.fullmatch(r"demo_v_[0-9a-f]{16}", a), a
          host.succeed(f"""${psql "postgres" "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '{a}'"} | grep -q '^a copy of demo_template: cella demo template: '""")
          assert "Demo members" in page and "Camille Martin" in page, "the copy's sign-in offers no demo members"
          assert notice in page, "the copy's sign-in wears no prototype notice"
          assert "yours alone" in page and "Reset now" in page, "the banner says nothing of the visitor's copy"
          assert "minutes idle" in page and "0:01:30" in page, "the banner says nothing of when the copy resets"
          pw, pid = password(a)
          rss = int(host.succeed(f"ps -o rss= -p {pid}").strip()) // 1024
          print(f"one visitor's server holds {rss} MiB resident")

      with subtest("a second visitor gets a copy of their own; the first one's write changes neither theirs nor the template"):
          b, _ = visit("/tmp/b")
          assert a != b and sorted(copies()) == sorted([a, b]), copies()
          base = head(b)
          assert head(a) == base, "two fresh copies differ"
          probe(a, "/tmp/a")
          assert head(a) > base, "the first visitor's write did not reach their copy"
          assert head(b) == base, "the first visitor's write reached the second's copy"
          invited = "SELECT count(*) FROM person.person WHERE name = 'Probe Petit'"
          assert host.succeed(f"""${as "psql -X -q -t -A -d {b}"} -c "{invited}" """).strip() == "0"

      with subtest("a copy's role reaches its own database alone, and is no superuser"):
          pw, _ = password(a)
          login = lambda db, at="/run/postgresql": host.execute(f"PGPASSWORD='{pw}' ${pkgs.postgresql_18}/bin/psql -X -q -t -A -h {at} -U {a} -d {db} -c 'SELECT current_user'")[0]
          assert login(a) == 0, "the copy's role cannot reach its own copy"
          for db in [b, "postgres", "demo_template"]:
              assert login(db) != 0, f"the copy's role reaches {db}"
              assert login(db, "127.0.0.1") != 0, f"the copy's role reaches {db} over TCP"
          assert login(a, "127.0.0.1") != 0, "the copy's role reaches its copy over TCP"
          host.succeed("""${psql "postgres" "SELECT bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) FROM pg_roles WHERE rolname ~ '^demo_v_'"} | grep -qx t""")
          host.succeed("""${psql "postgres" "SELECT rolconnlimit FROM pg_roles WHERE rolname = '{a}'"} | grep -qx 10""".replace("{a}", a))

      with subtest("the front's unit holds no address but localhost, no capability, and a memory limit"):
          show = host.succeed("systemctl show cella-${scope}.service -p IPAddressDeny -p IPAddressAllow -p CapabilityBoundingSet -p MemoryMax -p User")
          print(show)
          assert "IPAddressDeny=0.0.0.0/0 ::/0" in show, "the front reaches the network"
          assert "MemoryMax=infinity" not in show, "no memory limit"

      with subtest("Reset now drops the copy and makes a fresh one, the earlier cookie naming none"):
          old = cookie("/tmp/a")
          host.succeed("cp /tmp/a /tmp/a-old")
          time.sleep(21)
          code = host.succeed(f"curl -s -o /dev/null -w '%{{http_code}}' -c /tmp/a -b /tmp/a -X POST -H 'Origin: {front}' {front}/_demo/reset").strip()
          assert code == "303", f"Reset now answered {code}"
          assert cookie("/tmp/a") != old, "Reset now kept the cookie"
          fresh = [c for c in copies() if c not in (a, b)]
          assert len(fresh) == 1 and a not in copies() and a not in roles(), f"{copies()} {roles()}"
          a2 = fresh[0]
          assert head(a2) == base, "the fresh copy is not the template's"
          page = host.succeed(f"curl -sf -b /tmp/a-old {front}/")
          assert "Your earlier copy was reset." in page, "an ended copy's cookie is not told so"
          host.succeed(f"curl -sf -b /tmp/a {front}/sign-in | grep -q 'Reset now'")

      with subtest("at the cap a newcomer ends the copy idle longest"):
          host.succeed(f"curl -sf -b /tmp/a {front}/sign-in")
          time.sleep(2)
          c, _ = visit("/tmp/c")
          assert sorted(copies()) == sorted([a2, c]), f"{copies()}: the idlest, {b}, is not the one ended"
          assert b not in roles()

      with subtest("an address making too many copies is refused"):
          assert start("/tmp/d") == "200"
          assert start("/tmp/e") == "429", "a sixth copy from one address in ten minutes was made"
          assert len(copies()) == 2, copies()

      with subtest("a copy idle past its span ends, leaving no database, role, server or socket"):
          host.wait_until_succeeds("""${psql "postgres" "SELECT count(*) FROM pg_database WHERE datname ~ '^demo_v_'"} | grep -qx 0""", timeout=240)
          assert roles() == [], roles()
          host.succeed("test $(pgrep -u cella-visitors -c node) -eq 1")
          host.succeed("test -z \"$(ls /run/cella-${scope})\"")
          page = host.succeed(f"curl -sf -b /tmp/c {front}/")
          assert "Your earlier copy was reset." in page

      with subtest("the front, killed and restarted, ends every copy the killed one left"):
          host.succeed("systemctl kill -s KILL cella-${scope}.service")
          host.wait_until_succeeds(f"curl -sf {front}/_demo/health", timeout=120)
          f, _ = visit("/tmp/f")
          host.succeed("systemctl kill -s KILL --kill-whom=main cella-${scope}.service")
          host.wait_until_succeeds(f"curl -sf {front}/_demo/health", timeout=120)
          assert copies() == [] and roles() == [], f"{copies()} {roles()} left"
    '' else ''
      notice = ${builtins.toJSON notice}
      host.start()
      host.wait_for_unit("cella-${scope}.service", timeout=1800)
      host.wait_for_unit("cella-${scope}-analytics.service", timeout=600)
      host.wait_for_open_port(${toString port}, timeout=600)

      with subtest("the scope's server serves a sign-in offering no one"):
          page = host.succeed("curl -sf http://127.0.0.1:${toString port}/sign-in")
          assert "Sign in" in page, "no sign-in page"
          assert "Fixture members" not in page and "Demo members" not in page, "a production sign-in offers someone"
          assert notice not in page, "a scope wears the demo banner"

      with subtest("Lanterne is founded in it, the log's first write, signed through the notary"):
          host.succeed("${as "${cella} seed lanterne --url '${url "scope"}'"}")
          host.succeed("systemctl restart cella-${scope}.service")
          host.wait_for_open_port(${toString port}, timeout=600)

      with subtest("a member signs in with their TEST-ONLY device and signs a write"):
          print(host.succeed("${probe "scope" port}"))
          host.succeed("${as "${cella} log verify --url '${url "scope"}'"}")

      with subtest("the nightly backup is taken, and restores into a database whose log verifies at the same head"):
          host.succeed("systemctl start cella-backup.service")
          backup = host.succeed("ls -1d /var/backup/cella/${scope}/*/ | tail -1").strip()
          host.succeed(f"test -f {backup}/manifest")
          host.succeed("${as "createdb restored"}")
          host.succeed(f"${as "${cella} restore {backup} --url '${url "restored"}'"}")
          host.succeed("${as "${cella} log verify --url '${url "restored"}'"}")
          heads = [host.succeed(f"${as "psql -X -q -t -A -d {db} -c 'SELECT n FROM cella.head'"}").strip() for db in ["scope", "restored"]]
          assert heads[0] == heads[1], f"the restored head is {heads[1]}, not {heads[0]}"
    '';
}
