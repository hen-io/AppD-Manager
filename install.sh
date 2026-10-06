#!/usr/bin/env bash

set -Eeuo pipefail

REPO="hen-io/AppD-Manager"
DEST="${APPD_INSTALL_DIR:-$HOME/.local/opt/appd}"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

say() { printf '%s\n' "$*"; }
fail() { say "ERROR: $*" >&2; exit 1; }

usage() {
    say "Usage: install.sh [--uninstall]"
    say ""
    say "Installs AppD-Manager to $DEST, links $BIN_DIR/appd and adds"
    say "AppD-Manager to the system menu. Run it again to reinstall or repair."
    say ""
    say "  --uninstall   remove the program and its menu entries; your apps and"
    say "                their data in ~/.AppD-manager are kept"
    say ""
    say "  APPD_INSTALL_DIR=/some/folder   install there instead"
}

UNINSTALL=0
for arg in "$@"; do
    case "$arg" in
        --uninstall) UNINSTALL=1 ;;
        -h|--help) usage; exit 0 ;;
        *) say "Unknown option: $arg (try --help)" >&2; exit 2 ;;
    esac
done

if (( UNINSTALL )); then
    rm -rf "$DEST"
    [[ -L "$BIN_DIR/appd" ]] && rm -f "$BIN_DIR/appd"
    rm -f "$DESKTOP_DIR"/appd-*.desktop "$DESKTOP_DIR/appdmanager.desktop"
    command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
    say "AppD-Manager is removed. Your apps are still in ~/.AppD-manager."
    exit 0
fi

case "$(uname -m)" in
    x86_64) ARCH=x64 ;;
    aarch64) ARCH=arm64 ;;
    armv7l) ARCH=armv7l ;;
    *) fail "Unsupported architecture $(uname -m)." ;;
esac

if command -v curl >/dev/null; then fetch() { curl -fL --progress-bar -o "$2" "$1"; }
elif command -v wget >/dev/null; then fetch() { wget -q --show-progress -O "$2" "$1"; }
else fail "curl or wget is needed (Fedora: sudo dnf install curl)."; fi
command -v unzip >/dev/null || command -v bsdtar >/dev/null || fail "unzip is needed (Fedora: sudo dnf install unzip, Debian: sudo apt install unzip)."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SRC=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    [[ -f "$here/appd" && -f "$here/resources/app/main.js" ]] && SRC="$here"
fi
if [[ -z "$SRC" ]]; then
    say "Downloading AppD-Manager from github.com/$REPO"
    fetch "https://codeload.github.com/$REPO/tar.gz/HEAD" "$TMP/repo.tar.gz" \
        || fail "Could not download github.com/$REPO (is the repository public?)."
    mkdir "$TMP/repo"
    tar -xzf "$TMP/repo.tar.gz" -C "$TMP/repo" --strip-components=1
    SRC="$TMP/repo"
    [[ -f "$SRC/appd" && -f "$SRC/resources/app/main.js" ]] || fail "The repository holds no AppD-Manager build yet."
fi

ELECTRON="$(tr -d '[:space:]' < "$SRC/resources/app/electron-version")"
VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/resources/app/package.json" | head -1)"
say "Installing AppD-Manager $VERSION to $DEST"

STAGE="$DEST.new"
rm -rf "$STAGE"
mkdir -p "$(dirname "$DEST")"

if [[ -x "$DEST/electron" && "$(tr -d '[:space:]' < "$DEST/version" 2>/dev/null || true)" == "$ELECTRON" ]]; then
    say "Runtime: Electron $ELECTRON is already there"
    cp -a "$DEST" "$STAGE"
    rm -rf "$STAGE/resources/app" "$STAGE/appd"
else
    zip="electron-v$ELECTRON-linux-$ARCH.zip"
    base="https://github.com/electron/electron/releases/download/v$ELECTRON"
    say "Runtime: downloading Electron $ELECTRON (about 120 MB)"
    fetch "$base/$zip" "$TMP/$zip" || fail "Could not download $base/$zip"
    fetch "$base/SHASUMS256.txt" "$TMP/sums" || fail "Could not download the checksums for Electron $ELECTRON."
    want="$(awk -v f="$zip" '{ n = $2; sub(/^\*/, "", n); if (n == f) print $1 }' "$TMP/sums")"
    have="$(sha256sum "$TMP/$zip" | cut -d' ' -f1)"
    [[ -n "$want" && "$want" == "$have" ]] || fail "The Electron download does not match its checksum - try again."
    mkdir -p "$STAGE"
    if command -v unzip >/dev/null; then unzip -q "$TMP/$zip" -d "$STAGE"
    else bsdtar -xf "$TMP/$zip" -C "$STAGE"; fi
    rm -f "$STAGE/resources/default_app.asar"
fi

mkdir -p "$STAGE/resources"
cp -a "$SRC/resources/app" "$STAGE/resources/app"
cp "$SRC/appd" "$STAGE/appd"
chmod 755 "$STAGE/appd"

rm -rf "$DEST"
mv "$STAGE" "$DEST"

mkdir -p "$BIN_DIR"
ln -sfn "$DEST/appd" "$BIN_DIR/appd"

if ! "$DEST/appd" sync; then
    say ""
    say "Installed, but AppD-Manager could not start (see the message above)."
    say "A missing library is the usual reason; on Fedora: sudo dnf install gtk3 nss alsa-lib"
    exit 1
fi

say ""
say "Done. Start AppD-Manager from the system menu, or run: appd"
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) say "($BIN_DIR is not in your PATH; until it is, use $BIN_DIR/appd)" ;;
esac
