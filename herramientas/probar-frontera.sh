#!/usr/bin/env bash
# La frontera que sabe fallar: comprueba que un alias declarado SOLO en
# tsconfig.json compila, pero Node no lo encuentra al arrancar.
#
# Qué hace, en una COPIA temporal del proyecto (tu carpeta no se toca):
#
#   Compila y arranca el MISMO programa dos veces. Entre las dos solo cambia
#   cómo importa main.ts el módulo revisar, y quién declara ese nombre.
#
#   1. CONTROL. Con el proyecto tal como está: main.ts importa «#revisar», que
#      declara el campo "imports" de package.json. Tiene que compilar Y
#      arrancar. Si no, el experimento está mal montado (no corriste npm ci, el
#      import cambió de nombre) o tu proyecto ya trae un import que Node no
#      resuelve, y el paso 2 no probaría nada: se para en rojo.
#   2. VIOLACIÓN. Se siembra el alias «@/revisar» en "paths" de tsconfig.json y
#      main.ts lo importa. Tiene que COMPILAR (tsc lo acepta, y deja el alias
#      tal cual en dist/main.js) y tiene que NO ARRANCAR, por la razón exacta:
#      «ERR_MODULE_NOT_FOUND: Cannot find package '@/revisar'». Si arranca, la
#      frontera no existe. Si no compila, o falla por otra cosa, tampoco
#      demuestra nada. En los tres casos sale en rojo.
#
# Uso:  bash herramientas/probar-frontera.sh   → sale 0 si la frontera se sostiene
#
# Por qué así: un experimento que solo espera un rojo se pone «verde» también
# cuando falla por la razón equivocada. Lo impiden tres cosas: el control
# demuestra que el programa compila y arranca cuando el nombre lo declara
# package.json; la violación exige que tsc termine bien, que el alias siga
# escrito en lo compilado y el código de error exacto de Node; y «arrancó» se
# lee de lo que el programa imprime, no solo de su código de salida.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
bueno="#revisar"
alias_sembrado="@/revisar"
esperado="Cannot find package '${alias_sembrado}' imported from"

# «pwd -P» da la ruta física: en macOS la carpeta temporal vive detrás de un
# enlace (/var → /private/var) y Node escribe la física en sus errores.
tmp="$(cd "$(mktemp -d)" && pwd -P)"
# Al salir se borra la copia, y el código de salida se conserva. Con el bash
# 3.2 que trae macOS, si el guion se corta por una variable sin definir
# (set -u), la trampa recibe un 0 en «$?»: sin la bandera «terminado», un
# guion cortado a la mitad saldría 0, un falso verde. Por eso, si no llegó al
# final, sale 1 aunque «$?» diga 0.
salir() {
  local codigo=$?
  rm -rf "$tmp"
  if [ "$codigo" -eq 0 ] && [ "${terminado:-}" != 1 ]; then
    echo "❌ el guion se cortó antes de terminar" >&2
    codigo=1
  fi
  exit "$codigo"
}
trap salir EXIT

if [ ! -x "$raiz/node_modules/.bin/tsc" ]; then
  echo "❌ falta node_modules/.bin/tsc: corre «npm ci» antes de este guion"
  exit 1
fi

# La copia lleva todo menos lo instalado, lo compilado y la historia de git. Lo
# instalado se enlaza: es el mismo compilador, fijado por package-lock.json.
copia="$tmp/copia"
mkdir -p "$copia"
(cd "$raiz" && tar --exclude=./node_modules --exclude=./dist --exclude=./.git -cf - .) |
  (cd "$copia" && tar -xf -)
ln -s "$raiz/node_modules" "$copia/node_modules"

# Compila con el tsconfig de construcción. Deja la salida en $1.
compilar() { (cd "$copia" && rm -rf dist && node_modules/.bin/tsc -p tsconfig.build.json >"$1" 2>&1); }
# Arranca lo compilado, como en producción: node, sin nada más. Deja la salida en $1.
arrancar() { (cd "$copia" && node dist/main.js --version >"$1" 2>&1); }
# Muestra un registro sin la ruta de la carpeta temporal, que cambia en cada
# corrida, y sin el rastro interno de Node (las líneas «at …»).
mostrar() { grep -v '^    at ' "$1" | sed -e "s#$copia#…#g" -e 's/^/     /' | head -n 25; }

# ${bueno} va con llaves: sin ellas, el bash 3.2 de macOS lee el primer byte
# de la comilla de cierre como parte del nombre de la variable.
echo "1/2 control: el proyecto tal como está; main.ts importa «${bueno}», que package.json sí declara"
if ! compilar "$tmp/control-tsc.log"; then
  echo "❌ el control NO compiló; el experimento está mal montado:"
  mostrar "$tmp/control-tsc.log"
  exit 1
fi
if ! arrancar "$tmp/control-node.log" || ! grep -E -q '^revisor [0-9]' "$tmp/control-node.log"; then
  echo "❌ el control NO arrancó: el programa, tal como está, no corre con node:"
  mostrar "$tmp/control-node.log"
  exit 1
fi
if ! grep -F -q "from \"${bueno}\"" "$copia/src/main.ts"; then
  echo "❌ src/main.ts ya no importa «${bueno}»; el experimento está mal montado"
  exit 1
fi
echo "   ✅ compiló y arrancó ($(head -n 1 "$tmp/control-node.log")): Node encontró el módulo"

echo "2/2 violación: el mismo import, como «${alias_sembrado}», declarado solo en tsconfig.json"
sed 's|"outDir": "./dist",|"outDir": "./dist", "paths": { "@/*": ["./src/*.ts"] },|' \
  "$raiz/tsconfig.json" >"$copia/tsconfig.json"
sed "s|from \"${bueno}\"|from \"${alias_sembrado}\"|" "$raiz/src/main.ts" >"$copia/src/main.ts"
if ! grep -F -q '"paths"' "$copia/tsconfig.json" ||
  ! grep -F -q "from \"${alias_sembrado}\"" "$copia/src/main.ts"; then
  echo "❌ no se pudo sembrar el alias; el experimento está mal montado"
  exit 1
fi
if ! compilar "$tmp/violacion-tsc.log"; then
  echo "❌ la violación NO compiló: tsc ya no acepta el alias. Esto no demuestra la frontera:"
  mostrar "$tmp/violacion-tsc.log"
  exit 1
fi
if ! grep -F -q "from \"${alias_sembrado}\"" "$copia/dist/main.js"; then
  echo "❌ tsc ya no deja «${alias_sembrado}» tal cual en dist/main.js. Esto no demuestra la frontera."
  exit 1
fi
echo "   ✅ tsc compiló sin una queja y dejó el alias tal cual en dist/main.js"
if arrancar "$tmp/violacion-node.log"; then
  echo "❌ ARRANCÓ: Node encontró «${alias_sembrado}» sin que package.json lo declare. La frontera no existe."
  exit 1
fi
if ! grep -F -q "ERR_MODULE_NOT_FOUND" "$tmp/violacion-node.log" ||
  ! grep -F -q "$esperado" "$tmp/violacion-node.log"; then
  echo "❌ falló, pero NO porque Node no encuentre «${alias_sembrado}». Esto no demuestra la frontera:"
  mostrar "$tmp/violacion-node.log"
  exit 1
fi
grep -F "$esperado" "$tmp/violacion-node.log" | sed -e "s#$copia#…#g" -e 's/^/     /'
echo "   ✅ Node no arrancó: lo que solo declara tsconfig.json, Node no lo ve"
echo "✅ frontera: se sostiene"
terminado=1
