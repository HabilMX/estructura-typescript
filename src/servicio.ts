// El vocabulario del programa: qué es un servicio y en qué estado lo encontramos.
//
// Es el módulo del que dependen todos y que no depende de ninguno del proyecto:
// no abre conexiones, no lee archivos y no sabe de JSON. Por eso se prueba sin
// red y sin disco.

/** A partir de cuántos milisegundos una respuesta correcta se considera lenta. */
export const UMBRAL_LENTO_MS = 1000;

/** Lo que se le espera a un servicio que no declara su propio tiempo límite. */
export const TIMEOUT_POR_OMISION_MS = 2000;

/**
 * Algo que sabemos consultar por HTTP.
 *
 * La URL ya viene validada por `config.ts`: esquema `http` o `https`, con
 * servidor y sin usuario ni contraseña.
 */
export interface Servicio {
  readonly nombre: string;
  readonly url: string;
  readonly timeoutMs: number;
}

/** Cómo encontramos un servicio. Son tres, y ninguno más. */
export type Estado = "ARRIBA" | "LENTO" | "CAIDO";

/** Una fotografía de un servicio en el momento en que se consultó. */
export interface Resultado {
  readonly servicio: Servicio;
  readonly estado: Estado;
  /** Cuánto tardó la respuesta; `null` si nunca llegó. */
  readonly tiempoMs: number | null;
  /** El código HTTP (`"200"`) o, si no hubo respuesta, por qué. */
  readonly detalle: string;
}

/**
 * Decide el estado a partir del código HTTP y del tiempo de respuesta.
 *
 * Sin código, o con un código 400 o mayor, el servicio está caído. Con una
 * respuesta correcta, está lento si tardó `UMBRAL_LENTO_MS` o más.
 */
export function clasificar(codigo: number | null, tiempoMs: number | null): Estado {
  if (codigo === null || codigo >= 400) {
    return "CAIDO";
  }
  if (tiempoMs !== null && tiempoMs >= UMBRAL_LENTO_MS) {
    return "LENTO";
  }
  return "ARRIBA";
}

/** `true` solo si todos los servicios están arriba: ni lentos ni caídos. */
export function todosArriba(resultados: readonly Resultado[]): boolean {
  return resultados.every((r) => r.estado === "ARRIBA");
}
