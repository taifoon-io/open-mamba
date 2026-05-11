#!/usr/bin/env bash
#
# open-mamba — one-line installer
# Usage:   curl -fsSL https://open-mamba.dev/install.sh | sh
#
# Detects platform, downloads the matching pre-built binary from the latest
# GitHub Release, drops it into /usr/local/bin (or $HOME/.local/bin if the
# former isn't writable), and symlinks the `mamba` wrapper next to it.
#
# Honors:
#   OPEN_MAMBA_VERSION    pin a specific version (default: latest)
#   OPEN_MAMBA_PREFIX     install prefix (default: /usr/local or ~/.local)
#   OPEN_MAMBA_NO_WRAPPER skip the `mamba` wrapper symlink

set -eu

REPO="yawningmonsoon/open-mamba"
VERSION="${OPEN_MAMBA_VERSION:-latest}"

# ── Platform detection ────────────────────────────────────────────────────────
OS=""
ARCH=""
case "$(uname -s)" in
  Linux*)   OS="unknown-linux-gnu" ;;
  Darwin*)  OS="apple-darwin"      ;;
  *) echo "open-mamba: unsupported OS '$(uname -s)' — please build from source: https://github.com/${REPO}#install"; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64)  ARCH="x86_64"  ;;
  arm64|aarch64) ARCH="aarch64" ;;
  *) echo "open-mamba: unsupported arch '$(uname -m)' — please build from source: https://github.com/${REPO}#install"; exit 1 ;;
esac

TARGET="${ARCH}-${OS}"

# ── Resolve version ──────────────────────────────────────────────────────────
if [ "$VERSION" = "latest" ]; then
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | sed -n 's/.*"tag_name": *"\(v[^"]*\)".*/\1/p' | head -n 1)"
  if [ -z "$VERSION" ]; then
    echo "open-mamba: could not resolve latest version from GitHub. Pin one with OPEN_MAMBA_VERSION=v0.1.0"
    exit 1
  fi
fi

ASSET="open-mamba-${VERSION}-${TARGET}.tar.gz"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"

# ── Pick a writable prefix ────────────────────────────────────────────────────
PREFIX="${OPEN_MAMBA_PREFIX:-}"
if [ -z "$PREFIX" ]; then
  if [ -w "/usr/local/bin" ] || ([ -d "/usr/local/bin" ] && [ "$(id -u)" = "0" ]); then
    PREFIX="/usr/local"
  else
    PREFIX="$HOME/.local"
  fi
fi
BIN_DIR="${PREFIX}/bin"
mkdir -p "$BIN_DIR"

# ── Download + extract ───────────────────────────────────────────────────────
echo "open-mamba: downloading ${VERSION} (${TARGET})…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! curl -fsSL "$URL" -o "${TMP}/open-mamba.tar.gz"; then
  echo "open-mamba: download failed — ${URL}"
  echo "  Releases: https://github.com/${REPO}/releases"
  exit 1
fi
tar -xzf "${TMP}/open-mamba.tar.gz" -C "$TMP"

# Expected layout in the tarball:
#   open-mamba          (the engine binary)
#   scripts/mamba       (the friendly wrapper)
install -m 0755 "${TMP}/open-mamba" "${BIN_DIR}/open-mamba"
if [ -z "${OPEN_MAMBA_NO_WRAPPER:-}" ] && [ -f "${TMP}/scripts/mamba" ]; then
  install -m 0755 "${TMP}/scripts/mamba" "${BIN_DIR}/mamba"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo
echo "  ✓ installed open-mamba ${VERSION} → ${BIN_DIR}/open-mamba"
[ -f "${BIN_DIR}/mamba" ] && echo "  ✓ installed wrapper        → ${BIN_DIR}/mamba"
echo
case ":$PATH:" in
  *":${BIN_DIR}:"*) ;;
  *) echo "  ⚠ ${BIN_DIR} is not on your PATH. Add this to your shell rc:"; echo "      export PATH=\"${BIN_DIR}:\$PATH\""; echo ;;
esac
echo "  → Boot the bus:    mamba up"
echo "  → Open the console: open http://localhost:1337"
echo "  → Docs:            https://open-mamba.dev/docs"
echo
