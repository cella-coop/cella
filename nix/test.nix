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
  sessionProbeTs = "${self.packages.${pkgs.stdenv.hostPlatform.system}.cella-org}/share/cella/apps/org/ts/_e2e/session-probe.ts";
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
          # Two copies at most, each ending after 90 s idle or 150 s old,
          # storing 4 MiB, one to an address: each limit is reached within
          # the test. --browser-idle is generous, well past a room's own
          # lifetime: every cookie the test touches is a room's sole
          # browser but one, and must never be found idle before its
          # room's own idle-reset or lifetime would end it anyway.
          visitors = 2;
          idle = 90;
          lifetime = 150;
          evictAfter = 1;
          minAge = 1;
          browserIdle = 300;
          memory = 512;
          storage = 4;
          perAddress = 1;
        } else { shared = true; });
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

      with subtest("a demo drops no database that is not its own: a co-op's is refused as a copy and as a template"):
          host.succeed("${as "createdb coop"}")
          host.succeed("""${psql "coop" "CREATE TABLE kept (n int); INSERT INTO kept VALUES (1)"} """)
          said = host.fail("${as "${cella} demo copy coop --url '${url "demo_template"}' --replace"} 2>&1")
          assert "is not a copy of demo_template" in said, said
          said = host.fail("${as "${cella} demo template --again --url '${url "coop"}'"} 2>&1")
          assert "is not a template" in said, said
          host.succeed("""${psql "coop" "SELECT n FROM kept"} | grep -qx 1""")

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
          return host.succeed("""${psql "postgres" "SELECT datname FROM pg_database WHERE datname ~ '^demo_v_' ORDER BY 1"} """).split()

      def roles():
          return host.succeed("""${psql "postgres" "SELECT rolname FROM pg_roles WHERE rolname ~ '^demo_v_' ORDER BY 1"} """).split()

      def head(db):
          return int(host.succeed(f"""${as "psql -X -q -t -A -d {db} -c 'SELECT n FROM cella.head'"}""").strip())

      # Each visitor: the address the host's proxy would forward, and the
      # cookie the front set them, sent back as a browser sends it.
      jar = {}
      def curl(who, ip, args):
          cookie = f"-H 'Cookie: __Host-cella-visitor={jar[who]}'" if jar.get(who) else ""
          return f"curl -s {cookie} -H 'X-Forwarded-For: {ip}' {args}"

      def start(who, ip, path="/_demo/start"):
          out = host.succeed(curl(who, ip, f"-D - -o /dev/null -X POST -H 'Origin: {front}' {front}{path}"))
          code = out.split()[1]
          set = re.search(r"(?im)^set-cookie: __Host-cella-visitor=([A-Za-z0-9_-]+);.*Secure", out)
          if set:
              jar[who] = set.group(1)
          return code

      def page(who, ip, path):
          return host.succeed(curl(who, ip, f"-f {front}{path}"))

      def status(who, ip, args):
          return host.execute(curl(who, ip, f"-o /dev/null -w '%{{http_code}}' {args}"))[1].strip()

      # A first visit: the page saying the copy is being prepared, its
      # script's POST, then the sign-in of the visitor's own copy.
      def visit(who, ip):
          before = set(copies())
          begun = time.monotonic()
          assert "is being prepared" in page(who, ip, "/"), "no page saying the copy is being prepared"
          assert start(who, ip) == "200", "no copy was made"
          signin = page(who, ip, "/sign-in")
          ms = round((time.monotonic() - begun) * 1000)
          made = sorted(set(copies()) - before)
          assert len(made) == 1, f"{made} made, not one copy"
          print(f"first request to a served sign-in: {ms} ms")
          return made[0], signin

      def password(db):
          for pid in host.succeed("cat /sys/fs/cgroup/system.slice/cella-${scope}.service/cgroup.procs").split():
              env = host.succeed(f"tr '\\0' '\\n' < /proc/{pid}/environ || true")
              found = re.search(rf"^DATABASE_URL=postgresql://{db}:([^@]+)@/{db}\?", env, re.M)
              if found:
                  return found.group(1), pid
          raise Exception(f"no server serves {db}")

      def probe(db, who, ip):
          print(host.succeed(f"""${as "PROBE_COOKIE=__Host-cella-visitor={jar[who]} PGDATABASE={db} PGUSER=postgres node ${probeTs} {front}"}"""))

      # As `probe`, but the sign-in it opens is expected refused (a member
      # already leased to another browser in the room): what the probe
      # said on its standard error, the sign-in's reason among it.
      def probe_refused(db, who, ip):
          return host.fail(f"""${as "PROBE_COOKIE=__Host-cella-visitor={jar[who]} PGDATABASE={db} PGUSER=postgres node ${probeTs} {front}"} 2>&1""")

      # Opens a session alone, no write, as `who`'s browser, already
      # leased: the `cella-session` cookie the server set, apart from the
      # front's own visitor cookie.
      def session_cookie(db, who):
          return host.succeed(f"""${as "PROBE_COOKIE=__Host-cella-visitor={jar[who]} PGDATABASE={db} PGUSER=postgres node ${sessionProbeTs} {front}"}""").strip()

      # A protected page's status, `who`'s own visitor cookie (so its own
      # browser's lease, if any, is what is read) carrying `session`'s
      # cookie, another browser's own where a copied cookie is modelled.
      def authed(who, ip, session, path="/inbox"):
          cookie = f"-H 'Cookie: __Host-cella-visitor={jar[who]}; {session}'"
          return host.execute(f"curl -s {cookie} -H 'X-Forwarded-For: {ip}' -o /dev/null -w '%{{http_code}}' {front}{path}")[1].strip()

      # Posts a room's join code as its own page's script would, `who`
      # holding no room yet: the status it answered, and, joined, its
      # cookie kept under `who` as any other browser's is. `origin`
      # stands for the page's own, same-origin by default.
      def join_room(who, ip, code, origin=None):
          out = host.succeed(curl(who, ip, f"-D - -o /dev/null -X POST -H 'Origin: {origin or front}' --data-raw '{code}' {front}/_demo/join"))
          status_line = out.split()[1]
          set = re.search(r"(?im)^set-cookie: __Host-cella-visitor=([A-Za-z0-9_-]+);.*Secure", out)
          if set:
              jar[who] = set.group(1)
          return status_line

      def fill(db, mib):
          host.succeed(f"""${as "psql -X -q -d {db}"} -c "CREATE TABLE IF NOT EXISTS public.filler (b text STORAGE EXTERNAL); INSERT INTO public.filler SELECT string_agg(md5(random()::text), ''') FROM generate_series(1, 32), generate_series(1, {mib} * 1024) g GROUP BY g" """)

      with subtest("a request with no cookie is shown its copy being prepared, and makes none; the template is closed"):
          assert "is being prepared" in page("x", "10.0.0.9", "/inbox")
          assert copies() == [], f"a GET made a copy: {copies()}"
          host.succeed(f"curl -sf {front}/robots.txt | grep -qx 'Disallow: /'")
          host.succeed("""${psql "postgres" "SELECT datistemplate AND NOT datallowconn FROM pg_database WHERE datname = 'demo_template'"} | grep -qx t""")
          code = status("x", "10.0.0.9", f"-X POST -H 'Origin: http://elsewhere.example' {front}/_demo/start")
          assert code == "403", f"a cross-site start answered {code}"

      with subtest("a visitor's first visit copies the template into a scope of their own, marked a copy, under the banner"):
          a, signin = visit("a", "10.0.0.1")
          assert re.fullmatch(r"demo_v_[0-9a-f]{16}", a), a
          host.succeed(f"""${psql "postgres" "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = '{a}'"} | grep -q '^a copy of demo_template: cella demo template: '""")
          assert "Demo members" in signin and "Camille Martin" in signin, "the copy's sign-in offers no demo members"
          assert notice in signin, "the copy's sign-in wears no prototype notice"
          assert "yours alone" in signin and "Reset now" in signin, "the banner says nothing of the visitor's copy"
          assert "minutes idle" in signin and "or when its time runs out" in signin and "0:01:30" in signin, "the banner says nothing of when the copy resets"
          pw, pid = password(a)
          rss = int(host.succeed(f"ps -o rss= -p {pid}").strip()) // 1024
          print(f"one visitor's server holds {rss} MiB resident")

      with subtest("a second visitor gets a copy of their own; the first one's write changes neither theirs nor the template"):
          b, _ = visit("b", "10.0.0.2")
          assert a != b and sorted(copies()) == sorted([a, b]), copies()
          base = head(b)
          assert head(a) == base, "two fresh copies differ"
          probe(a, "a", "10.0.0.1")
          assert head(a) > base, "the first visitor's write did not reach their copy"
          assert head(b) == base, "the first visitor's write reached the second's copy"

      with subtest("a copy's role reaches its own database alone, and is no superuser"):
          pw, _ = password(a)
          login = lambda db, at="/run/postgresql": host.execute(f"PGPASSWORD='{pw}' ${pkgs.postgresql_18}/bin/psql -X -q -t -A -h {at} -U {a} -d {db} -c 'SELECT current_user'")[0]
          assert login(a) == 0, "the copy's role cannot reach its own copy"
          for db in [b, "postgres", "demo_template"]:
              assert login(db) != 0, f"the copy's role reaches {db}"
              assert login(db, "127.0.0.1") != 0, f"the copy's role reaches {db} over TCP"
          assert login(a, "127.0.0.1") != 0, "the copy's role reaches its copy over TCP"
          host.succeed("""${psql "postgres" "SELECT bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) FROM pg_roles WHERE rolname ~ '^demo_v_'"} | grep -qx t""")

      with subtest("the front's unit, and every copy's server in it, reaches no address but localhost, and holds no capability and a memory limit"):
          show = host.succeed("systemctl show cella-${scope}.service -p CapabilityBoundingSet -p MemoryMax")
          print(show)
          assert "CapabilityBoundingSet=\n" in show + "\n", "the front holds a capability"
          assert "MemoryMax=infinity" not in show, "no memory limit"
          ip = host.succeed("ip -4 -o addr show eth1 | awk '{ print $4 }' | cut -d/ -f1").strip()
          host.succeed(f"systemd-run --unit listen-{ip.replace('.', '-')} node -e \"require('http').createServer((q, s) => s.end('ok')).listen(8099, '{ip}')\"")
          host.wait_until_succeeds(f"curl -sf --max-time 5 http://{ip}:8099/", timeout=60)
          inside = lambda url: host.execute(f"sh -c 'echo $$ > /sys/fs/cgroup/system.slice/cella-${scope}.service/cgroup.procs && exec curl -sf --max-time 5 {url}'")[0]
          assert inside(f"{front}/_demo/health") == 0, "the unit cannot reach localhost"
          assert inside(f"http://{ip}:8099/") != 0, "the unit reaches an address beyond localhost"

      with subtest("an address holds as many copies as it may, and refused attempts cost it nothing"):
          for _ in range(3):
              assert start("a-again", "10.0.0.1") == "429", "an address took a second copy"
          assert sorted(copies()) == sorted([a, b]), copies()

      with subtest("Reset now drops the copy and makes a fresh one, the earlier cookie naming none"):
          old = jar["a"]
          time.sleep(21)
          assert start("a", "10.0.0.1", "/_demo/reset") == "303", "Reset now made no fresh copy"
          assert jar["a"] != old, "Reset now kept the cookie"
          fresh = [c for c in copies() if c not in (a, b)]
          assert len(fresh) == 1 and a not in copies() and a not in roles(), f"{copies()} {roles()}"
          a2 = fresh[0]
          assert head(a2) == base, "the fresh copy is not the template's"
          jar["a-old"] = old
          assert "Your earlier copy was reset." in page("a-old", "10.0.0.1", "/")
          assert "Reset now" in page("a", "10.0.0.1", "/sign-in")

      with subtest("at the cap a newcomer ends the copy idle longest"):
          page("a", "10.0.0.1", "/sign-in")
          time.sleep(2)
          c, _ = visit("c", "10.0.0.3")
          assert sorted(copies()) == sorted([a2, c]), f"{copies()}: the idlest, {b}, is not the one ended"
          assert b not in roles()

      with subtest("a write takes no body past 2 MB, nor one of no stated length"):
          host.succeed("head -c 3000000 /dev/urandom > /tmp/big")
          code = status("c", "10.0.0.3", f"-X POST -H 'Origin: {front}' --data-binary @/tmp/big {front}/session")
          assert code == "413", f"a 3 MB body answered {code}"
          code = status("c", "10.0.0.3", f"-X POST -H 'Origin: {front}' -H 'Transfer-Encoding: chunked' --data-binary @/tmp/big {front}/session")
          assert code == "411", f"a chunked body answered {code}"
          assert c in copies()

      with subtest("parallel uploads to one copy pass its quota by one upload at most"):
          host.succeed("head -c 1500000 /dev/urandom > /tmp/mid")
          one = curl("c", "10.0.0.3", f"-X POST -H 'Origin: {front}' --data-binary @/tmp/mid -o /dev/null -w '%{{http_code}}\\n' {front}/session")
          codes = host.succeed(f"for i in $(seq 1 12); do {one} & done; wait").split()
          print(codes)
          through = [code for code in codes if code not in ("503", "507")]
          assert len(codes) == 12, codes
          assert "507" in codes, "no upload past the quota was refused"
          # 4 MiB holds two of 1.5 MB; one more is the most it may pass by.
          assert len(through) <= 3, f"{len(through)} uploads of 1.5 MB were let into a copy of 4 MiB"

      with subtest("a copy past its storage takes no write and says why, and past twice it ends, largest first"):
          fill(c, 6)
          # fill() writes straight through psql, past the front's own
          # tracking of what landed; past its 2 s reading cache, the next
          # write finds it measured afresh.
          time.sleep(3)
          out = host.execute(curl("c", "10.0.0.3", f"-X POST -H 'Origin: {front}' -d x=1 -w ' %{{http_code}}' {front}/session"))[1]
          assert out.endswith(" 507") and "Reset now for a fresh one" in out, f"a full copy answered {out}"
          assert "Camille Martin" in page("c", "10.0.0.3", "/sign-in"), "a full copy no longer reads"
          fill(c, 4)
          host.wait_until_succeeds(f"""${psql "postgres" "SELECT count(*) FROM pg_database WHERE datname = '{c}'"} | grep -qx 0""", timeout=120)
          assert a2 in copies() and c not in roles()

      with subtest("an IPv6 address is counted by its /64"):
          assert start("v6a", "2001:db8::1") == "200"
          assert start("v6b", "2001:db8::2") == "429", "a second address of the same /64 took a copy"
          assert start("v6c", "2001:db8:0:1::1") == "200", "another /64 was refused"
          assert len(copies()) == 2, copies()

      with subtest("a copy idle past its span ends, leaving no database, role, server or socket"):
          host.wait_until_succeeds("""${psql "postgres" "SELECT count(*) FROM pg_database WHERE datname ~ '^demo_v_'"} | grep -qx 0""", timeout=240)
          assert roles() == [], roles()
          host.succeed("test $(wc -l < /sys/fs/cgroup/system.slice/cella-${scope}.service/cgroup.procs) -eq 1")
          host.succeed("test -z \"$(ls /run/cella-${scope})\"")
          assert "Your earlier copy was reset." in page("c", "10.0.0.3", "/")

      with subtest("a copy kept busy still ends at its lifetime"):
          g, _ = visit("g", "10.0.0.7")
          begun = time.monotonic()
          while g in copies():
              assert time.monotonic() - begun < 240, "a busy copy outlived its lifetime"
              host.succeed(curl("g", "10.0.0.7", f"{front}/sign-in"))
              time.sleep(10)
          lived = round(time.monotonic() - begun)
          print(f"a busy copy ended after {lived} s")
          assert lived > 100, f"a busy copy ended after {lived} s, before its lifetime"

      with subtest("the front, killed and restarted, ends every copy the killed one left"):
          host.succeed("systemctl kill -s KILL cella-${scope}.service")
          host.wait_until_succeeds(f"curl -sf {front}/_demo/health", timeout=120)
          f, _ = visit("f", "10.0.0.8")
          host.succeed("systemctl kill -s KILL --kill-whom=main cella-${scope}.service")
          host.wait_until_succeeds(f"curl -sf {front}/_demo/health", timeout=120)
          assert copies() == [] and roles() == [], f"{copies()} {roles()} left"

      with subtest("a room's Share this copy link carries its code in the fragment, which a GET never reads"):
          p, psignin = visit("p", "10.0.0.20")
          found = re.search(r"/_demo/join#([A-Za-z0-9_-]+)", psignin)
          assert found, "the banner offers no Share this copy link, its code in the fragment"
          code = found.group(1)
          assert status("p2", "10.0.0.20", f"{front}/_demo/join") == "200", "the join page itself answers nothing of a code"
          assert status("p2", "10.0.0.20", f"{front}/_demo/join?code={code}") == "200", "a code in the query is no longer read; the join page is served all the same"
          assert copies() == [p], f"opening the join page made a copy: {copies()}"

      with subtest("posting the code same-origin joins the room, not counted against its address' limits"):
          assert join_room("p2", "10.0.0.20", code) == "303", "posting the code did not join the room"
          assert copies() == [p], f"joining made a copy of its own: {copies()}"
          joined = page("p2", "10.0.0.20", "/sign-in")
          assert "Camille Martin" in joined and notice in joined, "the joined browser does not read the same room"
          assert code in joined, "the joined browser's own banner still offers the room's link"
          assert status("p2", "10.0.0.20", f"-X POST -H 'Origin: {front}' {front}/_demo/start") == "200", "the joined browser has no room of its own"
          assert copies() == [p], f"asking again made a copy: {copies()}"
          assert join_room("p3", "10.0.0.20", "wrong") == "404", "a wrong code was not refused"

      with subtest("a cross-origin post of a room's code is refused, as a cross-site start or reset is"):
          refused = join_room("p4", "10.0.0.20", code, origin="http://elsewhere.example")
          assert refused == "403", f"a cross-site join answered {refused}"
          assert "p4" not in jar, "a refused cross-site join still set a cookie"

      with subtest("a fixture member is one browser's at a time in a room; a second browser already there is refused it"):
          probe(p, "p", "10.0.0.20")
          said = probe_refused(p, "p2", "10.0.0.20")
          assert "signed in on another browser already" in said, said

      with subtest("Reset now is refused unless its browser is alone in the room"):
          time.sleep(21)
          page("p2", "10.0.0.20", "/sign-in")
          assert status("p", "10.0.0.20", f"-X POST -H 'Origin: {front}' {front}/_demo/reset") == "409", "Reset now succeeded although p2 is still in the room"
          assert p in copies(), "a refused reset still ended the room"

      with subtest("a session authorizes only the browser that holds its member's lease, and a released lease ends it"):
          # p's own session, opened on the lease it still holds: carried
          # with p's own visitor cookie, it reads a protected page; p2's
          # visitor cookie, which names no lease of camille's, reads none
          # though it carries the very same session cookie, as a copied
          # one would.
          psession = session_cookie(p, "p")
          assert authed("p", "10.0.0.20", psession) != "401", "p's own session, holding its lease, was refused a protected page"
          assert authed("p2", "10.0.0.20", psession) == "401", "p2, carrying p's session cookie but not its lease, still read a protected page"
          # p signs out: its lease released, freed for p2 to take, and the
          # very session that opened it authorizes nothing more, even
          # presented again as p's own browser would.
          signed_out = host.execute(f"curl -s -H 'Cookie: __Host-cella-visitor={jar['p']}; {psession}' -H 'X-Forwarded-For: 10.0.0.20' -H 'Origin: {front}' -X POST -o /dev/null -w '%{{http_code}}' {front}/sign-out")[1].strip()
          assert signed_out == "303", f"p could not sign out: {signed_out}"
          assert authed("p", "10.0.0.20", psession) == "401", "a released lease still authorized the session it opened"
          probe(p, "p2", "10.0.0.20")

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
