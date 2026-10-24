#!/usr/bin/env bash
# The browser tests, in nixpkgs' Chromium: playwright-core 1.64.1 matches
# the flake's playwright-driver.browsers. Vite serves the page on 5191.
set -euo pipefail
cd "$(dirname "$0")"
if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  PLAYWRIGHT_BROWSERS_PATH=$(nix build --no-link --print-out-paths --inputs-from ../.. nixpkgs#playwright-driver.browsers)
  export PLAYWRIGHT_BROWSERS_PATH
fi
exec node --test --test-concurrency=1 'e2e/*.test.ts'
