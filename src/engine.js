/** @typedef {"fwd"|"left"|"right"|"jump"|"light"|"p1"|"p2"} Cmd */

export const DIRS = [
  { x: 1, y: 0, name: "este" },
  { x: 0, y: 1, name: "sur" },
  { x: -1, y: 0, name: "oeste" },
  { x: 0, y: -1, name: "norte" },
];

export function emptyGrid(w, h) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({ z: 0, lamp: false })));
}

export function cellsToGrid(level) {
  const grid = emptyGrid(level.width, level.depth);
  for (const c of level.cells) {
    if (c.x >= 0 && c.y >= 0 && c.x < level.width && c.y < level.depth) {
      grid[c.y][c.x] = { z: c.z, lamp: !!c.lamp };
    }
  }
  return grid;
}

export function gridToCells(grid) {
  const cells = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const cell = grid[y][x];
      if (cell.z > 0) cells.push({ x, y, z: cell.z, lamp: !!cell.lamp });
    }
  }
  return cells;
}

export function createRuntime(level) {
  const grid = cellsToGrid(level);
  const lamps = {};
  for (const c of level.cells) {
    if (c.lamp) lamps[`${c.x},${c.y}`] = false;
  }
  return {
    grid,
    width: level.width,
    depth: level.depth,
    bot: { x: level.start.x, y: level.start.y, dir: level.start.dir },
    lamps,
    won: false,
    crashed: false,
    message: "",
    steps: 0,
  };
}

function heightAt(rt, x, y) {
  if (x < 0 || y < 0 || x >= rt.width || y >= rt.depth) return 0;
  return rt.grid[y][x].z;
}

function allLit(rt) {
  return Object.values(rt.lamps).every(Boolean);
}

export function execCmd(rt, cmd) {
  if (rt.won || rt.crashed) return;
  rt.steps += 1;
  const { bot } = rt;
  const d = DIRS[bot.dir];

  if (cmd === "left") {
    bot.dir = (bot.dir + 3) % 4;
    return;
  }
  if (cmd === "right") {
    bot.dir = (bot.dir + 1) % 4;
    return;
  }
  if (cmd === "light") {
    const key = `${bot.x},${bot.y}`;
    if (key in rt.lamps) {
      rt.lamps[key] = !rt.lamps[key];
      if (allLit(rt)) {
        rt.won = true;
        rt.message = "Todas las lámparas están encendidas.";
      }
    }
    return;
  }

  if (cmd === "fwd" || cmd === "jump") {
    const nx = bot.x + d.x;
    const ny = bot.y + d.y;
    const from = heightAt(rt, bot.x, bot.y);
    const to = heightAt(rt, nx, ny);
    if (to <= 0) return;
    const diff = to - from;
    if (cmd === "fwd" && diff === 0) {
      bot.x = nx;
      bot.y = ny;
    } else if (cmd === "jump" && Math.abs(diff) === 1) {
      bot.x = nx;
      bot.y = ny;
    }
  }
}

const MAX_STEPS = 500;
const MAX_DEPTH = 32;

/**
 * @param {ReturnType<typeof createRuntime>} rt
 * @param {{main: Cmd[], p1: Cmd[], p2: Cmd[]}} program
 * @param {(rt: object, cmd: Cmd|null, done: boolean) => void} onTick
 * @param {() => boolean} shouldStop
 */
export async function runProgram(rt, program, onTick, shouldStop) {
  const procs = { main: program.main, p1: program.p1, p2: program.p2 };
  const stack = [{ name: "main", i: 0 }];

  while (stack.length && !rt.won && !rt.crashed) {
    if (shouldStop?.()) return;
    if (rt.steps >= MAX_STEPS) {
      rt.crashed = true;
      rt.message = "Demasiados pasos: posible bucle infinito.";
      onTick(rt, null, true);
      return;
    }
    if (stack.length > MAX_DEPTH) {
      rt.crashed = true;
      rt.message = "Demasiada recursión entre procedimientos.";
      onTick(rt, null, true);
      return;
    }

    const frame = stack[stack.length - 1];
    const list = procs[frame.name] || [];
    if (frame.i >= list.length) {
      stack.pop();
      continue;
    }
    const cmd = list[frame.i++];
    if (cmd === "p1" || cmd === "p2") {
      stack.push({ name: cmd, i: 0 });
      onTick(rt, cmd, false);
      await delay(80);
      continue;
    }
    execCmd(rt, cmd);
    onTick(rt, cmd, false);
    await delay(280);
  }
  onTick(rt, null, true);
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function countCommands(program) {
  return (program.main?.length || 0) + (program.p1?.length || 0) + (program.p2?.length || 0);
}
