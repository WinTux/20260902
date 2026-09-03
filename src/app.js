import { COMMANDS, CAMPAIGN, blankLevel } from "./levels.js";
import {
  createRuntime,
  runProgram,
  cellsToGrid,
  gridToCells,
  emptyGrid,
} from "./engine.js";
import { drawWorld, pickCell } from "./render.js";
import {
  loadCustomLevels,
  upsertCustomLevel,
  deleteCustomLevel,
  loadProgram,
  saveProgram,
  loadCleared,
  markCleared,
} from "./storage.js";

const app = document.getElementById("app");

const state = {
  screen: "menu",
  level: null,
  source: "campaign",
  program: { main: [], p1: [], p2: [] },
  proc: "main",
  runtime: null,
  running: false,
  stop: false,
  status: "",
  statusKind: "",
  showWin: false,
  editor: null,
  tool: "raise",
  hover: null,
};

function cmdMeta(id) {
  return COMMANDS.find((c) => c.id === id);
}

function render() {
  if (state.screen === "menu") app.innerHTML = menuView();
  else if (state.screen === "select") app.innerHTML = selectView();
  else if (state.screen === "play") app.innerHTML = playView();
  else if (state.screen === "editor") app.innerHTML = editorView();
  bind();
  paintCanvas();
}

function menuView() {
  return `
  <div class="shell">
    <div class="hero">
      <div class="kicker">Juego de programación</div>
      <h1>LuzBot</h1>
      <p class="lede">Escribe un programa con bloques para que el robot recorra el mapa y encienda cada lámpara. Incluye una campaña y un editor de niveles.</p>
      <div class="row">
        <button class="btn primary" data-go="select">Jugar campaña</button>
        <button class="btn" data-go="custom">Mis niveles</button>
        <button class="btn" data-go="editor-new">Editor de niveles</button>
      </div>
    </div>
    <p class="footer-note">Avanzar mantiene la altura. Saltar cambia exactamente un nivel. Luz conmuta la lámpara de la baldosa actual.</p>
  </div>`;
}

function selectView() {
  const custom = state.source === "custom";
  const list = custom ? loadCustomLevels() : CAMPAIGN;
  const cleared = loadCleared();
  const cards = list.length
    ? list
        .map((lv, i) => {
          const n = custom ? i + 1 : String(i + 1).padStart(2, "0");
          const done = cleared.has(lv.id) ? "Completado" : custom ? "Personalizado" : "Campaña";
          return `<button class="card" data-play="${lv.id}">
            <div class="badge">${done} · ${n}</div>
            <h3>${escapeHtml(lv.name)}</h3>
            <p>${escapeHtml(lv.hint)}</p>
          </button>`;
        })
        .join("")
    : `<p class="hint">Aún no hay niveles guardados. Ábrelos en el editor.</p>`;
  return `
  <div class="shell">
    <div class="topbar">
      <button class="btn ghost" data-go="menu">← Inicio</button>
      ${custom ? `<button class="btn" data-go="editor-new">Nuevo nivel</button>` : ""}
    </div>
    <div class="hero">
      <div class="kicker">${custom ? "Taller" : "Campaña"}</div>
      <h1>${custom ? "Tus niveles" : "Elige un nivel"}</h1>
    </div>
    <div class="grid-cards">${cards}</div>
  </div>`;
}

function playView() {
  const lv = state.level;
  const allowed = COMMANDS.filter((c) => lv.allowed.includes(c.id));
  const palette = allowed
    .map(
      (c) =>
        `<button class="cmd ${c.id}" data-add="${c.id}" title="${c.label}">${c.glyph}</button>`
    )
    .join("");
  const procs = [
    ["main", "Principal", lv.slots.main],
    ["p1", "Procedimiento 1", lv.slots.p1],
    ["p2", "Procedimiento 2", lv.slots.p2],
  ]
    .filter(([, , n]) => n > 0)
    .map(([id, label, n]) => {
      const used = state.program[id].length;
      const slots = state.program[id]
        .map(
          (cmd, i) =>
            `<button class="slot" data-del="${id}:${i}" title="Quitar">${cmdMeta(cmd)?.glyph || cmd}</button>`
        )
        .join("");
      return `<div class="proc">
        <div class="proc-head" data-selproc="${id}"><span>${label}${state.proc === id ? " ●" : ""}</span><span>${used}/${n}</span></div>
        <div class="slots" data-proc="${id}">${slots || `<span style="color:var(--muted);font-size:12px">Clic aquí para escribir en ${label}</span>`}</div>
      </div>`;
    })
    .join("");

  return `
  <div class="shell">
    <div class="topbar">
      <button class="btn ghost" data-go="back-select">← Niveles</button>
      <div class="row">
        ${state.source === "custom" ? `<button class="btn" data-edit>Editar</button>` : ""}
      </div>
    </div>
    <div class="play">
      <div class="stage"><canvas id="world"></canvas></div>
      <div class="panel">
        <h2>${escapeHtml(lv.name)}</h2>
        <p class="hint">${escapeHtml(lv.hint)}</p>
        <div class="proc-head"><span>Bloques</span></div>
        <div class="palette">${palette}</div>
        ${procs}
        <div class="controls">
          <button class="btn primary" data-run ${state.running ? "disabled" : ""}>Ejecutar</button>
          <button class="btn" data-stop ${state.running ? "" : "disabled"}>Parar</button>
          <button class="btn" data-reset>Reiniciar</button>
        </div>
        <div class="status ${state.statusKind}">${escapeHtml(state.status)}</div>
      </div>
    </div>
    ${
      state.showWin
        ? `<div class="win"><div class="win-card">
            <div class="kicker">Nivel superado</div>
            <h2>Lámparas encendidas</h2>
            <p class="hint">El programa funciona. Puedes pasar al siguiente o seguir retocando bloques.</p>
            <div class="row" style="justify-content:center">
              <button class="btn" data-go="back-select">Lista</button>
              <button class="btn primary" data-next>Siguiente</button>
            </div>
          </div></div>`
        : ""
    }
  </div>`;
}

function editorView() {
  const ed = state.editor;
  const checks = COMMANDS.map(
    (c) => `<label><input type="checkbox" data-allow="${c.id}" ${ed.allowed.includes(c.id) ? "checked" : ""}/> ${c.label}</label>`
  ).join("");
  return `
  <div class="shell">
    <div class="topbar">
      <button class="btn ghost" data-go="menu">← Inicio</button>
      <div class="row">
        <button class="btn" data-playtest>Probar</button>
        <button class="btn primary" data-save-level>Guardar</button>
      </div>
    </div>
    <div class="editor">
      <div class="stage"><canvas id="world"></canvas></div>
      <div class="panel">
        <h2>Editor</h2>
        <p class="hint">Pinta el mapa, coloca el robot y decide qué bloques estarán disponibles.</p>
        <div class="tools">
          ${toolBtn("raise", "Subir bloque")}
          ${toolBtn("lower", "Bajar / borrar")}
          ${toolBtn("lamp", "Lámpara on/off")}
          ${toolBtn("start", "Posición inicial")}
          ${toolBtn("turn", "Girar robot")}
        </div>
        <label class="field">Nombre
          <input id="lv-name" type="text" value="${escapeAttr(ed.name)}" />
        </label>
        <label class="field">Pista
          <textarea id="lv-hint" rows="3">${escapeHtml(ed.hint)}</textarea>
        </label>
        <div class="row">
          <label class="field">Ancho
            <input id="lv-w" type="number" min="3" max="8" value="${ed.width}" />
          </label>
          <label class="field">Fondo
            <input id="lv-d" type="number" min="3" max="8" value="${ed.depth}" />
          </label>
        </div>
        <div class="row">
          <label class="field">Slots principal
            <input id="slot-main" type="number" min="0" max="24" value="${ed.slots.main}" />
          </label>
          <label class="field">Slots P1
            <input id="slot-p1" type="number" min="0" max="16" value="${ed.slots.p1}" />
          </label>
          <label class="field">Slots P2
            <input id="slot-p2" type="number" min="0" max="16" value="${ed.slots.p2}" />
          </label>
        </div>
        <div class="checks">${checks}</div>
        <div class="controls">
          <button class="btn" data-export>Exportar JSON</button>
          <button class="btn" data-import>Importar JSON</button>
          <button class="btn" data-delete-level>Borrar</button>
        </div>
      </div>
    </div>
  </div>`;
}

function toolBtn(id, label) {
  return `<button class="tool ${state.tool === id ? "active" : ""}" data-tool="${id}">${label}</button>`;
}

function bind() {
  app.querySelectorAll("[data-go]").forEach((b) =>
    b.addEventListener("click", () => go(b.dataset.go))
  );
  app.querySelectorAll("[data-play]").forEach((b) =>
    b.addEventListener("click", () => openPlay(b.dataset.play))
  );
  app.querySelectorAll("[data-add]").forEach((b) =>
    b.addEventListener("click", () => addCmd(b.dataset.add))
  );
  app.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      const [proc, i] = b.dataset.del.split(":");
      state.program[proc].splice(Number(i), 1);
      persistProg();
      render();
    })
  );
  app.querySelectorAll("[data-proc]").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (!e.target.closest("[data-del]")) {
        state.proc = el.dataset.proc;
        render();
      }
    })
  );
  app.querySelectorAll("[data-selproc]").forEach((el) =>
    el.addEventListener("click", () => {
      state.proc = el.dataset.selproc;
      render();
    })
  );
  app.querySelector("[data-run]")?.addEventListener("click", run);
  app.querySelector("[data-stop]")?.addEventListener("click", () => {
    state.stop = true;
  });
  app.querySelector("[data-reset]")?.addEventListener("click", resetPlay);
  app.querySelector("[data-next]")?.addEventListener("click", nextLevel);
  app.querySelector("[data-edit]")?.addEventListener("click", () => {
    state.editor = structuredClone(state.level);
    state.screen = "editor";
    render();
  });
  app.querySelectorAll("[data-tool]").forEach((b) =>
    b.addEventListener("click", () => {
      state.tool = b.dataset.tool;
      render();
    })
  );
  app.querySelector("[data-save-level]")?.addEventListener("click", saveEditor);
  app.querySelector("[data-playtest]")?.addEventListener("click", playtest);
  app.querySelector("[data-export]")?.addEventListener("click", exportLevel);
  app.querySelector("[data-import]")?.addEventListener("click", importLevel);
  app.querySelector("[data-delete-level]")?.addEventListener("click", () => {
    if (confirm("¿Borrar este nivel guardado?")) {
      deleteCustomLevel(state.editor.id);
      state.screen = "menu";
      render();
    }
  });

  ["lv-w", "lv-d"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      syncEditorFields();
      render();
    });
  });

  const canvas = document.getElementById("world");
  if (!canvas) return;
  if (state.screen === "editor") {
    canvas.addEventListener("click", onEditClick);
    canvas.addEventListener("mousemove", (e) => {
      state.hover = pickCell(canvas, state.editor, e.clientX, e.clientY);
      paintCanvas();
    });
  }
}

function go(where) {
  if (where === "menu") state.screen = "menu";
  if (where === "select") {
    state.source = "campaign";
    state.screen = "select";
  }
  if (where === "custom") {
    state.source = "custom";
    state.screen = "select";
  }
  if (where === "editor-new") {
    state.editor = blankLevel();
    state.screen = "editor";
    state.tool = "raise";
  }
  if (where === "back-select") {
    state.running = false;
    state.stop = true;
    state.screen = "select";
  }
  render();
}

function findLevel(id) {
  return CAMPAIGN.find((l) => l.id === id) || loadCustomLevels().find((l) => l.id === id);
}

function openPlay(id) {
  const lv = findLevel(id);
  if (!lv) return;
  state.level = structuredClone(lv);
  state.source = CAMPAIGN.some((l) => l.id === id) ? "campaign" : "custom";
  const saved = loadProgram(id);
  state.program = {
    main: saved.main || [],
    p1: saved.p1 || [],
    p2: saved.p2 || [],
  };
  state.proc = "main";
  state.showWin = false;
  state.status = "";
  resetRuntime();
  state.screen = "play";
  render();
}

function resetRuntime() {
  state.runtime = createRuntime(state.level);
  state.running = false;
  state.stop = false;
}

function resetPlay() {
  state.stop = true;
  state.showWin = false;
  state.status = "";
  state.statusKind = "";
  resetRuntime();
  render();
}

function persistProg() {
  saveProgram(state.level.id, state.program);
}

function addCmd(id) {
  const proc = state.proc;
  const max = state.level.slots[proc] || 0;
  if (state.program[proc].length >= max) {
    state.status = "No quedan huecos en este procedimiento.";
    state.statusKind = "bad";
    render();
    return;
  }
  state.program[proc].push(id);
  persistProg();
  render();
}

async function run() {
  resetRuntime();
  state.running = true;
  state.stop = false;
  state.showWin = false;
  state.status = "Ejecutando…";
  state.statusKind = "";
  render();
  const rt = state.runtime;
  await runProgram(
    rt,
    state.program,
    () => {
      paintCanvas();
      if (rt.won) {
        state.status = "¡Completado!";
        state.statusKind = "ok";
      } else if (rt.crashed) {
        state.status = rt.message;
        state.statusKind = "bad";
      }
    },
    () => state.stop
  );
  state.running = false;
  if (rt.won) {
    markCleared(state.level.id);
    state.showWin = true;
  } else if (!rt.crashed && !state.stop) {
    state.status = "El programa terminó y aún hay lámparas apagadas.";
    state.statusKind = "bad";
  } else if (state.stop) {
    state.status = "Detenido.";
    state.statusKind = "";
  }
  render();
}

function nextLevel() {
  const list = state.source === "campaign" ? CAMPAIGN : loadCustomLevels();
  const i = list.findIndex((l) => l.id === state.level.id);
  const n = list[i + 1];
  if (n) openPlay(n.id);
  else {
    state.screen = "select";
    render();
  }
}

function paintCanvas() {
  const canvas = document.getElementById("world");
  if (!canvas) return;
  if (state.screen === "play") drawWorld(canvas, state.level, state.runtime);
  if (state.screen === "editor") {
    const lv = state.editor;
    const rt = createRuntime(lv);
    drawWorld(canvas, lv, rt, state.hover);
  }
}

function syncEditorFields() {
  const ed = state.editor;
  const name = document.getElementById("lv-name");
  if (!name) return;
  ed.name = name.value.trim() || "Nivel sin título";
  ed.hint = document.getElementById("lv-hint").value;
  const w = clamp(+document.getElementById("lv-w").value, 3, 8);
  const d = clamp(+document.getElementById("lv-d").value, 3, 8);
  if (w !== ed.width || d !== ed.depth) resizeLevel(ed, w, d);
  ed.slots = {
    main: clamp(+document.getElementById("slot-main").value, 0, 24),
    p1: clamp(+document.getElementById("slot-p1").value, 0, 16),
    p2: clamp(+document.getElementById("slot-p2").value, 0, 16),
  };
  ed.allowed = COMMANDS.filter((c) => document.querySelector(`[data-allow="${c.id}"]`)?.checked).map(
    (c) => c.id
  );
}

function resizeLevel(ed, w, d) {
  const grid = cellsToGrid(ed);
  const next = emptyGrid(w, d);
  for (let y = 0; y < Math.min(d, ed.depth); y++) {
    for (let x = 0; x < Math.min(w, ed.width); x++) next[y][x] = grid[y][x];
  }
  ed.width = w;
  ed.depth = d;
  ed.cells = gridToCells(next);
  ed.start.x = Math.min(ed.start.x, w - 1);
  ed.start.y = Math.min(ed.start.y, d - 1);
}

function onEditClick(e) {
  syncEditorFields();
  const canvas = e.currentTarget;
  const cell = pickCell(canvas, state.editor, e.clientX, e.clientY);
  if (!cell) return;
  const ed = state.editor;
  const grid = cellsToGrid(ed);
  const cur = grid[cell.y][cell.x];
  if (state.tool === "raise") cur.z = Math.min(4, cur.z + 1);
  if (state.tool === "lower") {
    cur.z = Math.max(0, cur.z - 1);
    if (cur.z === 0) cur.lamp = false;
  }
  if (state.tool === "lamp" && cur.z > 0) cur.lamp = !cur.lamp;
  if (state.tool === "start" && cur.z > 0) ed.start = { ...ed.start, x: cell.x, y: cell.y };
  if (state.tool === "turn") ed.start.dir = (ed.start.dir + 1) % 4;
  ed.cells = gridToCells(grid);
  paintCanvas();
}

function saveEditor() {
  syncEditorFields();
  const ed = state.editor;
  if (!ed.cells.length) {
    alert("El mapa está vacío. Sube al menos un bloque.");
    return;
  }
  const onMap = ed.cells.some((c) => c.x === ed.start.x && c.y === ed.start.y);
  if (!onMap) {
    alert("El robot debe empezar sobre un bloque.");
    return;
  }
  upsertCustomLevel(structuredClone(ed));
  alert("Nivel guardado. Aparece en Mis niveles.");
}

function playtest() {
  syncEditorFields();
  upsertCustomLevel(structuredClone(state.editor));
  openPlay(state.editor.id);
}

function exportLevel() {
  syncEditorFields();
  const blob = new Blob([JSON.stringify(state.editor, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.editor.name.replace(/\s+/g, "-").toLowerCase()}.json`;
  a.click();
}

function importLevel() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.cells || !data.start) throw new Error("formato");
      data.id = data.id || `custom-${Date.now()}`;
      state.editor = data;
      render();
    } catch {
      alert("No se pudo leer el JSON del nivel.");
    }
  };
  input.click();
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, Number.isFinite(n) ? n : a));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}

export function start() {
  render();
  window.addEventListener("resize", paintCanvas);
}
