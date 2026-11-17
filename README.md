> El código es MIT; el texto y las explicaciones son CC BY-SA 4.0.

# estructura-typescript

**Una plantilla de TypeScript para Node que se clona, corre a la primera y arranca con lo mismo que
compila**: un `main.ts` delgado, los módulos importados por un nombre que entienden TypeScript y Node,
el código y las pruebas compilados por separado, y nada más hasta que haga falta.

Es una **semilla**, no un molde completo: trae una funcionalidad real de punta a punta (una línea de
comandos que revisa si otros servicios responden por HTTP), sus pruebas y un CI que comprueba una
frontera que el compilador no vigila: lo que solo declara `tsconfig.json`, Node no lo ve. Lo demás
crece cuando duela, y la sección [«Cómo crece»](#cómo-crece-cuándo-agregar-cada-cosa) dice cuándo.

Es parte de la serie «La estructura de un proyecto», de Hábil. El ejemplo es el `revisor` del
[curso de TypeScript](https://www.habil.mx/es/cursos/typescript/).

---

## Córrelo

Necesitas Node 26.13 o más nuevo (`node --version`), que ya trae `npm`, más Git y `bash`. Node 26 es
la línea LTS más reciente; con ella se probó la plantilla.

- **Linux Mint 22**: no uses `apt install nodejs`. Mint 22 se basa en Ubuntu 24.04, que trae Node
  18.19, y con él las pruebas de esta plantilla no corren: `Could not find '…/test/**/*.test.ts'`
  (medido). Instala Node con `nvm`, como dice su README:

  ```bash
  sudo apt install curl
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
  ```

  Abre otra terminal (en la misma, `nvm` todavía no se encuentra; medido) y pide la línea 26:

  ```bash
  nvm install 26
  node --version
  ```

  La [lección 1 del curso de TypeScript](https://www.habil.mx/es/cursos/typescript/01-instalacion/) lo
  explica paso a paso. Si `node` contesta `error while loading shared libraries: libatomic.so.1`,
  falta un paquete del sistema: `sudo apt install libatomic1`. Pasó en un contenedor `ubuntu:24.04`
  recién creado (medido); en un Mint de escritorio no se ha probado.
- **macOS**: lo mismo, con `nvm`. El guion de la frontera funciona con el bash que trae el sistema
  (`/bin/bash`, la versión 3.2), y el CI lo comprueba en una Mac.
- **Si ya tienes `nvm`**: `nvm install 26`.
- **¿Vienes del [curso de TypeScript](https://www.habil.mx/es/cursos/typescript/) con Node 24?** La
  plantilla corre (medido con 24.22.0 y 25.2.1), pero `npm ci` avisa `npm warn EBADENGINE`: no es la
  versión que `package.json` declara. Instala la 26 junto a la que ya tienes con `nvm install 26`; para
  volver a la 24 en otra terminal, `nvm use 24`.
- **Windows**: usa WSL; el guion de la frontera pide `bash`.

**1. Instala las dependencias**, exactamente las de `package-lock.json`:

```bash
npm ci
```

Son dos, y las dos de desarrollo: el compilador (`typescript`) y los tipos de Node (`@types/node`). El
programa compilado no necesita ninguna.

**2. Corre las pruebas**:

```bash
npm test
```

Hace tres cosas, en orden: compila `src/` a `dist/`, revisa los tipos de `test/` contra lo compilado
y corre las pruebas. La salida cierra con el informe; éstas son las líneas que importan:

```
ℹ tests 46
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
```

Son 46 pruebas. Cuéntalas en esas líneas, no en el código de salida: con un patrón que no encuentra
ningún archivo, `node --test` sale con `0` y `ℹ tests 0` (medido). Y una prueba que agota su tiempo
cuenta como `cancelled`, no como `fail`.

**3. Comprueba la frontera**:

```bash
bash herramientas/probar-frontera.sh
```

Termina en `✅ frontera: se sostiene` (más abajo se explica qué hace).

**4. Úsalo.** Lee `servicios.json` de la carpeta actual:

```bash
npm start
```

Lo que contestó el 17-nov-2026 (los tiempos cambian, y los dos primeros salen `ARRIBA` solo si tienes
internet):

```
SERVICIO            ESTADO  TIEMPO  DETALLE
nodejs.org          ARRIBA   292ms  200
typescriptlang.org  ARRIBA    57ms  200
no-existe           CAIDO        —  no se pudo conectar

3 servicios · 2 arriba · 0 lentos · 1 caído
```

Sale con código `1` porque uno está caído (`node dist/main.js; echo $?`). Los códigos son tres: `0`
todo arriba, `1` alguno lento o caído, `2` no se pudo revisar (opciones inválidas o configuración
rota). También: `node dist/main.js --formato json`, `--config otra.json`, `--paralelo 10`, `--version`
y `--help`.

---

## Qué es cada carpeta y por qué existe

```
estructura-typescript/
├── package.json                 el paquete: "type", "imports", versión de Node, scripts
├── package-lock.json            las versiones exactas con que se probó: se versiona
├── tsconfig.json                LA BASE: lo que comparten el código y las pruebas. Solo revisa
├── tsconfig.build.json          la construcción: la base, más «escribe dist/»
├── servicios.json               el ejemplo que usa «Córrelo»
├── src/
│   ├── main.ts                  EL PROGRAMA: opciones, llamada a los módulos, código de salida
│   ├── servicio.ts              el vocabulario: Servicio, Estado, Resultado. Sin red ni archivos
│   ├── config.ts                lee y valida servicios.json
│   ├── revisar.ts               consulta muchos servicios a la vez, con tiempo límite
│   └── reporte.ts               tabla para personas, JSON para programas
├── test/
│   ├── tsconfig.json            las pruebas se revisan aparte, contra lo compilado
│   ├── *.test.ts                una por módulo, más programa.test.ts, que ejecuta dist/main.js
│   └── comun/servidor.ts        el servidor HTTP de prueba que comparten dos de ellas
├── herramientas/
│   └── probar-frontera.sh       demuestra que un alias de tsconfig.json compila y no arranca
├── .github/workflows/verificar.yml
└── dist/                        lo compilado: lo crea «npm run build», no se versiona
```

**`package.json`.** Tres decisiones que no son de TypeScript, sino de Node. `"type": "module"` dice
que los `.js` de este paquete son módulos ECMAScript. `"engines"` declara el mínimo de Node que esta
plantilla soporta; si tu Node es más viejo, `npm` normalmente solo avisa. Las versiones con que de
verdad se probó están en [«Versiones»](#versiones). Y `"imports"` les pone nombre a los módulos:

```json
"imports": {
  "#config": "./dist/config.js",
  "#reporte": "./dist/reporte.js",
  "#revisar": "./dist/revisar.js",
  "#servicio": "./dist/servicio.js"
}
```

Con eso, `main.ts` escribe `import { revisarTodos } from "#revisar"`. Node lee ese campo al arrancar
y carga `dist/revisar.js`. TypeScript lee el mismo campo al compilar y, como `tsconfig.json` declara
`rootDir` y `outDir`, sabe que `dist/revisar.js` saldrá de `src/revisar.ts` y revisa contra el
fuente. Un solo nombre, declarado en un solo lugar, que entienden los dos. Los nombres tienen que
empezar con `#`: así los pide Node. Es la salida estándar cuando quieres un alias privado que
funcione en Node sin un cargador ni un empaquetador; no es la única forma de importar. Entre archivos
vecinos, una ruta relativa con `.js` sigue siendo lo más simple, y así lo hace `src/`.

**`tsconfig.json`, la base.** Decide cómo TypeScript revisa y emite el programa (emitir: escribir los
archivos de `dist/`); no configura al Node que lo ejecuta. Son seis decisiones: `module: nodenext`
(TypeScript sigue las reglas de módulos de Node al revisar y al emitir: busca cada import como lo
buscaría Node y decide si cada archivo sale como módulo ECMAScript o como CommonJS; no instala ni
configura nada en el Node que corre el programa), `target` (qué JavaScript sale), `strict`, `types`
(con TypeScript 6 o más nuevo, los tipos de Node hay que pedirlos), y `rootDir` con `outDir` (de
dónde sale y a dónde va lo compilado). Trae `noEmit: true`: quien lo usa solo revisa. Es el archivo
que abre el editor para `src/`.

**`tsconfig.build.json`.** Hereda la base con `extends` y cambia dos cosas: sí escribe (`noEmit:
false`) y escribe también las declaraciones (`declaration: true`), los `.d.ts` que dicen qué tipos
exporta cada módulo. Como la base solo incluye `src/`, **en `dist/` no cae ni una prueba**.

**`test/tsconfig.json`.** Hereda la misma base, pero es otro programa: incluye solo `test/` y nunca
escribe. Las pruebas importan `#reporte`, igual que `main.ts`; al revisarlas, TypeScript llega a
`dist/reporte.d.ts`. Ven lo mismo que vería cualquiera que use lo compilado, y nada de `src/`. Por
eso `npm run check` construye primero. Trae tres opciones más. `allowImportingTsExtensions`, porque
Node va a cargar esos `.ts` directo y los imports entre ellos llevan `.ts`; TypeScript solo la
permite cuando no se escribe JavaScript, y aquí la base trae `noEmit`. `erasableSyntaxOnly` y
`verbatimModuleSyntax`, que la documentación de Node recomienda, para que `tsc` vigile que las
pruebas solo usen lo que Node puede quitar. Esa documentación recomienda además
`rewriteRelativeImportExtensions`; aquí no hace falta, porque este programa no emite archivos de
prueba y no hay salida que reescribir.

**¿Por qué no un solo `tsconfig.json` para todo?** Medido en un proyecto de tres archivos, con
`"include": ["src", "test"]`:

- Con `rootDir: ./src`, no compila: `error TS6059: File '…/test/reporte.test.ts' is not under
  'rootDir'`.
- Sin `rootDir`, compila, pero la salida cambia de forma: `dist/src/main.js` y
  `dist/test/reporte.test.js`. Las pruebas viajan en lo que se entrega, y `node dist/main.js`
  contesta `Error: Cannot find module '…/dist/main.js'`.
- Y `src/main.ts` puede importar un archivo de `test/` sin que nadie se queje. Con el `tsconfig` de
  construcción aparte, ese import da `TS6059`.

**`src/main.ts`.** Delgado a propósito: lee las opciones con `parseArgs`, de la biblioteca de Node,
llama a los módulos, imprime y decide el código de salida. Si algo de ahí merece una prueba propia,
ya no pertenece ahí.

**Los imports de `src/`.** Dos formas, y cada una dice algo. Entre vecinos, la ruta relativa **con
`.js`**: `import { clasificar } from "./servicio.js"`, aunque el archivo se llame `servicio.ts`. Se
escribe la extensión del archivo que Node va a cargar, porque esta plantilla no activa
`rewriteRelativeImportExtensions` y TypeScript deja tal cual lo que va entre comillas. Sin la
extensión, `error TS2835: Relative import paths need explicit file extensions` (medido).
Desde el programa y desde las pruebas, el nombre con `#`.

**`src/servicio.ts`.** El dominio. No importa a ningún otro módulo del proyecto, y todos los demás lo
importan a él.

**`src/revisar.ts`.** La consulta concurrente, con el `fetch` de Node, hasta `--paralelo` a la vez.
Cada consulta tiene **un tiempo límite que cubre todo**: la conexión, los encabezados y el cuerpo. Lee
como mucho 64 KiB del cuerpo y deja de leer. Y **ningún detalle de error repite la URL**: se mira el
código del error, nunca su texto, y se traduce a frases fijas. Cada una de esas protecciones tiene su
prueba.

**`src/reporte.ts`.** La URL de cada servicio sale **sin usuario, contraseña, query string ni
fragmento**: lo que sale en un reporte termina en bitácoras ajenas. La función que limpia la URL,
`urlPublica`, no lleva `export`: fuera de su módulo no existe. Se prueba por lo que promete, a través
de `json`.

**`src/config.ts`.** Lo que llega de un archivo es `unknown` hasta que se revisa. Rechaza un campo
desconocido (`tiemout`), un nombre repetido, un esquema que no sea `http` o `https`, una URL con
credenciales (`https://usuario:clave@...`) y un tiempo límite fuera de 1 a 60,000 ms. Ningún error
repite la URL, y el texto del error de `JSON.parse` nunca se imprime: cita un pedazo del archivo.

**`test/`.** Node corre estos `.ts` directo, quitándoles los tipos, sin compilarlos a JavaScript. Por
eso aquí los imports relativos llevan `.ts` (`./comun/servidor.ts`): es el archivo que Node va a
cargar. Las pruebas de red usan un servidor HTTP de prueba en `127.0.0.1`, en un puerto libre: no
salen a internet. `programa.test.ts` ejecuta `dist/main.js` en otro proceso: es la única que ve si
Node encuentra cada módulo al arrancar.

**`test/comun/servidor.ts` y el patrón del script.** `npm test` corre `node --test
"test/**/*.test.ts"`. El patrón no sobra: sin él, Node corre como prueba todo archivo que esté bajo
una carpeta `test/`, y el servidor de ayuda sale en el informe como una prueba más: `✔
test/comun/servidor.ts` y `ℹ tests 47` (medido).

**`package-lock.json`.** Se versiona. Con él, `npm ci` instala en cada máquina y en el CI las mismas
versiones con que se probó la plantilla, y nunca lo modifica.

---

## La frontera que sabe fallar

`herramientas/probar-frontera.sh` trabaja en una copia temporal del proyecto (tu carpeta no se toca).
Compila y arranca el mismo programa dos veces. Entre las dos solo cambia cómo importa `main.ts` el
módulo `revisar`, y quién declara ese nombre.

1. **Control**, con el proyecto tal como está: `main.ts` importa `#revisar`, que declara
   `package.json`. Tiene que compilar y arrancar. Si no, el experimento está mal montado, o tu
   proyecto ya trae un import que Node no resuelve, y el guion para en rojo.
2. **Violación**: se siembra el alias `@/revisar` en `"paths"` de `tsconfig.json` y `main.ts` lo
   importa. Tiene que **compilar**, con el alias tal cual en `dist/main.js`, y tiene que **no
   arrancar**, por la razón exacta: `ERR_MODULE_NOT_FOUND`.

Ésta es la salida real:

```
1/2 control: el proyecto tal como está; main.ts importa «#revisar», que package.json sí declara
   ✅ compiló y arrancó (revisor 0.1.0): Node encontró el módulo
2/2 violación: el mismo import, como «@/revisar», declarado solo en tsconfig.json
   ✅ tsc compiló sin una queja y dejó el alias tal cual en dist/main.js
     Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/revisar' imported from …/dist/main.js
   ✅ Node no arrancó: lo que solo declara tsconfig.json, Node no lo ve
✅ frontera: se sostiene
```

Si algún día algo hace que Node sí encuentre el alias (un cargador en `NODE_OPTIONS`, por ejemplo),
sale `❌ ARRANCÓ: Node encontró «@/revisar» sin que package.json lo declare. La frontera no existe.`
Si la violación no compila, o falla por otra razón, también sale en rojo. Y «arrancó» se lee de lo
que el programa imprime (`revisor 0.1.0`), no solo de su código de salida.

**Rómpelo tú.** Siembra el alias en tu copia del proyecto:

```bash
sed -i.bak 's|"outDir": "./dist",|"outDir": "./dist", "paths": { "@/*": ["./src/*.ts"] },|' tsconfig.json
sed -i.bak 's|from "#revisar"|from "@/revisar"|' src/main.ts
npm run build
node dist/main.js --version
```

`npm run build` termina sin un solo error. `node` contesta:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/revisar' imported from …/dist/main.js
```

Declarar `"@/revisar"` en `"imports"` de `package.json` tampoco alcanza: Node solo busca ahí los
nombres que empiezan con `#` (el mismo error, medido). Y el guion de la frontera se pone en rojo en
el control: `❌ el control NO arrancó`.

**Regresa solo lo que tocaste.** El experimento cambia tres archivos. Primero mira qué cambió en
ellos:

```bash
git diff -- tsconfig.json src/main.ts package.json
```

Si solo ves lo que sembraste, regresa esos tres archivos, y ninguno más:

```bash
git restore tsconfig.json src/main.ts package.json
bash herramientas/probar-frontera.sh
git status --short
```

La frontera vuelve a `✅ frontera: se sostiene`, y `git status` enseña lo único que queda: las copias
`src/main.ts.bak` y `tsconfig.json.bak` que dejó `sed`. Consérvalas hasta que estés seguro de que no
las necesitas y bórralas una por una con `rm -i src/main.ts.bak tsconfig.json.bak`, que pregunta
antes de cada una. No uses un comando que limpie toda la carpeta: se llevaría también tus notas. Lo
más cómodo es practicar en un clon que solo uses para esto.

---

## Qué NO trae y por qué

| No trae | Por qué |
|---|---|
| `paths` en `tsconfig.json` | No cambia lo que `tsc` escribe: sirve para avisarle a TypeScript de un alias que otra herramienta resuelve. Aquí no hay otra herramienta |
| `baseUrl`, `moduleResolution: node` | TypeScript 7 los retiró: `error TS5102` y `error TS5108` (medido) |
| Empaquetador (bundler) | El programa corre en Node tal como sale de `tsc`. Ver «Cómo crece» |
| `tsx`, `ts-node`, Jest, Vitest | Node 26 ya corre las pruebas y los `.ts` que solo llevan tipos. Cero dependencias que mantener |
| ESLint, Prettier | Son del proyecto que nazca de aquí, con sus propias reglas. El curso de TypeScript los monta en la lección 7 |
| Project references | Con dos programas chicos, correr `tsc` dos veces alcanza. Ver «Cómo crece» |
| `utils.ts`, `helpers.ts`, `common.ts` | Un nombre que no dice qué hay adentro se vuelve el cajón donde cae todo. Cada módulo se llama por lo que hace |
| `export` de más | Lo que no lleva `export` se puede cambiar sin revisar quién lo usa |
| Base de datos, Docker, logging configurable | Fuera del ejemplo. Ver «Cómo crece» |

---

## Cómo crece: cuándo agregar cada cosa

| Cuando… | Agrega… | Y deja… |
|---|---|---|
| Un módulo crece y mezcla dos temas | dos módulos con nombre de lo que hacen (`src/notificar.ts`) y su renglón en `"imports"` | sin `utils.ts` |
| La lista de `"imports"` se vuelve larga, o hay subcarpetas | un patrón: `"#/*": "./dist/*.js"`, y se importa `#/notificar/correo`. Pide Node 24.14 o más nuevo y TypeScript 6 o más nuevo | un solo lugar donde se declaran los nombres |
| Correr `tsc` dos veces ya se siente lento | project references: `composite` en el código, `references` en las pruebas y `tsc -b` | un `tsconfig` por ambiente |
| Hay código para otro ambiente (navegador, un worker) | otro `tsconfig` para él: uno solo no puede describir dos ambientes | la base compartida |
| De verdad necesitas un alias que Node no entiende | la herramienta que lo resuelva al correr (un empaquetador), y entonces sí `paths`, para avisarle a TypeScript | la frontera, que te dirá que ya no aplica |
| Publicas el paquete en npm | `"exports"` y `"files"` en `package.json` | `"imports"` para lo interno |
| Quieres estilo y formato vigilados | ESLint y Prettier, con su paso en el CI | — |
| Guardas estado en una base de datos | un módulo que hable con la base | `servicio.ts` sin SQL |
| Se necesita un contenedor | un `Dockerfile` que copie `dist/` y `package.json`: sin `package.json`, Node no encuentra los nombres con `#` | `node_modules` fuera: el programa no tiene dependencias de ejecución |

Regla para decidir: **una carpeta o un archivo de configuración nuevo tiene que resolver un problema
que ya tienes**. Si no puedes decir cuál, todavía no lo necesitas.

---

## Cómo quitar el ejemplo

El `revisor` está para demostrar la estructura. Para empezar tu propio proyecto:

1. En `package.json`, cambia `name` y `description`.
2. Borra `servicio.ts`, `config.ts`, `revisar.ts`, `reporte.ts` y `servicios.json`, y sus renglones
   en `"imports"`. Escribe tus módulos con la misma forma: un archivo por módulo, su renglón en
   `"imports"` y su archivo de pruebas en `test/`.
3. Deja `main.ts` delgado: opciones, llamada a los módulos, código de salida.
4. Reescribe las pruebas de `test/` para tus módulos; cambia el servidor de `test/comun/` por las
   ayudas que necesites, o bórralo.
5. En `herramientas/probar-frontera.sh`, cambia `bueno` y `alias_sembrado` por un módulo tuyo.
6. Corre `npm test && bash herramientas/probar-frontera.sh`.
7. Reescribe este README. El código y `LICENSE` son MIT; si conservas el texto de los `.md`, mira
   `LICENSE-CONTENIDO.md`.

---

## Versiones

Medidas el 17 de noviembre de 2026.

| Pieza | Versión |
|---|---|
| Node | `"engines": ">=26.13.0"`, la primera LTS de la línea 26. Probado con 26.13.1, la LTS más reciente ese día, y con 26.13.0, en macOS arm64 (con el `/bin/bash` 3.2 del sistema) y en Linux arm64 (contenedor `ubuntu:24.04`). Linux x86-64 todavía no se ha probado |
| TypeScript | 7.0.2, fija en `package-lock.json`. Es el compilador nuevo: no acepta `baseUrl` ni `moduleResolution: node` |
| Dependencias | Dos, de desarrollo: `typescript` 7.0.2 y `@types/node` 26.6.6. De ejecución, ninguna |
| CI | GitHub Actions: `actions/checkout@v7` y `actions/setup-node@v7`, con la LTS más reciente y con 26.13.0 en Linux, y la LTS en macOS con `/bin/bash`; corre en cada cambio, a mano y cada lunes. GitHub apaga la corrida de los lunes si el repositorio público pasa 60 días sin actividad |

---

## Licencia

El código es [MIT](LICENSE). El texto y las explicaciones son
[CC BY-SA 4.0](LICENSE-CONTENIDO.md).
