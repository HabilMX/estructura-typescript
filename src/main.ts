// El programa `revisor`: lee las opciones, llama a los módulos y decide el
// código de salida.
//
// Es delgado a propósito. Si algo de aquí merece una prueba propia, ya no
// pertenece aquí: va en un módulo. Este archivo se prueba ejecutándolo entero,
// como hace test/programa.test.ts.
//
// Los módulos se importan por su nombre con «#». Ese nombre NO lo resuelve
// tsconfig.json: lo resuelve el campo "imports" de package.json, que leen los
// dos, TypeScript al compilar y Node al arrancar.
//
// Códigos de salida: 0 todo arriba · 1 alguno lento o caído · 2 no se pudo
// revisar (opciones inválidas o configuración rota).

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { ErrorConfig, leer } from "#config";
import { json, tabla } from "#reporte";
import { PARALELO_POR_OMISION, revisarTodos } from "#revisar";
import { todosArriba } from "#servicio";

const AYUDA = `Revisa si una lista de servicios responde por HTTP

Uso: revisor [opciones]

  --config <archivo>    el archivo JSON con la lista de servicios (servicios.json)
  --formato <formato>   tabla o json (tabla)
  --paralelo <n>        cuántos servicios se consultan a la vez, 1 o más (${PARALELO_POR_OMISION})
  --version             la versión del programa
  --help                esta ayuda
`;

/** Las opciones no sirven. El mensaje ya está listo para mostrarse. */
class ErrorDeUso extends Error {}

interface Opciones {
  readonly config: string;
  readonly formato: "tabla" | "json";
  readonly paralelo: number;
  readonly pide: "revisar" | "version" | "ayuda";
}

function leerOpciones(argumentos: string[]): Opciones {
  let valores;
  try {
    ({ values: valores } = parseArgs({
      args: argumentos,
      options: {
        config: { type: "string", default: "servicios.json" },
        formato: { type: "string", default: "tabla" },
        paralelo: { type: "string", default: String(PARALELO_POR_OMISION) },
        version: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    }));
  } catch {
    // El texto del error de parseArgs repite lo que se escribió: no se usa.
    throw new ErrorDeUso("opciones no reconocidas; prueba con --help");
  }

  const { formato } = valores;
  if (formato !== "tabla" && formato !== "json") {
    throw new ErrorDeUso("--formato debe ser tabla o json");
  }
  if (!/^[0-9]+$/.test(valores.paralelo) || Number(valores.paralelo) < 1) {
    throw new ErrorDeUso("--paralelo debe ser un número entero, 1 o más");
  }
  const pide = valores.help ? "ayuda" : valores.version ? "version" : "revisar";
  return { config: valores.config, formato, paralelo: Number(valores.paralelo), pide };
}

/** La versión es la de package.json, que vive un nivel arriba de dist/. */
async function version(): Promise<string> {
  const paquete: unknown = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (typeof paquete === "object" && paquete !== null && "version" in paquete) {
    return String(paquete.version);
  }
  return "desconocida";
}

async function main(argumentos: string[]): Promise<number> {
  let opciones: Opciones;
  try {
    opciones = leerOpciones(argumentos);
  } catch (error: unknown) {
    console.error(`revisor: ${error instanceof ErrorDeUso ? error.message : "opciones inválidas"}`);
    return 2;
  }
  if (opciones.pide === "ayuda") {
    process.stdout.write(AYUDA);
    return 0;
  }
  if (opciones.pide === "version") {
    console.log(`revisor ${await version()}`);
    return 0;
  }

  let servicios;
  try {
    servicios = await leer(opciones.config);
  } catch (error: unknown) {
    console.error(
      `revisor: ${error instanceof ErrorConfig ? error.message : "no se pudo leer la configuración"}`,
    );
    return 2;
  }

  const resultados = await revisarTodos(servicios, opciones.paralelo);
  process.stdout.write(opciones.formato === "json" ? `${json(resultados)}\n` : tabla(resultados));
  return todosArriba(resultados) ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
