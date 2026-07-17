#!/usr/bin/env bash
# Concatenates the page shell, vendored libraries, and scene source into the
# single self-contained index.html that ships to the browser.
set -euo pipefail
cd "$(dirname "$0")"

{
  cat src/shell-head.html
  printf '<script>\n'
  cat vendor/three.min.js
  cat vendor/OrbitControls.js
  cat src/app.js
  cat src/shell-tail.html
} > index.html

echo "Built index.html ($(wc -c < index.html) bytes)"
