// ecc.js：编码、标记丢失与恢复（四数据块加两校验块，系统化范德蒙矩阵）
import { generatorOf, multiply, invert } from "./galois.js";

const K = 4;
const M = 2;
const N = 6;

function fail(code) {
  throw Object.assign(new Error(code), { code: code });
}

function clone(state) {
  return {
    blocks: (state.blocks || []).slice(),
    lost: (state.lost || []).slice(),
    matrix: (state.matrix || []).map(function (row) { return row.slice(); }),
    records: (state.records || []).map(function (row) {
      return [row[0].slice(), row[1].slice(), row[2].slice(), (row[3] || []).map(function (r) { return r.slice(); })];
    }),
    encodes: state.encodes || 0,
    losses: state.losses || 0,
    recovers: state.recovers || 0
  };
}

export function encode(state, data) {
  if (!Array.isArray(data) || data.length !== K) { fail("E_BAD_SHAPE"); }
  for (const byte of data) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) { fail("E_BAD_VALUE"); }
  }
  const next = clone(state);
  const matrix = generatorOf(K, M);
  next.blocks = multiply(matrix, data);
  next.lost = [];
  next.matrix = matrix;
  next.encodes += 1;
  return next;
}

export function lose(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= N) { fail("E_BAD_INDEX"); }
  const next = clone(state);
  if (next.lost.indexOf(index) !== -1) { fail("E_ALREADY_LOST"); }
  if (next.lost.length >= M) { fail("E_TOO_MANY"); }
  next.lost.push(index);
  next.losses += 1;
  return next;
}

export function recover(state) {
  const next = clone(state);
  if (next.lost.length === 0) { fail("E_NO_LOSS"); }
  const matrix = generatorOf(K, M);
  const used = [];
  for (let i = 0; i < N && used.length < K; i += 1) {
    if (next.lost.indexOf(i) === -1) { used.push(i); }
  }
  const square = used.map(function (i) { return matrix[i]; });
  const recovery = invert(square);
  const data = multiply(recovery, used.map(function (i) { return next.blocks[i]; }));
  const full = multiply(matrix, data);
  const restored = [];
  for (const index of next.lost) {
    next.blocks[index] = full[index];
    restored.push(full[index]);
  }
  next.records.push([used, next.lost.slice(), restored, recovery]);
  next.lost = [];
  next.matrix = matrix;
  next.recovers += 1;
  return next;
}
