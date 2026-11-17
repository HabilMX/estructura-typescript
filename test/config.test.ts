// Pruebas de config.ts: qué acepta, qué rechaza y qué NO repite en sus errores.

import assert from "node:assert/strict";
import test from "node:test";

import { desdeTexto, ErrorConfig, leer } from "#config";

/** El mensaje del ErrorConfig que lanza ese texto. */
function errorDe(texto: string): string {
  try {
    desdeTexto(texto);
  } catch (error: unknown) {
    assert.ok(error instanceof ErrorConfig, "debe lanzar ErrorConfig");
    return error.message;
  }
  return assert.fail("debió rechazar la configuración");
}

test("lee una lista y pone el tiempo por omisión", () => {
  const servicios = desdeTexto(
    '[{"nombre":"pagos","url":"https://pagos.ejemplo.com/salud","timeoutMs":500},' +
      '{"nombre":"catalogo","url":"http://catalogo.ejemplo.com"}]',
  );
  assert.deepEqual(servicios, [
    { nombre: "pagos", url: "https://pagos.ejemplo.com/salud", timeoutMs: 500 },
    { nombre: "catalogo", url: "http://catalogo.ejemplo.com", timeoutMs: 2000 },
  ]);
});

test("un campo mal escrito es un error", () => {
  assert.equal(
    errorDe('[{"nombre":"a","url":"https://a.ejemplo.com","tiemout":5}]'),
    "servicio 1: campo desconocido «tiemout»",
  );
});

test("un campo desconocido raro no se repite", () => {
  const error = errorDe('[{"nombre":"a","url":"https://a.ejemplo.com","https://x?token=SECRETO":1}]');
  assert.equal(error, "servicio 1: tiene un campo desconocido");
});

test("una lista vacía es un error", () => {
  assert.equal(errorDe("[]"), "la lista de servicios está vacía");
});

test("la forma equivocada se explica", () => {
  assert.equal(errorDe('{"nombre":"a"}'), "el archivo debe ser una lista de servicios");
  assert.equal(errorDe('["pagos"]'), "servicio 1: debe ser un objeto con nombre y url");
});

test("un nombre repetido es un error", () => {
  assert.equal(
    errorDe('[{"nombre":"a","url":"https://a.ejemplo.com"},{"nombre":"a","url":"https://b.ejemplo.com"}]'),
    "servicio 2: el nombre «a» está repetido",
  );
});

test("rechaza un esquema que no es http", () => {
  assert.equal(
    errorDe('[{"nombre":"a","url":"ftp://a.ejemplo.com"}]'),
    "servicio 1: la url debe empezar con http:// o https://",
  );
});

test("rechaza una url sin esquema sin repetirla", () => {
  const error = errorDe('[{"nombre":"a","url":"usuario:clave@a.ejemplo.com/salud?token=SECRETO"}]');
  assert.ok(!error.includes("SECRETO") && !error.includes("clave"), error);
});

test("una url ilegible no se repite", () => {
  const error = errorDe('[{"nombre":"a","url":"no es una url ?token=SECRETO"}]');
  assert.equal(error, "servicio 1: la url no es válida; debe empezar con http:// o https://");
});

test("rechaza credenciales sin repetirlas", () => {
  const error = errorDe('[{"nombre":"pagos","url":"https://usuario:clave@pagos.ejemplo.com"}]');
  assert.equal(error, "servicio 1: la url no debe llevar usuario o contraseña");
});

test("un error de tipo no repite el valor", () => {
  const error = errorDe('[{"nombre":"a","url":"https://a.ejemplo.com","timeoutMs":"https://x?token=SECRETO"}]');
  assert.ok(!error.includes("SECRETO"), error);
  assert.match(error, /^servicio 1: timeoutMs debe ser un número entero/);
});

test("un error de sintaxis no cita el archivo", () => {
  const error = errorDe('[{"nombre":"a","url":"https://a.ejemplo.com?token=SECRETO" "timeoutMs":5}]');
  assert.equal(error, "el archivo no es JSON válido");
});

test("rechaza tiempos fuera de rango", () => {
  for (const malo of ["0", "60001", "-1", "1.5"]) {
    const error = errorDe(`[{"nombre":"a","url":"https://a.ejemplo.com","timeoutMs":${malo}}]`);
    assert.match(error, /timeoutMs debe ser un número entero de 1 a 60000 milisegundos$/, malo);
  }
});

test("acepta los extremos del rango", () => {
  for (const bueno of [1, 60000]) {
    const [servicio] = desdeTexto(`[{"nombre":"a","url":"https://a.ejemplo.com","timeoutMs":${bueno}}]`);
    assert.equal(servicio?.timeoutMs, bueno);
  }
});

test("un archivo que no existe dice cuál", async () => {
  await assert.rejects(leer("archivo-que-no-existe.json"), {
    name: "ErrorConfig",
    message: "no se pudo leer archivo-que-no-existe.json: no existe",
  });
});
