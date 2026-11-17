// Pruebas de servicio.ts. No abren conexiones ni leen archivos.
//
// El módulo se importa por «#servicio», igual que lo importa main.ts: Node lo
// resuelve con "imports" de package.json y carga dist/servicio.js. Estas
// pruebas ejercitan lo que se compiló, no una copia.

import assert from "node:assert/strict";
import test from "node:test";

import { clasificar, todosArriba, UMBRAL_LENTO_MS, type Estado, type Resultado } from "#servicio";

function resultado(estado: Estado): Resultado {
  return {
    servicio: { nombre: "pagos", url: "https://pagos.ejemplo.com", timeoutMs: 2000 },
    estado,
    tiempoMs: 10,
    detalle: "200",
  };
}

test("sin código está caído", () => {
  assert.equal(clasificar(null, 10), "CAIDO");
  assert.equal(clasificar(null, null), "CAIDO");
});

test("un 4xx o 5xx está caído aunque sea rápido", () => {
  assert.equal(clasificar(404, 10), "CAIDO");
  assert.equal(clasificar(500, 10), "CAIDO");
});

test("el 400 exacto ya está caído", () => {
  assert.equal(clasificar(399, 10), "ARRIBA");
  assert.equal(clasificar(400, 10), "CAIDO");
});

test("una redirección cuenta como respuesta", () => {
  assert.equal(clasificar(301, 10), "ARRIBA");
});

test("el umbral exacto ya es lento", () => {
  assert.equal(clasificar(200, UMBRAL_LENTO_MS - 1), "ARRIBA");
  assert.equal(clasificar(200, UMBRAL_LENTO_MS), "LENTO");
});

test("todosArriba solo si ninguno está lento ni caído", () => {
  assert.equal(todosArriba([resultado("ARRIBA")]), true);
  assert.equal(todosArriba([resultado("ARRIBA"), resultado("LENTO")]), false);
  assert.equal(todosArriba([resultado("CAIDO")]), false);
});
