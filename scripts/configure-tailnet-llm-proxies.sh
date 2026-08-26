#!/usr/bin/env bash
set -euo pipefail

readonly CADDYFILE=/etc/caddy/Caddyfile
readonly CADDY_ENVFILE=/etc/caddy/cloudflare.env
readonly OLLAMA_OVERRIDE_DIR=/etc/systemd/system/ollama.service.d
readonly OLLAMA_OVERRIDE="$OLLAMA_OVERRIDE_DIR/mythweavers-origin.conf"
readonly HOSTNAME=write.mythweavers.home.serial-experiments.com

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this script with sudo: sudo bash $0" >&2
  exit 1
fi

python3 - "$CADDYFILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
block = """https://write.mythweavers.home.serial-experiments.com:11434 {
\timport accesslog
\treverse_proxy 127.0.0.1:11434
}

https://write.mythweavers.home.serial-experiments.com:12434 {
\timport accesslog
\treverse_proxy 127.0.0.1:12434
}
"""

if "https://write.mythweavers.home.serial-experiments.com:11434" in text:
    print("Caddy provider proxies already present")
else:
    path.write_text(text.rstrip() + "\n\n" + block)
    print("Added Caddy provider proxies")
PY

install -d "$OLLAMA_OVERRIDE_DIR"
printf '%s\n' \
  '[Service]' \
  "Environment=\"OLLAMA_ORIGINS=https://$HOSTNAME\"" \
  > "$OLLAMA_OVERRIDE"

caddy validate --config "$CADDYFILE" --envfile "$CADDY_ENVFILE"
systemctl reload caddy
systemctl daemon-reload
systemctl restart ollama

curl --fail --silent --show-error \
  -H "Origin: https://$HOSTNAME" \
  "https://$HOSTNAME:11434/api/version"
printf '\n'
curl --fail --silent --show-error \
  -H "Origin: https://$HOSTNAME" \
  "https://$HOSTNAME:12434/health"
printf '\n'

echo "Tailnet LLM proxies configured and verified"
