// Lee y valida la lista de servicios (servicios.json).
//
// Lo que entra de un archivo es `unknown` hasta que se revisa campo por campo:
// TypeScript no vigila lo que llega en ejecución. Y dos cuidados que una
// plantilla no debe enseñar mal:
//
// - **Ningún error repite la URL ni el valor que encontró.** Una URL puede traer
//   usuario, contraseña o un token, y un mensaje de error acaba en bitácoras.
// - **El texto del error de JSON.parse nunca se imprime.** Ese texto cita un
//   pedazo del archivo, y el pedazo puede ser justo el secreto.

import { readFile } from "node:fs/promises";

import { TIMEOUT_POR_OMISION_MS, type Servicio } from "./servicio.js";

/** El tiempo límite más corto y más largo que se acepta, en milisegundos. */
export const TIMEOUT_MINIMO_MS = 1;
export const TIMEOUT_MAXIMO_MS = 60_000;

const CAMPOS = ["nombre", "url", "timeoutMs"];

/** La configuración no sirve. El mensaje ya está listo para mostrarse. */
export class ErrorConfig extends Error {
  override readonly name = "ErrorConfig";
}

/** Lee el archivo y devuelve los servicios, o lanza `ErrorConfig`. */
export async function leer(ruta: string): Promise<Servicio[]> {
  let texto: string;
  try {
    texto = await readFile(ruta, "utf8");
  } catch (error: unknown) {
    throw new ErrorConfig(`no se pudo leer ${ruta}: ${porQue(error)}`);
  }
  return desdeTexto(texto);
}

/** Lo mismo que `leer`, a partir del texto: así se prueba sin disco. */
export function desdeTexto(texto: string): Servicio[] {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new ErrorConfig("el archivo no es JSON válido");
  }
  if (!Array.isArray(crudo)) {
    throw new ErrorConfig("el archivo debe ser una lista de servicios");
  }
  if (crudo.length === 0) {
    throw new ErrorConfig("la lista de servicios está vacía");
  }

  const servicios: Servicio[] = [];
  const vistos = new Set<string>();
  for (const [indice, entrada] of crudo.entries()) {
    const servicio = validar(indice + 1, entrada);
    if (vistos.has(servicio.nombre)) {
      throw new ErrorConfig(`servicio ${indice + 1}: el nombre «${servicio.nombre}» está repetido`);
    }
    vistos.add(servicio.nombre);
    servicios.push(servicio);
  }
  return servicios;
}

function validar(posicion: number, entrada: unknown): Servicio {
  const falla = (motivo: string): ErrorConfig => new ErrorConfig(`servicio ${posicion}: ${motivo}`);

  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
    throw falla("debe ser un objeto con nombre y url");
  }
  const campos: Record<string, unknown> = { ...entrada };

  for (const clave of Object.keys(campos)) {
    if (!CAMPOS.includes(clave)) {
      // Una clave rara puede ser un valor pegado en el lugar equivocado: solo
      // se repite si tiene cara de nombre de campo.
      throw falla(pareceCampo(clave) ? `campo desconocido «${clave}»` : "tiene un campo desconocido");
    }
  }

  const { nombre, url, timeoutMs = TIMEOUT_POR_OMISION_MS } = campos;
  if (typeof nombre !== "string" || nombre.trim() === "") {
    throw falla("nombre debe ser un texto que no esté vacío");
  }
  if (typeof url !== "string") {
    throw falla("url debe ser un texto");
  }
  if (
    typeof timeoutMs !== "number" ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < TIMEOUT_MINIMO_MS ||
    timeoutMs > TIMEOUT_MAXIMO_MS
  ) {
    throw falla(
      `timeoutMs debe ser un número entero de ${TIMEOUT_MINIMO_MS} a ${TIMEOUT_MAXIMO_MS} milisegundos`,
    );
  }

  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    throw falla("la url no es válida; debe empezar con http:// o https://");
  }
  if (direccion.protocol !== "http:" && direccion.protocol !== "https:") {
    throw falla("la url debe empezar con http:// o https://");
  }
  if (direccion.username !== "" || direccion.password !== "") {
    throw falla("la url no debe llevar usuario o contraseña");
  }

  return { nombre, url, timeoutMs };
}

function pareceCampo(clave: string): boolean {
  return /^[A-Za-z0-9_]{1,32}$/.test(clave);
}

/** Por qué no se pudo leer el archivo, en una frase fija. */
function porQue(error: unknown): string {
  const codigo = error instanceof Error && "code" in error ? error.code : undefined;
  if (codigo === "ENOENT") {
    return "no existe";
  }
  if (codigo === "EACCES" || codigo === "EPERM") {
    return "no hay permiso para leerlo";
  }
  if (codigo === "EISDIR") {
    return "es una carpeta";
  }
  return "no se pudo abrir";
}
