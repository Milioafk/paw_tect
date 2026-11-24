import {
  $,
  api,
  abtn,
  btn,
  dialog,
  close,
  notice,
  download,
  esc,
  toast,
} from "./common.js";
export function parseRoster(text) {
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = input.split("\n", 1)[0].includes(";") ? ";" : ",";
  const rows = [],
    record = [];
  let cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i <= input.length; i++) {
    const c = i === input.length ? "\n" : input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === delimiter || c === "\n") {
      record.push(cell.trim());
      cell = "";
      closed = false;
      if (c === "\n") {
        if (record.some(Boolean)) rows.push(record.slice());
        record.length = 0;
      }
    } else if (c === '"' && !cell && !closed) {
      quoted = true;
    } else if (closed || c === '"') throw Error("Revisa las comillas del CSV.");
    else cell += c;
  }
  if (quoted) throw Error("Hay una celda con comillas sin cerrar.");
  const header = (rows.shift() || []).map((x) => x.toLowerCase());
  if (header.join(",") !== "dni,nombre,grado,correo")
    throw Error(
      "Los encabezados deben ser dni, nombre, grado y correo, en ese orden.",
    );
  if (!rows.length || rows.length > 50)
    throw Error("El archivo debe tener entre 1 y 50 estudiantes.");
  return rows.map((r, i) => {
    if (r.length !== 4 || !/^\d{8}$/.test(r[0]) || !r[1] || !r[3].includes("@"))
      throw Error(
        "Revisa las cuatro columnas de la fila " +
          (i + 2) +
          ". Conserva los ceros iniciales del DNI.",
      );
    return Object.fromEntries(header.map((h, j) => [h, r[j]]));
  });
}
export function bindRoster(schools) {
  const f = $("#memberForm");
  const find = $("[data-roster=find]"),
    status = $("#padron-status");
  let hydrated = false,
    sequence = 0;
  function reset() {
    sequence++;
    if (hydrated) {
      for (const k of ["name", "email", "grade"]) f.elements[k].value = "";
      hydrated = false;
    }
    status.textContent = "";
  }
  f.elements.dni.addEventListener("input", reset);
  f.elements.school.addEventListener("change", reset);
  find.onclick = async () => {
    const turn = ++sequence;
    status.textContent = "Buscando en el padrón…";
    try {
      const v = await api("rosterLookup", {
        school: f.elements.school.value,
        dni: f.elements.dni.value,
      });
      if (turn !== sequence) return;
      for (const k of ["name", "email", "grade"])
        f.elements[k].value = v[k] || "";
      hydrated = true;
      status.textContent =
        "Ficha completada. Revisa los datos antes de generar la cuenta.";
    } catch (e) {
      if (turn === sequence) status.textContent = e.message;
    }
  };
  $("[data-roster=import]").onclick = () => {
    const school = schools.find((s) => s.id === f.elements.school.value);
    if (!school) return;
    let rows = [];
    dialog(
      "Importar el padrón",
      '<p class="dialog-desc">Colegio seleccionado: <b>' +
        esc(school.name) +
        '</b>. Carga hasta 50 estudiantes. Conserva el DNI como texto para mantener sus ocho dígitos.</p><div class="stack"><button type="button" class="outline-btn" id="roster-example">Descargar plantilla CSV</button><label class="field">Archivo CSV del colegio<input id="roster-csv" type="file" accept=".csv,text/csv"></label><p class="roster-preview" id="roster-preview" aria-live="polite"></p><div class="btn-row"><button type="button" class="btn brand-btn" id="roster-confirm" disabled>Importar fichas</button>' +
        abtn("close", "Volver", "X") +
        "</div></div>",
    );
    const file = $("#roster-csv"),
      info = $("#roster-preview"),
      confirm = $("#roster-confirm");
    $("#roster-example").onclick = () =>
      download(
        "plantilla-padron.csv",
        "\uFEFFdni,nombre,grado,correo\r\n00000042,Álex Rivera,4.º B,alex@colegio.example\r\n",
        "text/csv;charset=utf-8",
      );
    let revision = 0;
    file.onchange = async () => {
      const request = ++revision;
      rows = [];
      confirm.disabled = true;
      info.textContent = "";
      const item = file.files[0];
      if (!item) return;
      try {
        if (item.size > 32768) throw Error("El CSV debe pesar hasta 32 KB.");
        const parsed = parseRoster(await item.text());
        if (request !== revision) return;
        if (
          parsed.some(
            (r) => r.correo.toLowerCase().split("@")[1] !== school.domain,
          )
        )
          throw Error("Cada correo debe pertenecer a @" + school.domain + ".");
        rows = parsed;
        info.textContent =
          rows.length +
          " fichas preparadas para " +
          school.name +
          ". Primera fila: " +
          rows[0].nombre +
          " · " +
          rows[0].grado +
          ".";
        confirm.disabled = false;
      } catch (e) {
        if (request === revision) info.textContent = e.message;
      }
    };
    confirm.onclick = async () => {
      if (!rows.length) return;
      confirm.disabled = true;
      file.disabled = true;
      try {
        const v = await api("rosterImport", { school: school.id, rows });
        close();
        toast(v.count + " fichas disponibles en el padrón.");
      } catch (e) {
        info.textContent = e.message;
        confirm.disabled = false;
        file.disabled = false;
      }
    };
  };
}
