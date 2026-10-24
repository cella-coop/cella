{
  description = "Cella: an ERP for member-governed organisations";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      each = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

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

      # cella runs from the checkout it is called in: cargo rebuilds it after
      # a change and execs it directly otherwise.
      wrapper = pkgs: pkgs.writeShellApplication {
        name = "cella";
        runtimeInputs = toolchain pkgs;
        text = ''
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
