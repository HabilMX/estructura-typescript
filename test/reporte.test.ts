// Pruebas de reporte.ts, por sus dos funciones exportadas: `tabla` y `json`.
//
// La función que limpia la URL no lleva `export`, así que desde aquí no se
// puede importar. Se prueba por lo que promete: que el JSON no lleve secretos.

import assert from "node:assert/strict";
import test from "node:test";

import { json, tabla } from "#reporte";
import type { Estado, Resultado } from "#servicio";

function resultado(
  nombre: string,
  url: string,
  estado: Estado,
  tiempoMs: number | null,
  detalle: string,
): Resultado {
  return { servicio: { nombre, url, timeoutMs: 2000 }, estado, tiempoMs, detalle };
}

function caso(): Resultado[] {
  return [
    resultado("pagos", "https://pagos.ejemplo.com/salud?token=SECRETO", "ARRIBA", 87, "200"),
    resultado("catalogo-central", "http://catalogo.ejemplo.com", "LENTO", 2345, "200"),
    resultado("nómina", "https://nomina.ejemplo.com", "CAIDO", null, "no se pudo conectar"),
  ];
}

function urlEnElJson(url: string): unknown {
  const valor = JSON.parse(json([resultado("x", url, "ARRIBA", 1, "200")]));
  return valor.servicios[0].url;
}

test("la tabla va alineada y cierra con el resumen", () => {
  const esperado = [
    "SERVICIO          ESTADO  TIEMPO  DETALLE",
    "pagos             ARRIBA    87ms  200",
    "catalogo-central  LENTO     2.3s  200",
    "nómina            CAIDO        —  no se pudo conectar",
    "",
    "3 servicios · 1 arriba · 1 lento · 1 caído",
    "",
  ].join("\n");
  assert.equal(tabla(caso()), esperado);
});

test("el tiempo se escribe corto", () => {
  const filas = tabla([
    resultado("a", "https://a.ejemplo.com", "ARRIBA", 999, "200"),
    resultado("b", "https://b.ejemplo.com", "LENTO", 1000, "200"),
  ]).split("\n");
  assert.match(filas[1] ?? "", / 999ms {2}200$/);
  assert.match(filas[2] ?? "", / {2}1\.0s {2}200$/);
});

test("el resumen concuerda en singular y plural", () => {
  const uno = tabla([resultado("a", "https://a.ejemplo.com", "LENTO", 1500, "200")]);
  assert.ok(uno.endsWith("\n1 servicio · 0 arriba · 1 lento · 0 caídos\n"), uno);
  assert.ok(tabla([]).endsWith("\n0 servicios · 0 arriba · 0 lentos · 0 caídos\n"));
});

test("el json trae cada servicio y el resumen", () => {
  const valor = JSON.parse(json(caso()));
  assert.equal(valor.servicios[0].nombre, "pagos");
  assert.equal(valor.servicios[0].estado, "ARRIBA");
  assert.equal(valor.servicios[0].tiempoMs, 87);
  assert.equal(valor.servicios[2].tiempoMs, null, "sin respuesta, sin tiempo");
  assert.deepEqual(valor.resumen, { total: 3, arriba: 1, lento: 1, caido: 1 });
});

test("el json no lleva secretos", () => {
  const texto = json(caso());
  assert.ok(!texto.includes("SECRETO"), `el JSON filtró el query string: ${texto}`);
  assert.ok(texto.includes("https://pagos.ejemplo.com/salud"), texto);
});

test("la url sale sin credenciales, query ni fragmento", () => {
  assert.equal(
    urlEnElJson("https://usuario:clave@pagos.ejemplo.com:8443/v1/salud?token=x#arriba"),
    "https://pagos.ejemplo.com:8443/v1/salud",
  );
  assert.equal(urlEnElJson("http://[::1]:8080/?a=b"), "http://[::1]:8080/");
  assert.equal(urlEnElJson("no es una url"), "(URL ilegible)");
});
