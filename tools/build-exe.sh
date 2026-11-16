#!/usr/bin/env bash
# ==========================================================================
# tools/build-exe.sh — gera o executável do Kydra.
#
#   dist/win/kydra.exe          → app Windows (janela/bandeja, assets embutidos)
#   dist/linux/kydra-linux-x64  → mesma coisa no Linux, para testar o servidor
#                                 embutido sem Windows (o código do servidor é
#                                 o mesmo; só a bandeja é Win32)
#
# Requisitos
#   Node 20+   (embute os assets e ajusta o cabeçalho PE)
#   zig 0.13+  (no PATH, ou `pip install --break-system-packages ziglang`)
#
# Uso
#   tools/build-exe.sh              # Windows + Linux de teste
#   tools/build-exe.sh --win-only   # só o .exe
# ==========================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
WIN_ONLY=0
[ "${1:-}" = "--win-only" ] && WIN_ONLY=1

# --- localizar o zig ------------------------------------------------------
ZIG="${ZIG:-}"
if [ -z "$ZIG" ]; then
  if command -v zig >/dev/null 2>&1; then
    ZIG="$(command -v zig)"
  else
    ZIG="$(python3 -c "import ziglang,os;print(os.path.join(os.path.dirname(ziglang.__file__),'zig'))" 2>/dev/null || true)"
  fi
fi
[ -x "${ZIG:-}" ] || {
  echo "erro: zig não encontrado. Instale com 'apt install zig' ou 'pip install --break-system-packages ziglang'." >&2
  exit 1
}
ZIGLIB="$(dirname "$ZIG")/lib"
MINGW_INC="$ZIGLIB/libc/mingw/include"
WINSDK_INC="$ZIGLIB/libc/include/any-windows-any"
echo "zig $("$ZIG" version) em $ZIG"

VERSION="$(node -p "require('./package.json').version")"
mkdir -p dist/win dist/linux native/lib/win

# --- 1. assets embutidos --------------------------------------------------
echo "→ embutindo a interface (index.html + src/ + assets/)…"
node tools/gen-assets.mjs

# --- 2. import library do UCRT (uma vez) ----------------------------------
# O zig não traz o stub library do CRT; geramos do .def do mingw com dlltool.
if [ ! -f native/lib/win/libucrtbase.a ]; then
  echo "→ gerando import library do UCRT…"
  TMP="$(mktemp -d)"
  cp "$ZIGLIB/libc/mingw/lib-common/ucrtbase.def.in" \
     "$ZIGLIB/libc/mingw/lib-common/ucrtbase-common.def.in" \
     "$ZIGLIB/libc/mingw/def-include/"*.def.in "$TMP/"
  ( cd "$TMP" && cpp -P -I. -DUCRTBASE ucrtbase.def.in -o ucrtbase.def 2>/dev/null )
  "$ZIG" dlltool -d "$TMP/ucrtbase.def" -l native/lib/win/libucrtbase.a -m i386:x86-64
  rm -rf "$TMP"
fi

# --- 3. recursos (ícone + versão) -----------------------------------------
if [ -f native/win/kydra.rc ] && [ -f native/win/kydra.ico ]; then
  echo "→ compilando recursos (ícone, versão)…"
  ( cd native/win && "$ZIG" rc kydra.rc kydra.res )
else
  echo "aviso: sem native/win/kydra.rc — o .exe fica com o ícone padrão"
fi

# --- 4. Windows -----------------------------------------------------------
rm -f dist/win/kydra.exe dist/linux/kydra-linux-x64
echo "→ compilando Windows x64…"
RES=""
[ -f native/win/kydra.res ] && RES="native/win/kydra.res"

"$ZIG" cc -target x86_64-windows-gnu -O2 \
  -I native/src -I "$MINGW_INC" -I "$WINSDK_INC" \
  -o dist/win/kydra.exe native/src/main.c native/src/server_core.c native/src/server_platform.c $RES \
  -L native/lib/win -lucrtbase \
  -lkernel32 -luser32 -lshell32 -lws2_32 -ladvapi32

node tools/pe-subsystem.mjs dist/win/kydra.exe 2

# --- 5. Linux de teste ----------------------------------------------------
if [ "$WIN_ONLY" -eq 0 ]; then
  echo "→ compilando Linux x64 (teste do servidor embutido)…"
  "$ZIG" cc -target x86_64-linux-gnu -O2 \
    -I native/src \
    -o dist/linux/kydra-linux-x64 \
    native/src/posix_main.c native/src/server_core.c native/src/server_platform.c
fi

# --- 6. pasta de distribuição --------------------------------------------
echo "→ organizando a pasta dist/…"
node tools/package-dist.mjs

echo
echo
find dist -type f | sort | sed 's|^|  |'
echo
echo "pronto. Windows: dist/win/kydra.exe"
