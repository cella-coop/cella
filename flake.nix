{
  description = "Cella: a cooperative workspace for member-governed organisations";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      each = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # DuckDB 2.0 LTS, which nixpkgs does not carry yet: the release's CLI,
      # run through the Nix loader, since patchelf leaves it segfaulting, and
      # the extensions the analytics shell loads, `quack` (its server),
      # `httpfs` (the crypto quack serves with) and `postgres_scanner` (its
      # attach to the scope's database), fetched here so the shell never
      # downloads one.
      # The extensions stay as signed: each needs only what the CLI has
      # loaded. The shell finds them by `CELLA_DUCKDB_EXTENSIONS`.
      duckdb2 = pkgs:
        let
          version = "2.0.0";
          arch = { x86_64-linux = "amd64"; aarch64-linux = "arm64"; }.${pkgs.stdenv.hostPlatform.system};
          hashes = {
            amd64 = {
              cli = "1g6j5rjjyq04ya96yyp1q06z4ics8rl27n6v2dh3qygpp8374l66";
              quack = "1zh042mphwznz9ch90s8vxy1cpfph2mpjidsd9aggw7fw39c19gr";
              postgres_scanner = "0ksm7qpmzfbrwxqh23q7vjsdln771ryn1cc6k11zm7zwr98xgcsl";
              httpfs = "0glfxd3nvaynidigwnva97hdqpdmk116n5gnddpipnm5c1z7sv7f";
            };
            arm64 = {
              cli = "1zj8cdvlnk097xsqr9hd6a1ay53s8dhi11zq9fxmyld9s9sii7l5";
              quack = "01b0xl4ylvpq2pcfq4lcgwsbmcd9qhx41in9rhk81zxr3shkhycz";
              postgres_scanner = "12p51hfra8xrprq99kf8xdgd288alzdfwvgrw71f8qcbg6yz5rxg";
              httpfs = "0hxxmzk2riw2z01nahnbf4pb3ifsxrdyvxx8qk3c0k6pqy7qh97m";
            };
          }.${arch};
          extension = name: pkgs.fetchurl {
            url = "https://extensions.duckdb.org/v${version}/linux_${arch}/${name}.duckdb_extension.gz";
            sha256 = hashes.${name};
          };
        in
        pkgs.stdenv.mkDerivation {
          pname = "duckdb";
          inherit version;
          src = pkgs.fetchurl {
            url = "https://github.com/duckdb/duckdb/releases/download/v${version}/duckdb-cli-linux-${arch}.tar.gz";
            sha256 = hashes.cli;
          };
          sourceRoot = ".";
          dontStrip = true;
          dontPatchELF = true;
          installPhase = ''
            install -Dm755 duckdb $out/libexec/duckdb
            mkdir -p $out/bin
            cat > $out/bin/duckdb <<SH
            #!${pkgs.runtimeShell}
            exec ${pkgs.stdenv.cc.bintools.dynamicLinker} --library-path ${pkgs.stdenv.cc.cc.lib}/lib --argv0 duckdb $out/libexec/duckdb "\$@"
            SH
            chmod +x $out/bin/duckdb
            dir=$out/share/duckdb/extensions/v${version}/linux_${arch}
            mkdir -p $dir
            gunzip -c ${extension "quack"} > $dir/quack.duckdb_extension
            gunzip -c ${extension "postgres_scanner"} > $dir/postgres_scanner.duckdb_extension
            gunzip -c ${extension "httpfs"} > $dir/httpfs.duckdb_extension
          '';
        };

      toolchain = pkgs: with pkgs; [
        cargo
        rustc
        clippy
        rustfmt
        cargo-pgrx
        nodejs
        pnpm
        typescript
        postgresql_18
        postgresql_18.pg_config
        postgresql_18.dev
        (duckdb2 pkgs)
        sops
      ];

      # pgrx's bindgen: libclang, and the libc headers its search path lacks
      # on Nix, borrowed from the clang wrapper as bindgenHook does. PGRX_HOME
      # lives in the checkout; its config is rewritten only on change, since
      # pgrx-pg-sys rebuilds when it is touched.
      pgrx = pkgs: root: ''
        export LIBCLANG_PATH="${pkgs.llvmPackages.libclang.lib}/lib"
        export PGRX_PG_CONFIG_PATH="${pkgs.postgresql_18.pg_config}/bin/pg_config"
        BINDGEN_EXTRA_CLANG_ARGS="$(< ${pkgs.clang}/nix-support/libc-cflags) $(< ${pkgs.clang}/nix-support/cc-cflags)"
        export BINDGEN_EXTRA_CLANG_ARGS
        export PGRX_HOME="${root}/.pgrx"
        mkdir -p "$PGRX_HOME"
        config=$(printf '[configs]\npg18 = "%s"\n' "$PGRX_PG_CONFIG_PATH")
        if [ "$(cat "$PGRX_HOME/config.toml" 2>/dev/null)" != "$config" ]; then
          echo "$config" > "$PGRX_HOME/config.toml"
        fi
      '';

      # The browsers the e2e scenarios drive, from nixpkgs' playwright-driver,
      # whose version is the shell's playwright-core's.
      browsers = pkgs: pkgs.playwright-driver.browsers;

      lib = nixpkgs.lib;
      cargoToml = file: (builtins.fromTOML (builtins.readFile file)).package;

      # The Rust workspace alone, its manifests and every `rs/` package under
      # apps/ (the workspace's `apps/**/rs`), so a change elsewhere never
      # rebuilds the extension or the CLI.
      rsDirs =
        let
          walk = dir:
            lib.concatLists (lib.mapAttrsToList
              (name: type:
                if type != "directory" || builtins.elem name [ "ts" "sql" "node_modules" "fixtures" "_tests" "_e2e" ] then [ ]
                else if name == "rs" && builtins.pathExists (dir + "/rs/Cargo.toml") then [ (dir + "/rs") ]
                else walk (dir + "/${name}"))
              (builtins.readDir dir));
        in
        walk ./apps;
      rustSrc = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.unions ([ ./Cargo.toml ./Cargo.lock ] ++ rsDirs);
      };
      # The extension's: the workspace without the CLI's code, only its
      # manifest, so a change to the CLI never rebuilds the notary; its
      # targets are stubbed empty for cargo to load the workspace.
      pgSrc = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.unions ([ ./Cargo.toml ./Cargo.lock ./apps/org/rs/Cargo.toml ]
          ++ lib.filter (d: d != ./apps/org/rs) rsDirs);
      };

      # The notary's version before this one: the one its upgrade script
      # in `rs/sql/` updates from.
      notaryPrevious =
        let
          version = (cargoToml ./apps/org/core/notary/rs/Cargo.toml).version;
          froms = lib.concatMap
            (name: let m = builtins.match "cella--(.*)--${lib.escapeRegex version}\\.sql" name; in if m == null then [ ] else m)
            (builtins.attrNames (builtins.readDir ./apps/org/core/notary/rs/sql));
        in
        builtins.head froms;

      # The notary as a Postgres 18 extension: the shared library cargo-pgrx
      # builds in the sandbox, its control file and its SQL, with every
      # script of the notary's `rs/sql/` beside the one pgrx generates, as
      # `cella ext build` stages them, so an earlier version installs from
      # its own script and every upgrade path is there. Laid out as
      # `postgresql.withPackages` takes an extension.
      cellaPg = pkgs: pkgs.buildPgrxExtension {
        pname = "cella";
        inherit (cargoToml ./apps/org/core/notary/rs/Cargo.toml) version;
        src = pgSrc;
        cargoLock.lockFile = ./Cargo.lock;
        postPatch = ''
          mkdir -p apps/org/rs/src
          touch apps/org/rs/src/lib.rs apps/org/rs/src/main.rs
        '';
        inherit (pkgs) cargo-pgrx;
        postgresql = pkgs.postgresql_18;
        buildAndTestSubdir = "apps/org/core/notary/rs";
        # Its tests run on a cluster pgrx makes: `cella test notary`.
        doCheck = false;
        postInstall = ''
          cp apps/org/core/notary/rs/sql/*.sql $out/share/postgresql/extension/
        '';
        meta.description = "The cella Postgres extension: the notary and the guard primitives";
      };

      # The cella CLI's binary, built once, as a host runs it.
      cellaCli = pkgs: pkgs.rustPlatform.buildRustPackage {
        pname = "cella-cli";
        version = (builtins.fromTOML (builtins.readFile ./Cargo.toml)).workspace.package.version;
        src = rustSrc;
        cargoLock.lockFile = ./Cargo.lock;
        cargoBuildFlags = [ "-p" "cella-cli" ];
        # Its tests need the dev cluster: `cella test cli`.
        doCheck = false;
      };

      # The org app's source as a host runs it: the npm workspace, the
      # tree's TypeScript and SQL, the fixtures and the e2e stories a seed
      # plays, and the tools; never the Rust, the secrets, the research or
      # the corpus.
      orgSrc = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.difference
          (lib.fileset.unions [
            ./Cargo.toml
            ./package.json
            ./pnpm-lock.yaml
            ./pnpm-workspace.yaml
            ./tsconfig.json
            ./apps
            ./packages
            ./tools
          ])
          (lib.fileset.unions rsDirs);
      };

      # The org app as one derivation: the shell built with adapter-node,
      # its node modules, the tree it migrates and seeds from, and the
      # cella CLI, which runs from it as from a checkout already built
      # (`CELLA_PACKAGE`), with Postgres's client binaries, node and DuckDB
      # with the extensions the analytics shell loads. `cella-server` runs
      # the built shell as `cella serve --prod` does. No key, session key
      # or database is in it: those are the host's.
      cellaOrg = pkgs:
        let
          cli = cellaCli pkgs;
          duckdb = duckdb2 pkgs;
          runtime = [ pkgs.nodejs pkgs.postgresql_18 duckdb pkgs.coreutils pkgs.procps ];
        in
        pkgs.stdenv.mkDerivation (finalAttrs: {
          pname = "cella-org";
          inherit (cli) version;
          src = orgSrc;
          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit (finalAttrs) pname version src;
            fetcherVersion = 4;
            hash = "sha256-Eh40tEiSUlscPO62mOH1WsRhII802k1UUMfX+vJhcGQ=";
          };
          nativeBuildInputs = [ pkgs.nodejs pkgs.pnpm pkgs.pnpmConfigHook pkgs.makeWrapper ];
          buildPhase = ''
            runHook preBuild
            (cd apps/org/ts && pnpm exec vite build)
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p $out/share $out/bin
            cp -r . $out/share/cella
            makeWrapper ${cli}/bin/cella $out/bin/cella \
              --set CELLA_PACKAGE $out/share/cella \
              --set CELLA_DUCKDB_EXTENSIONS ${duckdb}/share/duckdb/extensions \
              --unset CELLA_DEV \
              --prefix PATH : ${lib.makeBinPath runtime}
            makeWrapper ${pkgs.nodejs}/bin/node $out/bin/cella-server \
              --add-flags $out/share/cella/apps/org/ts/build \
              --set-default HOST 127.0.0.1 \
              --set-default PORT 3000 \
              --set-default PROTOCOL_HEADER x-forwarded-proto \
              --set-default BODY_SIZE_LIMIT 11M \
              --set CELLA_DUCKDB_EXTENSIONS ${duckdb}/share/duckdb/extensions \
              --unset CELLA_DEV
            runHook postInstall
          '';
          passthru = { inherit cli; };
          meta.mainProgram = "cella";
        });

      # cella runs from the checkout it is called in: cargo rebuilds it after
      # a change and execs it directly otherwise.
      wrapper = pkgs: pkgs.writeShellApplication {
        name = "cella";
        runtimeInputs = toolchain pkgs;
        text = ''
          export PLAYWRIGHT_BROWSERS_PATH=''${PLAYWRIGHT_BROWSERS_PATH:-${browsers pkgs}}
          export CELLA_DUCKDB_EXTENSIONS=${duckdb2 pkgs}/share/duckdb/extensions
          root=''${CELLA_ROOT:-}
          if [ -z "$root" ]; then
            dir=$PWD
            while [ "$dir" != / ] && ! { [ -f "$dir/apps/org/feat.toml" ] && [ -f "$dir/Cargo.toml" ]; }; do
              dir=$(dirname "$dir")
            done
            if [ "$dir" = / ]; then
              echo "cella: no cella workspace here or above" >&2
              exit 1
            fi
            root=$dir
          fi
          ${pgrx pkgs "$root"}
          exec cargo run -q --manifest-path "$root/Cargo.toml" -p cella-cli -- "$@"
        '';
      };
    in
    {
      packages = each (pkgs: rec {
        cella = wrapper pkgs;
        duckdb = duckdb2 pkgs;
        cella-pg = cellaPg pkgs;
        cella-org = cellaOrg pkgs;
        default = cella;
      });

      apps = each (pkgs: {
        cella = {
          type = "app";
          program = "${self.packages.${pkgs.stdenv.hostPlatform.system}.cella}/bin/cella";
        };
      });

      devShells = each (pkgs: {
        default = pkgs.mkShell {
          packages = toolchain pkgs ++ [ pkgs.rust-analyzer self.packages.${pkgs.stdenv.hostPlatform.system}.cella ];

          shellHook = ''
            export CELLA_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
            export PLAYWRIGHT_BROWSERS_PATH=${browsers pkgs}
            export CELLA_DUCKDB_EXTENSIONS=${duckdb2 pkgs}/share/duckdb/extensions
            ${pgrx pkgs "$CELLA_ROOT"}
          '';
        };
      });

      checks = each (pkgs: {
        # The org app as a host starts it, in the sandbox: Postgres 18 with
        # `cella-pg` and keys `cella key init` makes, a scope's database
        # migrated by `cella migrate --url`, then the built server started
        # by `cella-server` as `cella_app`, whose sign-in page it reads,
        # offering no one: its one way in is Link device.
        cella-org = pkgs.runCommand "cella-org-check" {
          nativeBuildInputs = [ (pkgs.postgresql_18.withPackages (_: [ (cellaPg pkgs) ])) (cellaOrg pkgs) pkgs.curl ];
        } ''
          export HOME=$TMPDIR PGDATA=$TMPDIR/pg PGHOST=$TMPDIR PGUSER=postgres
          cella key init $TMPDIR/notary.key > /dev/null
          cella key init --vault $TMPDIR/vault.key > /dev/null
          initdb -A trust -U postgres > /dev/null
          cat >> $PGDATA/postgresql.conf <<CONF
          shared_preload_libraries = 'cella'
          listen_addresses = '''
          unix_socket_directories = '$TMPDIR'
          cella.key_file = '$TMPDIR/notary.key'
          cella.vault_key_file = '$TMPDIR/vault.key'
          CONF
          pg_ctl -w -l $TMPDIR/log start > /dev/null
          createdb scope
          cd $TMPDIR
          cella migrate --url "postgresql://postgres@/scope?host=$TMPDIR"
          PORT=3000 PGDATABASE=scope PGUSER=cella_app \
            cella-server > $TMPDIR/server.log 2>&1 &
          for _ in $(seq 100); do
            curl -sf http://127.0.0.1:3000/sign-in -o $TMPDIR/sign-in.html && break
            sleep 0.2
          done
          kill %1
          pg_ctl -w stop > /dev/null
          grep -q 'Link device' $TMPDIR/sign-in.html || {
            cat $TMPDIR/server.log
            sed 's/<[^>]*>/ /g' $TMPDIR/sign-in.html | tr -s ' \n' | head -c 2000
            exit 1
          }
          if grep -q 'Fixture members\|Demo members' $TMPDIR/sign-in.html; then
            echo "a production build's sign-in offers someone"; exit 1
          fi
          echo "the built server, on a migrated scope, serves a sign-in offering no one" > $out
        '';

        # The extension as a host loads it: Postgres 18 with `cella-pg`
        # preloaded makes it at its default version and reads the verdict
        # date; a second database makes it at the version before and
        # updates it, as a scope upgrades by its upgrade script.
        cella-pg = pkgs.runCommand "cella-pg-check" {
          nativeBuildInputs = [ (pkgs.postgresql_18.withPackages (_: [ (cellaPg pkgs) ])) ];
        } ''
          export PGDATA=$TMPDIR/pg PGHOST=$TMPDIR PGUSER=postgres
          initdb -A trust -U postgres > /dev/null
          cat >> $PGDATA/postgresql.conf <<CONF
          shared_preload_libraries = 'cella'
          listen_addresses = '''
          unix_socket_directories = '$TMPDIR'
          CONF
          pg_ctl -w -l $TMPDIR/log start > /dev/null
          q() { psql -X -q -t -A -v ON_ERROR_STOP=1 "$@"; }
          q -d postgres -c "CREATE EXTENSION cella"
          version=$(q -d postgres -c "SELECT extversion FROM pg_extension WHERE extname = 'cella'")
          [ "$version" = "${(cellaPg pkgs).version}" ] || { echo "cella is at $version"; exit 1; }
          q -d postgres -c "SELECT cella.verdict_date()"
          createdb upgraded
          q -d upgraded -c "CREATE EXTENSION cella VERSION '${notaryPrevious}'" -c "ALTER EXTENSION cella UPDATE"
          updated=$(q -d upgraded -c "SELECT extversion FROM pg_extension WHERE extname = 'cella'")
          [ "$updated" = "$version" ] || { echo "cella updated to $updated, not $version"; exit 1; }
          pg_ctl -w stop > /dev/null
          echo "cella $version loads, and updates from ${notaryPrevious}" > $out
        '';

        # The feat check's tree, without its SQL boundaries, which need the
        # npm install: `cella check feats --no-sql`, the one part of `cella
        # check` that runs in the sandbox. Per-feat checks, each built from
        # its own directory and its ancestors' cores (lib.fileset), join
        # this once feats hold code.
        feat-check = pkgs.runCommand "feat-check" {
          nativeBuildInputs = [ pkgs.nodejs pkgs.cargo ];
        } ''
          export HOME=$TMPDIR
          cp -r ${self} src && chmod -R u+w src
          # The tabs check parses TypeScript: its parser comes from the npm
          # install the built app already holds.
          ln -s ${cellaOrg pkgs}/share/cella/node_modules src/node_modules
          node src/tools/feat-check.mjs --no-sql src
          touch $out
        '';

        # The module run in a VM: a coop's scope, a demo's, and a demo
        # serving each visitor a copy of their own (nix/test.nix).
        module = import ./nix/test.nix { inherit self pkgs; kind = "scope"; };
        demo = import ./nix/test.nix { inherit self pkgs; kind = "demo"; };
        visitors = import ./nix/test.nix { inherit self pkgs; kind = "visitors"; };
      });

      # services.cella: a host's scopes, each a database on its Postgres 18
      # with the notary preloaded, its setup, its analytics shell and its
      # server, and a nightly backup ([packaging](_corpus/doc/operations.md#packaging)).
      nixosModules = rec {
        cella = import ./nix/module.nix { inherit self; };
        default = cella;
      };
    };
}
