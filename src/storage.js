const KEY = "luzbot-custom-levels-v1";
const PROG = "luzbot-programs-v1";
const CLEAR = "luzbot-cleared-v1";

export function loadCustomLevels() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveCustomLevels(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertCustomLevel(level) {
  const list = loadCustomLevels();
  const i = list.findIndex((l) => l.id === level.id);
  if (i >= 0) list[i] = level;
  else list.push(level);
  saveCustomLevels(list);
}

export function deleteCustomLevel(id) {
  saveCustomLevels(loadCustomLevels().filter((l) => l.id !== id));
}

export function loadProgram(levelId) {
  try {
    const all = JSON.parse(localStorage.getItem(PROG) || "{}");
    return all[levelId] || { main: [], p1: [], p2: [] };
  } catch {
    return { main: [], p1: [], p2: [] };
  }
}

export function saveProgram(levelId, program) {
  const all = JSON.parse(localStorage.getItem(PROG) || "{}");
  all[levelId] = program;
  localStorage.setItem(PROG, JSON.stringify(all));
}

export function loadCleared() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLEAR) || "[]"));
  } catch {
    return new Set();
  }
}

export function markCleared(id) {
  const s = loadCleared();
  s.add(id);
  localStorage.setItem(CLEAR, JSON.stringify([...s]));
}
