#!/usr/bin/env bash
# deploy/deploy.sh — build the static site locally, push to the server via
# the stochastic bridge, install/refresh the nginx site, reload nginx.
#
# This script is the canonical deploy path for mamba.taifoon.dev. It is
# idempotent: re-running performs an in-place refresh.
#
# Usage:  ./deploy/deploy.sh [--skip-build] [--skip-cert]
#
# Requires:
#   - bash, curl, jq, tar, base64
#   - The stochastic bridge reachable at $BRIDGE_URL (default below)
#   - For first run: certbot installed on the server (it is)

set -euo pipefail

BRIDGE_URL="${BRIDGE_URL:-https://scanner.taifoon.dev/api/stochastic/exec}"
HOST_NAME="${HOST_NAME:-mamba.taifoon.dev}"
ADMIN_EMAIL="${ADMIN_EMAIL:-maciej@t3rn.io}"
SERVER_ROOT="/opt/mamba-nemotron-agw-adapter"
SITE_OUT_LOCAL="site/out"

bridge() {
  local cmd="$1"
  curl -sS -X POST -H "Content-Type: application/json" \
    -d "$(jq -nc --arg c "$cmd" '{cmd:$c}')" \
    "$BRIDGE_URL"
}

bridge_run() {
  local cmd="$1"
  local label="${2:-$cmd}"
  echo "  ⟶ $label"
  local resp
  resp="$(bridge "$cmd")"
  local ok code out
  ok="$(echo "$resp" | jq -r '.ok')"
  code="$(echo "$resp" | jq -r '.code')"
  out="$(echo "$resp" | jq -r '.output')"
  if [ "$ok" != "true" ] || [ "$code" != "0" ]; then
    echo "    ✘ exit=$code"
    echo "$out" | sed 's/^/    /'
    exit 1
  fi
  if [ -n "$out" ]; then echo "$out" | sed 's/^/    /'; fi
}

skip_build=0
skip_cert=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) skip_build=1 ;;
    --skip-cert)  skip_cert=1 ;;
  esac
done

# ---- 1. Build static site ----
if [ "$skip_build" = "0" ]; then
  echo "▶ build (Next.js static export)"
  pushd site >/dev/null
  npm ci
  npm run build
  popd >/dev/null
fi

if [ ! -d "$SITE_OUT_LOCAL" ]; then
  echo "✘ $SITE_OUT_LOCAL not found — Next.js build did not produce static export. Aborting."
  exit 1
fi

# ---- 2. Tar the build + nginx config + push via bridge ----
echo "▶ packaging artifact"
TARBALL="/tmp/mamba-site-$(date +%s).tgz"
tar -czf "$TARBALL" -C site out -C ../deploy nginx
B64="$(base64 -i "$TARBALL" | tr -d '\n')"
echo "  archive: $TARBALL ($(wc -c < "$TARBALL") bytes)"

echo "▶ ensuring server tree exists"
bridge_run "mkdir -p $SERVER_ROOT/site /var/www/letsencrypt /var/log/nginx" "mkdir -p"

echo "▶ pushing artifact to server"
PUSH_CMD="cat >/tmp/mamba-site.tgz.b64 <<'__EOF__'
$B64
__EOF__
base64 -d /tmp/mamba-site.tgz.b64 > /tmp/mamba-site.tgz && \
rm /tmp/mamba-site.tgz.b64 && \
mkdir -p $SERVER_ROOT/site && \
rm -rf $SERVER_ROOT/site/out.new && \
mkdir -p $SERVER_ROOT/site/out.new && \
tar -xzf /tmp/mamba-site.tgz -C $SERVER_ROOT/site/out.new && \
ls -la $SERVER_ROOT/site/out.new/out | head -10"
bridge_run "$PUSH_CMD" "push + extract"

echo "▶ atomic swap"
bridge_run "rm -rf $SERVER_ROOT/site/out.old; \
            if [ -d $SERVER_ROOT/site/out ]; then mv $SERVER_ROOT/site/out $SERVER_ROOT/site/out.old; fi; \
            mv $SERVER_ROOT/site/out.new/out $SERVER_ROOT/site/out; \
            mkdir -p $SERVER_ROOT/deploy && mv $SERVER_ROOT/site/out.new/nginx $SERVER_ROOT/deploy/nginx; \
            rmdir $SERVER_ROOT/site/out.new" "swap"

# Tarballs from the sandbox preserve the sandbox uid (~6761). nginx runs
# as www-data and can't traverse a directory it has no execute bit on.
# Always re-anchor ownership and ensure dirs have +rx for everyone.
echo "▶ re-anchor ownership for nginx (www-data)"
bridge_run "chown -R root:root $SERVER_ROOT && \
            find $SERVER_ROOT -type d -exec chmod 755 {} \\; && \
            find $SERVER_ROOT -type f ! -perm -u=x -exec chmod 644 {} \\; && \
            chmod +x $SERVER_ROOT/deploy/deploy.sh 2>/dev/null || true && \
            echo OK" "chown + chmod"

# ---- 3. nginx site (HTTP-only first, then certbot --nginx) ----
echo "▶ installing nginx site"
bridge_run "cp $SERVER_ROOT/deploy/nginx/$HOST_NAME /etc/nginx/sites-available/$HOST_NAME && \
            ln -sf /etc/nginx/sites-available/$HOST_NAME /etc/nginx/sites-enabled/$HOST_NAME" "symlink"

if [ "$skip_cert" = "0" ]; then
  echo "▶ checking for existing cert"
  HAVE_CERT="$(bridge "test -f /etc/letsencrypt/live/$HOST_NAME/fullchain.pem && echo yes || echo no" | jq -r '.output' | tr -d '\n')"
  if [ "$HAVE_CERT" != "yes" ]; then
    echo "▶ first-time cert via certbot (webroot)"
    # The site file references the cert paths, so the file will fail nginx -t
    # before the cert exists. Stage a tiny HTTP-only config first, get the cert,
    # then drop the real config in.
    bridge_run "cat >/etc/nginx/sites-available/$HOST_NAME.bootstrap <<'NGINX'
server {
    listen 80;
    server_name $HOST_NAME;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 200 'mamba.taifoon.dev — bootstrap\\n'; add_header Content-Type text/plain; }
}
NGINX
ln -sf /etc/nginx/sites-available/$HOST_NAME.bootstrap /etc/nginx/sites-enabled/$HOST_NAME && \
nginx -t && systemctl reload nginx" "stage bootstrap site"

    bridge_run "certbot certonly --webroot -w /var/www/letsencrypt -d $HOST_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --keep-until-expiring" "certbot"

    bridge_run "ln -sf /etc/nginx/sites-available/$HOST_NAME /etc/nginx/sites-enabled/$HOST_NAME && \
                rm -f /etc/nginx/sites-enabled/$HOST_NAME.bootstrap" "swap to real site"
  else
    echo "  cert already present — skipping certbot"
  fi
fi

# ---- 4. Test + reload ----
echo "▶ nginx -t"
bridge_run "nginx -t 2>&1" "nginx -t"

echo "▶ systemctl reload nginx"
bridge_run "systemctl reload nginx && systemctl is-active nginx" "reload"

# ---- 5. Smoke test ----
echo "▶ smoke test"
bridge_run "curl -sS -o /dev/null -w 'HTTP %{http_code} · %{size_download}B · %{time_total}s\\n' https://$HOST_NAME/" "GET /"
bridge_run "curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' https://$HOST_NAME/install" "GET /install"

echo
echo "✅ Deployed: https://$HOST_NAME/"
