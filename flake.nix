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

      # The feat check's tree, without its SQL boundaries, which need the npm
      # install: `cella check feats --no-sql`, the one part of `cella check`
      # that runs in the sandbox. Per-feat checks, each built from its own
      # directory and its ancestors' cores (lib.fileset), join this once
      # feats hold code.
      checks = each (pkgs: {
        feat-check = pkgs.runCommand "feat-check" {
          nativeBuildInputs = [ pkgs.nodejs pkgs.cargo ];
        } ''
          export HOME=$TMPDIR
          cp -r ${self} src && chmod -R u+w src
          node src/tools/feat-check.mjs --no-sql src
          touch $out
        '';
      });
    };
}
