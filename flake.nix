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
            nodejs
            pnpm
            typescript
            postgresql_18
            just
          ];
        };
      });

      # Per-feat checks, each built from its own directory, its ancestors'
      # cores and the libs (lib.fileset), join this once feats hold code.
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
