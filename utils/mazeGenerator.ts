
export type Cell = {
  r: number;
  c: number;
  walls: [boolean, boolean, boolean, boolean]; // top, right, bottom, left
  visited: boolean;
};

export function generateMaze(rows: number, cols: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < cols; c++) {
      row.push({ r, c, walls: [true, true, true, true], visited: false });
    }
    grid.push(row);
  }

  const stack: Cell[] = [];
  const start = grid[0][0];
  start.visited = true;
  stack.push(start);

  while (stack.length > 0) {
    const current = stack.pop()!;
    const neighbors = getUnvisitedNeighbors(current, grid, rows, cols);

    if (neighbors.length > 0) {
      stack.push(current);
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      removeWalls(current, next);
      next.visited = true;
      stack.push(next);
    }
  }

  return grid;
}

function getUnvisitedNeighbors(cell: Cell, grid: Cell[][], rows: number, cols: number) {
  const { r, c } = cell;
  const neighbors: Cell[] = [];

  if (r > 0 && !grid[r - 1][c].visited) neighbors.push(grid[r - 1][c]);
  if (r < rows - 1 && !grid[r + 1][c].visited) neighbors.push(grid[r + 1][c]);
  if (c > 0 && !grid[r][c - 1].visited) neighbors.push(grid[r][c - 1]);
  if (c < cols - 1 && !grid[r][c + 1].visited) neighbors.push(grid[r][c + 1]);

  return neighbors;
}

function removeWalls(a: Cell, b: Cell) {
  const dr = a.r - b.r;
  const dc = a.c - b.c;

  if (dr === 1) { a.walls[0] = false; b.walls[2] = false; }
  else if (dr === -1) { a.walls[2] = false; b.walls[0] = false; }
  
  if (dc === 1) { a.walls[3] = false; b.walls[1] = false; }
  else if (dc === -1) { a.walls[1] = false; b.walls[3] = false; }
}

// Simple BFS for pathfinding
export function solveMaze(grid: Cell[][], start: {r: number, c: number}, end: {r: number, c: number}) {
  const queue: {r: number, c: number, path: {r: number, c: number}[]}[] = [{...start, path: [start]}];
  const visited = new Set();
  visited.add(`${start.r},${start.c}`);

  while (queue.length > 0) {
    const { r, c, path } = queue.shift()!;
    if (r === end.r && c === end.c) return path;

    const cell = grid[r][c];
    const neighbors = [
      {r: r-1, c, wallIdx: 0}, // top
      {r: r, c: c+1, wallIdx: 1}, // right
      {r: r+1, c, wallIdx: 2}, // bottom
      {r: r, c: c-1, wallIdx: 3}  // left
    ];

    for (const n of neighbors) {
      if (n.r >= 0 && n.r < grid.length && n.c >= 0 && n.c < grid[0].length) {
        if (!cell.walls[n.wallIdx] && !visited.has(`${n.r},${n.c}`)) {
          visited.add(`${n.r},${n.c}`);
          queue.push({ r: n.r, c: n.c, path: [...path, {r: n.r, c: n.c}] });
        }
      }
    }
  }
  return [];
}
