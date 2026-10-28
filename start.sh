#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
npm --prefix gateway install --no-audit --no-fund
exec node gateway/index.js
