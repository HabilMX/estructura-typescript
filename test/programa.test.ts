// Pruebas del programa de punta a punta: se ejecuta dist/main.js como lo haría
// cualquiera, con el mismo Node que corre estas pruebas.
//
// Aquí se ve lo que ninguna revisión de tipos ve: si Node encuentra o no cada
// módulo al arrancar.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

import { servidor, type ServidorDePrueba } from "./comun/servidor.ts";

const programa = fileURLToPath(new URL("../dist/main.js", import.meta.url));

let local: ServidorDePrueba;
let carpeta: string;
before(async () => {
  local = await servidor();
  carpeta = await mkdtemp(join(tmpdir(), "revisor-"));
});
after(async () => {
  await local.cerrar();
  await rm(carpeta, { recursive: true, force: true });
});

interface Corrida {
  readonly codigo: number | null;
  readonly salida: string;
  readonly error: string;
}

/** Ejecuta el programa en otro proceso y espera a que termine. */
function revisor(...argumentos: string[]): Promise<Corrida> {
  // Se lanza sin bloquear (spawn, no spawnSync): el servidor de prueba vive en
  // este mismo proceso y tiene que seguir atendiendo mientras el hijo corre.
  return new Promise((listo, fallo) => {
    const hijo = spawn(process.execPath, [programa, ...argumentos]);
    let salida = "";
    let error = "";
    hijo.stdout.on("data", (trozo) => (salida += String(trozo)));
    hijo.stderr.on("data", (trozo) => (error += String(trozo)));
    hijo.on("error", fallo);
    hijo.on("close", (codigo) => listo({ codigo, salida, error }));
  });
}

async function archivo(nombre: string, servicios: unknown): Promise<string> {
  const ruta = join(carpeta, `${nombre}.json`);
  await writeFile(ruta, JSON.stringify(servicios));
  return ruta;
}

test("todo arriba sale con cero y tabla", async () => {
  const ruta = await archivo("sano", [
    { nombre: "catalogo", url: `http://${local.direccion}/ok` },
    { nombre: "pagos", url: `http://${local.direccion}/ok` },
  ]);
  const r = await revisor("--config", ruta);
  assert.equal(r.codigo, 0, r.salida + r.error);
  assert.ok(r.salida.startsWith("SERVICIO"), r.salida);
  assert.ok(r.salida.endsWith("2 servicios · 2 arriba · 0 lentos · 0 caídos\n"), r.salida);
});

test("uno caído sale con uno", async () => {
  const ruta = await archivo("caido", [
    { nombre: "bien", url: `http://${local.direccion}/ok` },
    { nombre: "mal", url: `http://${local.direccion}/error` },
  ]);
  const r = await revisor("--config", ruta);
  assert.equal(r.codigo, 1, r.salida + r.error);
  assert.ok(r.salida.includes("CAIDO") && r.salida.includes("500"), r.salida);
});

test("el json es JSON y sin secretos", async () => {
  const ruta = await archivo("json", [
    { nombre: "catalogo", url: `http://${local.direccion}/ok?token=SECRETO` },
  ]);
  const r = await revisor("--config", ruta, "--formato", "json");
  const valor = JSON.parse(r.salida);
  assert.equal(valor.servicios[0].url, `http://${local.direccion}/ok`);
  assert.ok(!r.salida.includes("SECRETO"), r.salida);
  assert.equal(r.codigo, 0);
});

test("un archivo que no existe sale con dos y dice cuál", async () => {
  const r = await revisor("--config", "archivo-que-no-existe.json");
  assert.equal(r.codigo, 2, r.error);
  assert.equal(r.error, "revisor: no se pudo leer archivo-que-no-existe.json: no existe\n");
});

test("credenciales en la url salen con dos sin repetirlas", async () => {
  const ruta = await archivo("credenciales", [
    { nombre: "pagos", url: "https://usuario:clave@pagos.ejemplo.com" },
  ]);
  const r = await revisor("--config", ruta);
  assert.equal(r.codigo, 2, r.error);
  assert.ok(r.error.includes("usuario o contraseña"), r.error);
  assert.ok(!r.error.includes("clave@"), r.error);
});

test("paralelo cero y formato raro salen con dos", async () => {
  assert.equal((await revisor("--paralelo", "0")).codigo, 2);
  assert.equal((await revisor("--formato", "xml")).codigo, 2);
});

test("un argumento de más sale con dos sin repetirlo", async () => {
  const r = await revisor("https://pagos.ejemplo.com/salud?token=SECRETO");
  assert.equal(r.codigo, 2);
  assert.equal(r.error, "revisor: opciones no reconocidas; prueba con --help\n");
});

test("version dice la de package.json", async () => {
  const paquete = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const r = await revisor("--version");
  assert.equal(r.salida, `revisor ${paquete.version}\n`);
  assert.equal(r.codigo, 0);
});
