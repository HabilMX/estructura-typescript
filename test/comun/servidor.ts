// Ayudas que comparten las pruebas: un servidor HTTP de mentira.
//
// Vive en test/comun/ y su nombre NO termina en «.test.ts» a propósito: el
// script de pruebas solo corre «test/**/*.test.ts». Sin ese patrón, Node
// correría como prueba todo archivo que esté bajo una carpeta test/, este
// incluido.
//
// Escucha en 127.0.0.1, en un puerto que elige el sistema, así que las pruebas
// no salen a internet ni chocan entre sí.

import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface ServidorDePrueba {
  /** Como `127.0.0.1:41233`. */
  readonly direccion: string;
  /** Cuántas consultas estaban abiertas a la vez, como máximo. */
  maximoALaVez(): number;
  cerrar(): Promise<void>;
}

/**
 * Levanta el servidor. Rutas:
 * - `/ok`: 200 al instante.
 * - `/error`: 500 al instante.
 * - `/lento/<ms>`: 200 después de esperar esos milisegundos.
 * - `/mudo`: acepta la conexión y nunca contesta.
 * - `/enorme`: 200 y un cuerpo que no se acaba nunca.
 * - `/goteo`: 200, promete un cuerpo grande y lo manda de a un byte cada 100 ms.
 */
export async function servidor(): Promise<ServidorDePrueba> {
  let abiertas = 0;
  let maximo = 0;

  const http: Server = createServer((peticion, respuesta) => {
    abiertas += 1;
    maximo = Math.max(maximo, abiertas);
    respuesta.on("close", () => {
      abiertas -= 1;
    });

    // La ruta sin su query string: /ok?token=x se atiende como /ok.
    const ruta = (peticion.url ?? "/").split("?")[0] ?? "/";
    const espera = /^\/lento\/([0-9]+)$/.exec(ruta);
    if (ruta === "/ok") {
      responder(respuesta, 200);
    } else if (ruta === "/error") {
      responder(respuesta, 500);
    } else if (ruta === "/mudo") {
      // Nada: la conexión se queda abierta hasta que el cliente se canse.
    } else if (ruta === "/enorme") {
      respuesta.writeHead(200, { connection: "close" });
      const trozo = Buffer.alloc(16 * 1024, "x");
      const escribir = (): void => {
        while (!respuesta.destroyed && respuesta.write(trozo)) {
          // Sigue mientras el cliente reciba.
        }
      };
      respuesta.on("drain", escribir);
      escribir();
    } else if (ruta === "/goteo") {
      respuesta.writeHead(200, { "content-length": "1000000", connection: "close" });
      const gota = setInterval(() => respuesta.write("x"), 100);
      respuesta.on("close", () => clearInterval(gota));
    } else if (espera !== null) {
      const reloj = setTimeout(() => responder(respuesta, 200), Number(espera[1]));
      respuesta.on("close", () => clearTimeout(reloj));
    } else {
      responder(respuesta, 404);
    }
  });

  await new Promise<void>((listo) => http.listen(0, "127.0.0.1", listo));
  const { port } = http.address() as AddressInfo;

  return {
    direccion: `127.0.0.1:${port}`,
    maximoALaVez: () => maximo,
    cerrar: () =>
      new Promise<void>((listo) => {
        http.close(() => listo());
        http.closeAllConnections();
      }),
  };
}

function responder(respuesta: ServerResponse, codigo: number): void {
  respuesta.writeHead(codigo, { "content-length": "2", connection: "close" });
  respuesta.end("ok");
}
