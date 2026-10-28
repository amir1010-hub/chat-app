#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  if [ ! -t 0 ]; then
    echo "Set TELEGRAM_API_ID and TELEGRAM_API_HASH as Codespaces secrets, or run bash start.sh interactively." >&2
    exit 1
  fi
  echo "Telegram app credentials: https://my.telegram.org"
  read -r -p "api_id: " tg_id
  read -r -p "api_hash: " tg_hash
  if [[ ! "$tg_id" =~ ^[0-9]+$ || ! "$tg_hash" =~ ^[0-9a-fA-F]{32}$ ]]; then
    echo "Invalid credentials format." >&2; exit 1
  fi
  umask 077
  printf 'TELEGRAM_API_ID=%s\nTELEGRAM_API_HASH=%s\n' "$tg_id" "$tg_hash" > .env
fi
set -a
# shellcheck source=/dev/null
source .env
set +a
if [[ ! "${TELEGRAM_API_ID:-}" =~ ^[0-9]+$ || ! "${TELEGRAM_API_HASH:-}" =~ ^[0-9a-fA-F]{32}$ ]]; then
  echo "Missing/invalid TELEGRAM_API_ID or TELEGRAM_API_HASH." >&2; exit 1
fi
if [ ! -d telegram-client/.git ]; then
  git clone --no-checkout https://github.com/cozgerest/tg-web-relay.git telegram-client
fi
cd telegram-client
git fetch --depth 1 origin 5341468037ce8ae0760dfe0cb1988e9a814a2e44
git checkout --detach FETCH_HEAD
npm ci --no-audit --no-fund
TELEGRAM_SELF_HOSTED=1 APP_ENV=production npm run build:production
(
  cd server
  npm ci --no-audit --no-fund
  HOST=127.0.0.1 PORT=8080 npm start
) &
relay_pid=$!
cd ..
trap 'kill "$relay_pid" 2>/dev/null || true' EXIT
npm --prefix gateway install --no-audit --no-fund
node gateway/index.js
