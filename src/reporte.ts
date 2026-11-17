// Convierte resultados en algo que se lee: una tabla o JSON.
//
// La tabla es para personas; el JSON, para otros programas. No consulta nada ni
// decide estados: recibe resultados ya hechos.
//
// De aquí salen dos funciones, `tabla` y `json`: son las únicas con `export`.
// Las demás son detalles de cómo se arma el reporte. En un módulo, lo que no
// lleva `export` no existe para nadie más: las pruebas de test/ lo prueban a
// través de las dos que sí salen.

import type { Estado, Resultado } from "./servicio.js";

/**
 * La tabla para la terminal, con el resumen al final.
 *
 * ```text
 * SERVICIO    ESTADO  TIEMPO  DETALLE
 * nodejs.org  ARRIBA   102ms  200
 * no-existe   CAIDO        —  no se pudo conectar
 *
 * 2 servicios · 1 arriba · 0 lentos · 1 caído
 * ```
 */
export function tabla(resultados: readonly Resultado[]): string {
  const ancho = Math.max("SERVICIO".length, ...resultados.map((r) => largo(r.servicio.nombre)));
  const renglon = (nombre: string, estado: string, cuanto: string, detalle: string): string =>
    `${nombre}${" ".repeat(ancho - largo(nombre))}  ${estado.padEnd(6)}  ${cuanto.padStart(6)}  ${detalle}\n`;

  let salida = renglon("SERVICIO", "ESTADO", "TIEMPO", "DETALLE");
  for (const r of resultados) {
    salida += renglon(r.servicio.nombre, r.estado, tiempo(r.tiempoMs), r.detalle);
  }
  return `${salida}\n${resumen(resultados)}\n`;
}

/** El reporte para otros programas. Las URL salen limpias, sin secretos. */
export function json(resultados: readonly Resultado[]): string {
  const [arriba, lento, caido] = contar(resultados);
  const reporte = {
    servicios: resultados.map((r) => ({
      nombre: r.servicio.nombre,
      url: urlPublica(r.servicio.url),
      estado: r.estado,
      tiempoMs: r.tiempoMs,
      detalle: r.detalle,
    })),
    resumen: { total: resultados.length, arriba, lento, caido },
  };
  return JSON.stringify(reporte, null, 2);
}

/**
 * La URL sin usuario, contraseña, query string ni fragmento.
 *
 * 🔒 Lo que sale en un reporte termina en bitácoras ajenas, y
 * `https://usuario:clave@host` o `?token=...` llevan un secreto. La ruta sí se
 * conserva, porque dice qué se revisa; por eso un token tampoco va en la ruta.
 *
 * No lleva `export` a propósito: es un detalle de cómo se arma el reporte.
 */
function urlPublica(url: string): string {
  let limpia: URL;
  try {
    limpia = new URL(url);
  } catch {
    return "(URL ilegible)";
  }
  limpia.username = "";
  limpia.password = "";
  limpia.search = "";
  limpia.hash = "";
  return limpia.href;
}

/** `142ms`, `2.3s` o `—` si no hubo respuesta. */
function tiempo(tiempoMs: number | null): string {
  if (tiempoMs === null) {
    return "—";
  }
  return tiempoMs < 1000 ? `${tiempoMs}ms` : `${(tiempoMs / 1000).toFixed(1)}s`;
}

/** `3 servicios · 1 arriba · 1 lento · 1 caído`. */
function resumen(resultados: readonly Resultado[]): string {
  const [arriba, lento, caido] = contar(resultados);
  const total = resultados.length;
  const plural = (n: number): string => (n === 1 ? "" : "s");
  return `${total} servicio${plural(total)} · ${arriba} arriba · ${lento} lento${plural(lento)} · ${caido} caído${plural(caido)}`;
}

/** Cuántos quedaron en cada estado: [arriba, lentos, caídos]. */
function contar(resultados: readonly Resultado[]): [number, number, number] {
  const cuantos = (estado: Estado): number => resultados.filter((r) => r.estado === estado).length;
  return [cuantos("ARRIBA"), cuantos("LENTO"), cuantos("CAIDO")];
}

/** El largo en caracteres visibles: «nómina» mide 6, no 7. */
function largo(texto: string): number {
  return [...texto].length;
}
