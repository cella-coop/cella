{
  description = "Cella: an ERP for member-governed organisations";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      each = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = each (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            cargo
            rustc
            clippy
            rustfmt
            rust-analyzer
            cargo-pgrx
            nodejs
            pnpm
            typescript
            postgresql_18
            postgresql_18.pg_config
            postgresql_18.dev
            just
          ];

          # pgrx's bindgen: libclang, and the libc headers its search path
          # lacks on Nix, borrowed from the clang wrapper as bindgenHook does.
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";
          PGRX_PG_CONFIG_PATH = "${pkgs.postgresql_18.pg_config}/bin/pg_config";

          shellHook = ''
            root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
            export BINDGEN_EXTRA_CLANG_ARGS="$(< ${pkgs.clang}/nix-support/libc-cflags) $(< ${pkgs.clang}/nix-support/cc-cflags)"
            export PGRX_HOME="$root/.pgrx"
            mkdir -p "$PGRX_HOME"
            # Rewritten only on change: pgrx-pg-sys rebuilds when it is touched.
            config=$(printf '[configs]\npg18 = "%s"\n' "$PGRX_PG_CONFIG_PATH")
            if [ "$(cat "$PGRX_HOME/config.toml" 2>/dev/null)" != "$config" ]; then
              echo "$config" > "$PGRX_HOME/config.toml"
            fi
          '';
        };
      });

      # Per-feat checks, each built from its own directory and its
      # ancestors' cores (lib.fileset), join this once feats hold code.
      checks = each (pkgs: {
        feat-check = pkgs.runCommand "feat-check" {
          nativeBuildInputs = [ pkgs.nodejs pkgs.cargo ];
        } ''
          export HOME=$TMPDIR
          cp -r ${self} src && chmod -R u+w src
          node src/tools/feat-check.mjs src
          touch $out
        '';
      });
    };
}
