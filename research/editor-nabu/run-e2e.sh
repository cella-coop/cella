#!/usr/bin/env bash
# Runs the browser tests with nixpkgs' Chromium. Needs `nix develop ../..`
# for node and pnpm.
set -euo pipefail
cd "$(dirname "$0")"
PLAYWRIGHT_BROWSERS_PATH=$(nix build --inputs-from ../.. nixpkgs#playwright-driver.browsers --print-out-paths --no-link)
export PLAYWRIGHT_BROWSERS_PATH PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
exec pnpm exec playwright test "$@"
