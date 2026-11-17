// Consulta los servicios: uno por HTTP, o muchos a la vez con un tope.
//
// Cuida tres cosas que una plantilla no debe enseñar mal:
//
// - **Tiempo límite siempre.** Cada servicio trae el suyo, y cubre la consulta
//   completa: la conexión, los encabezados y el cuerpo. Sin él, un servicio que
//   acepta la conexión y nunca contesta colgaría la revisión.
// - **El cuerpo se lee con tope.** Se deja de leer en cuanto se juntan
//   `TOPE_LECTURA` bytes: un servicio que contesta 200 con un cuerpo enorme no
//   nos tiene leyendo hasta el tiempo límite.
// - **Ningún detalle repite la URL.** Los errores de red se traducen a frases
//   fijas y su texto nunca se usa.

import { clasificar, type Resultado, type Servicio } from "./servicio.js";

/** Lo más que se lee del cuerpo de una respuesta, en bytes, para tirarlo. */
export const TOPE_LECTURA = 64 * 1024;

/** Cuántos servicios se consultan a la vez si nadie dice otra cosa. */
export const PARALELO_POR_OMISION = 5;

const SIN_TIEMPO = "se acabó el tiempo de espera";

/**
 * Consulta UN servicio con un GET y mira qué contesta.
 *
 * Nunca lanza: «este servicio no responde» es justo lo que el programa quiere
 * reportar, así que el fracaso va dentro del `Resultado`.
 */
export async function consultar(servicio: Servicio): Promise<Resultado> {
  const inicio = performance.now();
  let codigo: number | null = null;
  let detalle: string;
  try {
    codigo = await pedirYLeer(servicio.url, AbortSignal.timeout(servicio.timeoutMs));
    detalle = String(codigo);
  } catch (error: unknown) {
    codigo = null;
    detalle = motivo(error);
  }
  const tiempoMs = codigo === null ? null : Math.round(performance.now() - inicio);
  return { servicio, estado: clasificar(codigo, tiempoMs), tiempoMs, detalle };
}

/** Pide la URL y lee el cuerpo hasta que termina o hasta `TOPE_LECTURA`. */
async function pedirYLeer(url: string, senal: AbortSignal): Promise<number> {
  const respuesta = await fetch(url, { signal: senal, headers: { "user-agent": "revisor" } });
  const lector = respuesta.body?.getReader();
  if (lector !== undefined) {
    let leidos = 0;
    while (leidos < TOPE_LECTURA) {
      const { done, value } = await lector.read();
      if (done) {
        break;
      }
      leidos += value.byteLength;
    }
    // Si quedó cuerpo sin leer, se cuelga la conexión en vez de esperarlo.
    await lector.cancel().catch(() => undefined);
  }
  return respuesta.status;
}

/** Traduce un error de red a una frase corta y sin la URL. */
function motivo(error: unknown): string {
  if (!(error instanceof Error)) {
    return "no responde";
  }
  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return SIN_TIEMPO;
  }
  // fetch envuelve la causa: el código del sistema (ECONNREFUSED, ENOTFOUND…)
  // viene en `cause`. Se mira el código, nunca el mensaje.
  const causa: unknown = error.cause;
  const codigo = causa instanceof Error && "code" in causa ? String(causa.code) : "";
  if (["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"].includes(codigo)) {
    return "no se pudo conectar";
  }
  if (["ECONNRESET", "UND_ERR_SOCKET", "UND_ERR_RES_CONTENT_LENGTH_MISMATCH"].includes(codigo)) {
    return "la respuesta llegó incompleta";
  }
  return "no responde";
}

/**
 * Consulta todos los servicios, hasta `paralelo` a la vez (menos de 1 cuenta
 * como 1, y más que el número de servicios cuenta como ese número).
 *
 * Devuelve los resultados en el mismo orden que los servicios. Cada consulta
 * tiene su propio tiempo límite, así que un servicio colgado no detiene a los
 * demás más allá del suyo.
 */
export async function revisarTodos(
  servicios: readonly Servicio[],
  paralelo: number = PARALELO_POR_OMISION,
  consulta: (servicio: Servicio) => Promise<Resultado> = consultar,
): Promise<Resultado[]> {
  const resultados = new Array<Resultado>(servicios.length);
  const pendientes = servicios.entries();
  // Cada «turno» toma el siguiente servicio pendiente hasta que no queda
  // ninguno. El iterador es uno solo y lo comparten todos los turnos.
  const turno = async (): Promise<void> => {
    for (const [posicion, servicio] of pendientes) {
      resultados[posicion] = await consulta(servicio);
    }
  };
  const turnos = Math.min(Math.max(1, Math.trunc(paralelo) || 1), Math.max(1, servicios.length));
  await Promise.all(Array.from({ length: turnos }, turno));
  return resultados;
}
