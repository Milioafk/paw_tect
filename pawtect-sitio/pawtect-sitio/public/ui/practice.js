const key = "pawtect:practica:v3";
const pending = new Map();
let worker,
  serial = 0,
  initialized = false;
function decode(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
function encode(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 16384)
    text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
}
function disconnect(message) {
  worker?.terminate();
  worker = null;
  initialized = false;
  for (const item of pending.values()) item.reject(Error(message));
  pending.clear();
}
export function clearPractice() {
  disconnect("Se cerró la práctica.");
  sessionStorage.removeItem(key);
}
export function practiceApi(action, data, method) {
  return new Promise((resolve, reject) => {
    let previous = null;
    if (!worker) {
      worker = new Worker("/practica-assets/practica.js");
      worker.onerror = () =>
        disconnect(
          "No se pudo cargar la práctica. Recarga esta pestaña para reintentar.",
        );
      worker.onmessage = ({ data: reply }) => {
        const p = pending.get(reply.id);
        if (!p) return;
        if (reply.error) {
          pending.delete(reply.id);
          p.reject(Error(reply.error));
          return;
        }
        try {
          if (reply.snapshot)
            sessionStorage.setItem(
              key,
              JSON.stringify({
                memberId: reply.memberId,
                bytes: encode(reply.snapshot),
              }),
            );
        } catch {
          disconnect(
            "El navegador no pudo guardar el cambio. Libera espacio o prueba con un archivo ficticio más pequeño.",
          );
          return;
        }
        pending.delete(reply.id);
        p.resolve(reply.result);
      };
    }
    if (!initialized) {
      try {
        previous = JSON.parse(sessionStorage.getItem(key) || "null");
      } catch {
        disconnect(
          "No pudimos leer la práctica. Usa Reiniciar para comenzar de nuevo.",
        );
        reject(Error("Reinicia la práctica de esta pestaña."));
        return;
      }
    }
    const payload = {
      id: ++serial,
      action,
      method: method === "GET" || data === undefined ? "GET" : "POST",
      snapshotSent: initialized,
      snapshot: previous ? decode(previous.bytes) : null,
      memberId: previous?.memberId,
    };
    initialized = true;
    if (data instanceof FormData) payload.form = Array.from(data.entries());
    else payload.data = data;
    pending.set(payload.id, { resolve, reject });
    worker.postMessage(payload);
  });
}
