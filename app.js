// app.js：分片托盘与恢复矩阵的渲染数据
import { gfMul } from "./galois.js";
import { encode, lose, recover } from "./ecc.js";

const K = 4;
const N = 6;
const LABELS = ["D0", "D1", "D2", "D3", "P0", "P1"];

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

function rowMix(row, vec) {
  let acc = 0;
  for (let j = 0; j < row.length; j += 1) { acc ^= gfMul(row[j], vec[j]); }
  return acc;
}

function uniqueSorted(list) {
  let ok = true;
  for (let i = 1; i < list.length; i += 1) {
    if (list[i - 1] >= list[i]) { ok = false; }
  }
  return ok;
}

export function render(spec) {
  let state = clone(spec.state);
  const failed = [];
  for (const event of spec.events || []) {
    try {
      if (event.kind === "encode") { state = encode(state, event.data); }
      else if (event.kind === "lose") { state = lose(state, event.index); }
      else if (event.kind === "recover") { state = recover(state); }
      else { throw Object.assign(new Error("E_BAD_EVENT"), { code: "E_BAD_EVENT" }); }
    } catch (error) {
      failed.push([event.kind, error && error.code ? error.code : "E_BAD_EVENT"]);
    }
  }
  const first = (spec.events || []).find(function (event) { return event.kind === "encode"; });
  const want = first ? first.data : [];
  let prefixOk = JSON.stringify(state.blocks.slice(0, K)) === JSON.stringify(want);
  let generatorOk = true;
  (state.matrix || []).slice(0, K).forEach(function (row, spot) {
    row.forEach(function (value, at) {
      if (value !== (at === spot ? 1 : 0)) { generatorOk = false; }
    });
  });
  let parityOk = true;
  if ((state.matrix || []).length === N) {
    for (let r = K; r < N; r += 1) {
      if (rowMix(state.matrix[r], state.blocks.slice(0, K)) !== state.blocks[r]) { parityOk = false; }
    }
  } else {
    parityOk = false;
  }
  return {
    blocks: (state.blocks || []).slice(),
    lost: (state.lost || []).slice(),
    matrix: (state.matrix || []).map(function (row) { return row.slice(); }),
    records: (state.records || []).map(function (row) {
      return [row[0].slice(), row[1].slice(), row[2].slice(), (row[3] || []).map(function (r) { return r.slice(); })];
    }),
    labels: LABELS,
    encodes: state.encodes,
    losses: state.losses,
    recovers: state.recovers,
    failed_events: failed.length,
    failed_marks: failed,
    prefix_ok: prefixOk,
    generator_ok: generatorOk,
    parity_ok: parityOk,
    used_sorted: (state.records || []).every(function (row) { return uniqueSorted(row[0]); })
  };
}
