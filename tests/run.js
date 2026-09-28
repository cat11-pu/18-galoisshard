import assert from "node:assert";
import { gfMul, gfInv, generatorOf, multiply, invert } from "../galois.js";
import { encode, lose, recover } from "../ecc.js";

const blank = { blocks: [0, 0, 0, 0, 0, 0], lost: [], matrix: [], records: [],
                encodes: 0, losses: 0, recovers: 0 };

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("gfMul 给数字", () => {
  assert.strictEqual(typeof gfMul(3, 7), "number");
});

check("gfInv 给数字", () => {
  assert.strictEqual(typeof gfInv(3), "number");
});

check("generatorOf 给六行四列", () => {
  const grid = generatorOf(4, 2);
  assert.strictEqual(grid.length, 6);
  assert.strictEqual(grid[0].length, 4);
});

check("multiply 给六行", () => {
  assert.strictEqual(multiply(generatorOf(4, 2), [1, 2, 3, 4]).length, 6);
});

check("invert 保持方阵形状", () => {
  const back = invert(generatorOf(4, 2).slice(0, 4));
  assert.strictEqual(back.length, 4);
  assert.strictEqual(back[0].length, 4);
});

check("encode 给六个块", () => {
  assert.strictEqual(encode(blank, [1, 2, 3, 4]).blocks.length, 6);
});

check("lose 记一条丢失", () => {
  assert.strictEqual(lose(blank, 2).lost.length, 1);
});

check("recover 给状态", () => {
  const out = recover(lose(encode(blank, [1, 2, 3, 4]), 0));
  assert.strictEqual(typeof out, "object");
});

console.log("8 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
