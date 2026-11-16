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
{ self, pkgs, kind }:
let
  keys = "/var/lib/cella-keys";
  cella = "${self.packages.${pkgs.stdenv.hostPlatform.system}.cella-org}/bin/cella";
  url = db: "postgresql://postgres@/${db}?host=/run/postgresql";
  # As the cluster's superuser, over its socket.
  as = cmd: "sudo -u postgres env PGHOST=/run/postgresql ${cmd}";
  psql = db: sql: as ''psql -X -q -t -A -v ON_ERROR_STOP=1 -d ${db} -c "${sql}"'';
  probe = db: port: as "PGDATABASE=${db} PGUSER=postgres node ${self.packages.${pkgs.stdenv.hostPlatform.system}.cella-org}/share/cella/apps/org/ts/_e2e/probe.ts http://127.0.0.1:${toString port}";
  scope = if kind == "demo" then "demo" else "scope";
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
        demo.enable = kind == "demo";
      } // (if kind == "demo" then { } else { timezone = "Europe/Paris"; });
    };
  };

  testScript =
    if kind == "demo" then ''
      host.start()
      host.wait_for_unit("cella-${scope}.service", timeout=3600)
      host.wait_for_open_port(${toString port}, timeout=600)

      with subtest("nobody is served the template, closed to every connection"):
          host.succeed("""${psql "postgres" "SELECT datistemplate AND NOT datallowconn FROM pg_database WHERE datname = 'demo_template'"} | grep -qx t""")
          host.succeed("""${psql "postgres" "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = 'demo'"} | grep -q '^a copy of demo_template: cella demo template: '""")

      with subtest("the demo's sign-in offers Lanterne's members, each marked as a demo member, under its banner"):
          page = host.succeed("curl -sf http://127.0.0.1:${toString port}/sign-in")
          members = int(host.succeed("""${psql "demo" "SELECT count(DISTINCT address) FROM person.device WHERE revoked IS NULL"}""").strip())
          assert "Demo members" in page, "the sign-in offers no demo members"
          assert "Camille Martin" in page, "Camille is not offered"
          assert page.count("demo member</span>") == members, f"{page.count('demo member</span>')} marked, of {members} members"
          assert "Nothing here is real." in page, "the sign-in wears no demo banner"

      with subtest("a demo member signs in with their derived key and signs a write"):
          head = int(host.succeed("""${psql "demo" "SELECT n FROM cella.head"}""").strip())
          print(host.succeed("${probe "demo" port}"))
          after = int(host.succeed("""${psql "demo" "SELECT n FROM cella.head"}""").strip())
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
    '' else ''
      host.start()
      host.wait_for_unit("cella-${scope}.service", timeout=1800)
      host.wait_for_unit("cella-${scope}-analytics.service", timeout=600)
      host.wait_for_open_port(${toString port}, timeout=600)

      with subtest("the scope's server serves a sign-in offering no one"):
          page = host.succeed("curl -sf http://127.0.0.1:${toString port}/sign-in")
          assert "Sign in" in page, "no sign-in page"
          assert "Fixture members" not in page and "Demo members" not in page, "a production sign-in offers someone"
          assert "Nothing here is real." not in page, "a scope wears the demo banner"

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
