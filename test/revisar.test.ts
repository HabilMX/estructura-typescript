// Pruebas de revisar.ts contra un servidor HTTP local: no salen a internet.

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { consultar, revisarTodos, TOPE_LECTURA } from "#revisar";
import type { Resultado, Servicio } from "#servicio";

import { servidor, type ServidorDePrueba } from "./comun/servidor.ts";

let local: ServidorDePrueba;
before(async () => {
  local = await servidor();
});
after(() => local.cerrar());

function servicio(ruta: string, timeoutMs = 2000): Servicio {
  return { nombre: ruta, url: `http://${local.direccion}${ruta}`, timeoutMs };
}

/** Corre la consulta y dice también cuánto tardó de verdad. */
async function cronometrar(s: Servicio): Promise<[Resultado, number]> {
  const inicio = performance.now();
  const r = await consultar(s);
  return [r, performance.now() - inicio];
}

test("un servicio sano sale arriba", async () => {
  const r = await consultar(servicio("/ok"));
  assert.equal(r.estado, "ARRIBA");
  assert.equal(r.detalle, "200");
  assert.equal(typeof r.tiempoMs, "number");
});

test("un 500 está caído con su código", async () => {
  const r = await consultar(servicio("/error"));
  assert.equal(r.estado, "CAIDO");
  assert.equal(r.detalle, "500");
});

test("un servicio lento pero sano sale lento", async () => {
  const r = await consultar(servicio("/lento/1100", 5000));
  assert.equal(r.estado, "LENTO");
  assert.equal(r.detalle, "200");
});

// El «timeout» de estas dos pruebas es su red: si alguien quita el tiempo
// límite de la consulta, la prueba se pone roja en vez de quedarse colgada.
test("el que nunca contesta respeta su tiempo límite", { timeout: 10_000 }, async () => {
  const [r, tardo] = await cronometrar(servicio("/mudo", 300));
  assert.equal(r.estado, "CAIDO");
  assert.equal(r.detalle, "se acabó el tiempo de espera");
  assert.equal(r.tiempoMs, null);
  assert.ok(tardo < 1500, `tardó ${tardo} ms con un límite de 300`);
});

test("el cuerpo a goteo respeta su tiempo límite", { timeout: 10_000 }, async () => {
  const [r, tardo] = await cronometrar(servicio("/goteo", 400));
  assert.equal(r.estado, "CAIDO");
  assert.equal(r.detalle, "se acabó el tiempo de espera");
  assert.ok(tardo < 1500, `tardó ${tardo} ms con un límite de 400`);
});

test("la lectura del cuerpo tiene tope", async () => {
  // El cuerpo de /enorme no se acaba nunca: si no hubiera tope, esta consulta
  // terminaría por tiempo límite y caída. Con tope, contesta 200 y pronto.
  const [r, tardo] = await cronometrar(servicio("/enorme", 5000));
  assert.equal(r.detalle, "200");
  assert.ok(tardo < 2500, `tardó ${tardo} ms en leer ${TOPE_LECTURA} bytes`);
});

test("un puerto cerrado está caído sin repetir la url", async () => {
  const cerrado = await servidor();
  await cerrado.cerrar();
  const r = await consultar({
    nombre: "cerrado",
    url: `http://${cerrado.direccion}/ok?token=SECRETO`,
    timeoutMs: 2000,
  });
  assert.equal(r.estado, "CAIDO");
  assert.equal(r.detalle, "no se pudo conectar");
});

test("revisarTodos respeta el orden de los servicios", async () => {
  const servicios = [servicio("/lento/300"), servicio("/error"), servicio("/ok")];
  const resultados = await revisarTodos(servicios, 3);
  assert.deepEqual(
    resultados.map((r) => [r.servicio.nombre, r.detalle]),
    [
      ["/lento/300", "200"],
      ["/error", "500"],
      ["/ok", "200"],
    ],
  );
});

test("los lentos se esperan en paralelo", async () => {
  const servicios = [servicio("/lento/400"), servicio("/lento/400"), servicio("/lento/400")];
  const inicio = performance.now();
  await revisarTodos(servicios, 3);
  const tardo = performance.now() - inicio;
  assert.ok(tardo < 1000, `tres de 400 ms en paralelo tardaron ${tardo} ms`);
});

test("el tope de paralelo se respeta", async () => {
  // Con un consultor de mentira se cuenta cuántas consultas hay a la vez.
  let abiertas = 0;
  let maximo = 0;
  const contar = async (s: Servicio): Promise<Resultado> => {
    abiertas += 1;
    maximo = Math.max(maximo, abiertas);
    await new Promise((listo) => setTimeout(listo, 20));
    abiertas -= 1;
    return { servicio: s, estado: "ARRIBA", tiempoMs: 20, detalle: "200" };
  };
  const servicios = Array.from({ length: 9 }, (_, i) => servicio(`/ok?n=${i}`));
  const resultados = await revisarTodos(servicios, 2, contar);
  assert.equal(resultados.length, 9);
  assert.equal(maximo, 2);
});

test("paralelo cero cuenta como uno, y uno enorme no truena", async () => {
  const servicios = [servicio("/ok"), servicio("/ok")];
  const detalles = async (paralelo: number): Promise<string[]> =>
    (await revisarTodos(servicios, paralelo)).map((r) => r.detalle);
  assert.deepEqual(await detalles(0), ["200", "200"]);
  assert.deepEqual(await detalles(-3), ["200", "200"]);
  assert.deepEqual(await detalles(2305843009213693952), ["200", "200"]);
  assert.deepEqual(await revisarTodos([], 5), []);
});
