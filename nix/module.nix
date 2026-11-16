# services.cella: the org app's scopes on a NixOS host, as operations.md
# says a scope's server is. One Postgres 18 cluster, the host's, with the
# notary (`cella-pg`) preloaded and its two key files at the paths the host
# names; for each scope, a database, its setup, its analytics shell and its
# server, each a unit of its own; and a nightly `cella backup` of every
# scope that is no demo. The module never makes a notary's or a vault's
# key, and none is in the store: `cella key init` makes each, once, by
# hand. A scope is a name under `scopes`, so a host starts as many as its
# ports allow, each `cella-<name>`.
{ self }:
{ config, lib, pkgs, ... }:
let
  inherit (lib) mkEnableOption mkIf mkOption types;
  cfg = config.services.cella;
  system = pkgs.stdenv.hostPlatform.system;
  pg = config.services.postgresql.package;
  socket = "/run/postgresql";
  url = role: db: "postgresql://${role}@/${db}?host=${socket}";
  cella = "${cfg.package}/bin/cella";
  demos = lib.filterAttrs (_: s: s.demo.enable) cfg.scopes;
  kept = lib.filterAttrs (_: s: !s.demo.enable) cfg.scopes;
  template = s: "${s.database}_template";
  home = name: "${cfg.stateDir}/${name}";
  databases = lib.concatMap (s: [ s.database ] ++ lib.optional s.demo.enable (template s)) (lib.attrValues cfg.scopes);
  ports = lib.concatMap (s: [ s.port s.analyticsPort ]) (lib.attrValues cfg.scopes);
  # A database's comment, which labels a template with what built it and a
  # copy with the template it was made from.
  comment = db: ''${pg}/bin/psql -X -q -t -A -d postgres -c "SELECT coalesce(shobj_description(oid, 'pg_database'), ''') FROM pg_database WHERE datname = '${db}'"'';
in
{
  options.services.cella = {
    enable = mkEnableOption "cella's scopes, each a database on this host's Postgres 18 and a server of its own";

    package = mkOption {
      type = types.package;
      default = self.packages.${system}.cella-org;
      defaultText = lib.literalMD "the flake's `cella-org`";
      description = "The org app: its built shell, run by `cella-server`, and the `cella` CLI.";
    };

    extension = mkOption {
      type = types.package;
      default = self.packages.${system}.cella-pg;
      defaultText = lib.literalMD "the flake's `cella-pg`";
      description = "The notary, the `cella` extension built for Postgres 18, which the host's Postgres preloads.";
    };

    keyFile = mkOption {
      type = types.str;
      example = "/var/lib/cella-keys/notary.key";
      description = ''
        `cella.key_file`, the notary's 32-byte Ed25519 seed, which `cella key
        init` writes. Postgres reads it, so it is owned by `postgres` and
        readable by it alone. Every scope on the host is signed by it.
      '';
    };

    vaultKeyFile = mkOption {
      type = types.str;
      example = "/var/lib/cella-keys/vault.key";
      description = "`cella.vault_key_file`, the vault's 32 random bytes, which `cella key init --vault` writes; never the notary's file.";
    };

    vaultKeyPrevious = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = "`cella.vault_key_previous`, the vault's key file before a rotation, until `cella vault rewrap` has moved every key.";
    };

    vaultKeysKept = mkOption {
      type = types.listOf types.str;
      default = [ ];
      description = "`cella.vault_keys_kept`, the vault's key files of earlier rotations, kept while a restore point older than them is.";
    };

    stateDir = mkOption {
      type = types.str;
      default = "/var/lib/cella";
      description = "Where each scope keeps its server's session key and its analytics shell's token, in a directory of its own, `<stateDir>/<name>`.";
    };

    backup = {
      enable = mkOption {
        type = types.bool;
        default = true;
        description = "A nightly `cella backup` of every scope that is no demo.";
      };
      dir = mkOption {
        type = types.str;
        default = "/var/backup/cella";
        description = ''
          Where each scope's backups go, `<dir>/<name>/<UTC time>`. A backup
          holds the keys in the clear: the host's own backup encrypts this
          directory and carries it off the host.
        '';
      };
      at = mkOption {
        type = types.str;
        default = "*-*-* 03:00:00";
        description = "When it runs, as systemd's `OnCalendar`.";
      };
      keep = mkOption {
        type = types.ints.positive;
        default = 7;
        description = "How many of each scope's backups stay on the host, the newest.";
      };
    };

    scopes = mkOption {
      default = { };
      description = "The scopes this host serves, by name: each `cella-<name>`, on a database of its own.";
      type = types.attrsOf (types.submodule ({ name, ... }: {
        options = {
          database = mkOption {
            type = types.str;
            default = name;
            description = "Its database on the host's cluster.";
          };
          address = mkOption {
            type = types.nullOr types.str;
            default = null;
            example = "lanterne.example";
            description = "`cella.scope`, the address every signature names, set on its database; null leaves it to its founding, as a demo's is its fixture's.";
          };
          timezone = mkOption {
            type = types.nullOr types.str;
            default = null;
            example = "Europe/Paris";
            description = "`cella.timezone`, whose day the notary dates every verdict by; null leaves it to its founding, else UTC.";
          };
          port = mkOption {
            type = types.port;
            description = "Its server's port on 127.0.0.1, behind the host's proxy, which terminates TLS and sets `x-forwarded-proto`.";
          };
          analyticsPort = mkOption {
            type = types.port;
            description = "Its analytics shell's port on localhost, never exposed.";
          };
          environment = mkOption {
            type = types.attrsOf types.str;
            default = { };
            example = { CELLA_PATIENCE = "120"; };
            description = "More of its server's settings (the shell's `env.ts`).";
          };
          demo = {
            enable = mkEnableOption ''
              a demo: Lanterne, the mock co-op, with a scenario played on it,
              never a pilot co-op's data. Its template, `<database>_template`,
              is built by `cella demo template` when the unit first starts and
              after each upgrade; the scope serves a copy of it, made afresh
              each time the template is, as `cella serve --prod --demo`, its
              sign-in offering Lanterne's members, each marked as a demo
              member. A demo is never backed up'';
            scenario = mkOption {
              type = types.str;
              default = "authority-walk";
              description = "The e2e scenario whose story the template plays on Lanterne.";
            };
          };
        };
      }));
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = demos == { } || kept == { };
        message = "services.cella: the cluster's keys sign every scope on it, and a demo's keys are the demo's own; serve demos on a host of their own, never beside a co-op's scope";
      }
      {
        assertion = lib.length ports == lib.length (lib.unique ports);
        message = "services.cella: every scope's port and analyticsPort are its own";
      }
      {
        assertion = lib.versions.major pg.version == "18";
        message = "services.cella: the notary is built for Postgres 18, and services.postgresql.package is ${pg.version}";
      }
    ];

    users.users.cella = {
      isSystemUser = true;
      group = "cella";
      home = cfg.stateDir;
    };
    users.groups.cella = { };

    environment.systemPackages = [ cfg.package ];

    services.postgresql = {
      enable = true;
      # Above the default nixpkgs picks by stateVersion, below a host's own.
      package = lib.mkOverride 999 pkgs.postgresql_18;
      extensions = [ cfg.extension ];
      settings = {
        shared_preload_libraries = [ "cella" ];
        "cella.key_file" = cfg.keyFile;
        "cella.vault_key_file" = cfg.vaultKeyFile;
      }
      // lib.optionalAttrs (cfg.vaultKeyPrevious != null) { "cella.vault_key_previous" = cfg.vaultKeyPrevious; }
      // lib.optionalAttrs (cfg.vaultKeysKept != [ ]) { "cella.vault_keys_kept" = lib.concatStringsSep "," cfg.vaultKeysKept; };
      # The server logs in as `cella_app` and the analytics shell as
      # `cella_analytics`, both as the `cella` user; a demo's story, as
      # its seed plays it, as `cella_app` from `postgres`.
      authentication = lib.optionalString (databases != [ ]) ''
        local ${lib.concatStringsSep "," databases} cella_app,cella_analytics peer map=cella
      '';
      identMap = ''
        cella cella    cella_app
        cella cella    cella_analytics
        cella postgres cella_app
      '';
    };

    systemd.tmpfiles.rules =
      [ "d ${cfg.stateDir} 0755 root root -" ]
      ++ lib.mapAttrsToList (name: _: "d ${home name} 0700 cella cella -") cfg.scopes
      ++ lib.optional (cfg.backup.enable && kept != { }) "d ${cfg.backup.dir} 0700 postgres postgres -";

    systemd.services = lib.concatMapAttrs (name: s:
      let
        db = s.database;
        su = url "postgres" db;
        data = "${home name}/.data";
        token = "${data}/analytics/${toString s.analyticsPort}/token";
      in
      {
        # The scope's database, made if it is not there and migrated, or a
        # demo's template built and its copy made afresh where the template
        # was; as the cluster's superuser.
        "cella-${name}-setup" = {
          description = "cella: the ${name} scope's database";
          after = [ "postgresql.service" ];
          requires = [ "postgresql.service" ];
          path = [ pg ];
          environment.HOME = "/tmp";
          serviceConfig = {
            Type = "oneshot";
            RemainAfterExit = true;
            User = "postgres";
            Group = "postgres";
            PrivateTmp = true;
            WorkingDirectory = "/tmp";
            # A template plays its whole story.
            TimeoutStartSec = "30min";
          };
          script =
            if s.demo.enable then ''
              ${cella} demo template --url ${url "postgres" (template s)} --scenario ${lib.escapeShellArg s.demo.scenario}
              made=$(${comment (template s)})
              if [ "$(${comment db})" != "a copy of ${template s}: $made" ]; then
                ${cella} demo copy ${db} --url ${url "postgres" (template s)} --replace
              fi
            '' else ''
              if [ -z "$(psql -X -q -t -A -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${db}'")" ]; then
                createdb ${db}
              fi
              ${lib.optionalString (s.address != null) ''psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "ALTER DATABASE \"${db}\" SET cella.scope = '${s.address}'"''}
              ${lib.optionalString (s.timezone != null) ''psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "ALTER DATABASE \"${db}\" SET cella.timezone = '${s.timezone}'"''}
              ${cella} migrate --url ${su}
            '';
        };

        # Its analytics shell, DuckDB over quack on localhost, reading the
        # views the slices publish as `cella_analytics`.
        "cella-${name}-analytics" = {
          description = "cella: the ${name} scope's analytics shell";
          after = [ "cella-${name}-setup.service" ];
          requires = [ "cella-${name}-setup.service" ];
          before = [ "cella-${name}.service" ];
          wantedBy = [ "multi-user.target" ];
          environment.CELLA_DATA = data;
          serviceConfig = {
            Type = "forking";
            User = "cella";
            Group = "cella";
            WorkingDirectory = home name;
            ExecStart = "${cella} analytics start --url ${url "cella_analytics" db} --port ${toString s.analyticsPort}";
            ExecStop = "${cella} analytics stop --port ${toString s.analyticsPort}";
            PIDFile = "${data}/analytics/${toString s.analyticsPort}/pid";
            Restart = "on-failure";
          };
        };

        # Its server, the built shell as `cella serve --prod` runs it, as
        # `cella_app` over the socket; a demo's as `--demo` runs it.
        "cella-${name}" = {
          description = "cella: the ${name} scope's server";
          after = [ "cella-${name}-setup.service" "cella-${name}-analytics.service" ];
          requires = [ "cella-${name}-setup.service" ];
          wants = [ "cella-${name}-analytics.service" ];
          wantedBy = [ "multi-user.target" ];
          environment = {
            PORT = toString s.port;
            HOST = "127.0.0.1";
            PGHOST = socket;
            PGDATABASE = db;
            PGUSER = "cella_app";
            CELLA_SESSION_KEY_FILE = "${home name}/session.key";
            CELLA_ANALYTICS = "quack:localhost:${toString s.analyticsPort}";
            CELLA_ANALYTICS_TOKEN_FILE = token;
          }
          // lib.optionalAttrs s.demo.enable { CELLA_DEMO = "1"; }
          // s.environment;
          # The session key, 32 random bytes, made on first start as `cella
          # serve` makes it and kept, so sessions outlive a restart.
          preStart = ''
            if [ ! -e "$CELLA_SESSION_KEY_FILE" ]; then
              (umask 077; head -c 32 /dev/urandom > "$CELLA_SESSION_KEY_FILE")
            fi
          '';
          serviceConfig = {
            User = "cella";
            Group = "cella";
            WorkingDirectory = home name;
            ExecStart = "${cfg.package}/bin/cella-server";
            Restart = "on-failure";
            NoNewPrivileges = true;
            PrivateTmp = true;
            ProtectSystem = "strict";
            ProtectHome = true;
            ReadWritePaths = [ (home name) ];
          };
        };
      }) cfg.scopes
    // lib.optionalAttrs (cfg.backup.enable && kept != { }) {
      # Every scope that is no demo, backed up as `cella backup` does, each
      # into a new directory, the oldest past `keep` removed; as the
      # cluster's superuser, who reads the key files.
      cella-backup = {
        description = "cella: the nightly backup of every scope";
        after = [ "postgresql.service" ];
        requires = [ "postgresql.service" ];
        path = [ pg pkgs.coreutils pkgs.findutils ];
        environment.HOME = "/tmp";
        serviceConfig = {
          Type = "oneshot";
          User = "postgres";
          Group = "postgres";
          PrivateTmp = true;
          WorkingDirectory = "/tmp";
        };
        script = lib.concatStrings (lib.mapAttrsToList (name: s: ''
          mkdir -p ${cfg.backup.dir}/${name}
          ${cella} backup ${cfg.backup.dir}/${name}/$(date -u +%Y-%m-%dT%H%M%SZ) --url ${url "postgres" s.database}
          ls -1d ${cfg.backup.dir}/${name}/*/ | sort | head -n -${toString cfg.backup.keep} | xargs -r rm -rf
        '') kept);
      };
    };

    systemd.timers = lib.optionalAttrs (cfg.backup.enable && kept != { }) {
      cella-backup = {
        description = "cella: the nightly backup of every scope";
        wantedBy = [ "timers.target" ];
        timerConfig = {
          OnCalendar = cfg.backup.at;
          Persistent = true;
        };
      };
    };
  };
}
