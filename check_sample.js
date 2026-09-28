import fs from "node:fs";
import { gfMul, gfInv, generatorOf, multiply, invert } from "./galois.js";
import { encode, lose, recover } from "./ecc.js";

const __lines = [];
function emit(label, value) {
  __lines.push([String(label).replace(/ =$/, ""), value]);
}

const K = 4;
const M = 2;
const N = 6;
const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/scene.json", "utf8"));
const events = spec.events || [];

const copy = function (s) {
  return {
    blocks: (s.blocks || []).slice(),
    lost: (s.lost || []).slice(),
    matrix: (s.matrix || []).map(function (row) { return row.slice(); }),
    records: (s.records || []).map(function (row) {
      return [row[0].slice(), row[1].slice(), row[2].slice(), (row[3] || []).map(function (r) { return r.slice(); })];
    }),
    encodes: s.encodes || 0,
    losses: s.losses || 0,
    recovers: s.recovers || 0
  };
};
const rowMix = function (row, vec) {
  let acc = 0;
  for (let j = 0; j < row.length; j += 1) { acc ^= gfMul(row[j], vec[j]); }
  return acc;
};
const fingerprint = function (s) {
  return JSON.stringify({ blocks: s.blocks, lost: s.lost, matrix: s.matrix, records: s.records,
                          encodes: s.encodes, losses: s.losses, recovers: s.recovers });
};
const walk = function (state, list) {
  let failed = 0;
  for (const event of list) {
    try {
      if (event.kind === "encode") { state = encode(state, event.data); }
      else if (event.kind === "lose") { state = lose(state, event.index); }
      else if (event.kind === "recover") { state = recover(state); }
      else { throw Object.assign(new Error("E_BAD_EVENT"), { code: "E_BAD_EVENT" }); }
    } catch (error) { failed += 1; }
  }
  return [state, failed];
};

const start = copy(spec.state);
const walked = walk(copy(start), events);
const final = walked[0];
const failed = walked[1];
const onceWalk = walk(copy(start), events);
const once = onceWalk[0];
const onceFailed = onceWalk[1];
const half = Math.ceil(events.length / 2);
const leftWalk = walk(copy(start), events.slice(0, half));
const left = leftWalk[0];
const midPrint = fingerprint(left);
const rightWalk = walk(left, events.slice(half));
const right = rightWalk[0];
const replayWalk = walk(copy(start), events);
const replay = replayWalk[0];
const replayFailed = replayWalk[1];

let encoded = copy(start);
for (const event of events) {
  if (event.kind === "encode") { encoded = encode(encoded, event.data); }
}
const firstEncode = events.find(function (event) { return event.kind === "encode"; });
const want = firstEncode ? firstEncode.data : [];

const records = final.records || [];
const lastRec = records.length > 0 ? records[records.length - 1] : null;

let generatorOk = true;
try {
  generatorOf(K, M).slice(0, K).forEach(function (row, spot) {
    row.forEach(function (value, at) {
      if (value !== (at === spot ? 1 : 0)) { generatorOk = false; }
    });
  });
} catch (error) { generatorOk = false; }

let parityOk = true;
if ((final.matrix || []).length === N) {
  for (let r = K; r < N; r += 1) {
    if (rowMix(final.matrix[r], final.blocks.slice(0, K)) !== final.blocks[r]) { parityOk = false; }
  }
} else { parityOk = false; }

let solveOk = false;
if (lastRec) {
  try {
    const avail = lastRec[0].map(function (i) { return final.blocks[i]; });
    solveOk = JSON.stringify(multiply(lastRec[3], avail)) === JSON.stringify(final.blocks.slice(0, K));
  } catch (error) { solveOk = false; }
}

let usedOk = records.length > 0;
for (const row of records) {
  for (let i = 1; i < row[0].length; i += 1) {
    if (row[0][i - 1] >= row[0][i]) { usedOk = false; }
  }
  if (row[0].length !== K) { usedOk = false; }
}

emit("收尾后块序列", final.blocks);
emit("校验矩阵", (final.matrix || []).slice(K, N));
emit("最后恢复矩阵", lastRec ? lastRec[3] : []);
emit("恢复记录", records.map(function (row) { return row[1]; }));
emit("每次补回字节", records.map(function (row) { return row[2]; }));
emit("编码次数", final.encodes);
emit("丢失次数", final.losses);
emit("恢复次数", final.recovers);
emit("前缀不变", JSON.stringify(encoded.blocks.slice(0, K)) === JSON.stringify(want));
emit("上四行是单位阵", generatorOk);
emit("恢复后一致", JSON.stringify(final.blocks) === JSON.stringify(encoded.blocks));
emit("校验自洽", parityOk);
emit("逆乘可用块一致", solveOk);
emit("取块下标升序", usedOk);
emit("重放不新增", fingerprint(replay) === fingerprint(final) ? 0 : 1);
emit("重放报错条数", replayFailed);
emit("拆两轮中间态不同", midPrint !== fingerprint(final));
emit("拆两轮收尾态一致", fingerprint(right) === fingerprint(once) && onceFailed === 0);
emit("异常事件数", failed);

// ---- 异常路径探针：真调用实现，看它报出什么码 ----
try {
  lose(copy(start), 9);
  emit("块下标越界报码", "没有报错");
} catch (error) {
  emit("块下标越界报码", error && error.code ? error.code : String(error.message));
}
try {
  let one = copy(start);
  one = lose(one, 0);
  lose(one, 0);
  emit("重复丢失报码", "没有报错");
} catch (error) {
  emit("重复丢失报码", error && error.code ? error.code : String(error.message));
}
try {
  let two = copy(start);
  two = lose(two, 0);
  two = lose(two, 1);
  lose(two, 2);
  emit("丢失超额报码", "没有报错");
} catch (error) {
  emit("丢失超额报码", error && error.code ? error.code : String(error.message));
}
try {
  recover(copy(start));
  emit("无丢失恢复报码", "没有报错");
} catch (error) {
  emit("无丢失恢复报码", error && error.code ? error.code : String(error.message));
}
try {
  gfInv(0);
  emit("零元求逆报码", "没有报错");
} catch (error) {
  emit("零元求逆报码", error && error.code ? error.code : String(error.message));
}
try {
  encode(copy(start), [1, 2, 300, 4]);
  emit("字节越界报码", "没有报错");
} catch (error) {
  emit("字节越界报码", error && error.code ? error.code : String(error.message));
}

// ---- 期望值（参考模型算出）----
const EXPECTED = {
  "收尾后块序列": [
    23,
    200,
    5,
    137,
    197,
    237
  ],
  "校验矩阵": [
    [
      27,
      28,
      18,
      20
    ],
    [
      28,
      27,
      20,
      18
    ]
  ],
  "最后恢复矩阵": [
    [
      208,
      107,
      104,
      210
    ],
    [
      107,
      208,
      210,
      104
    ],
    [
      1,
      0,
      0,
      0
    ],
    [
      0,
      1,
      0,
      0
    ]
  ],
  "恢复记录": [
    [
      1,
      4
    ],
    [
      0,
      3
    ],
    [
      0,
      1
    ]
  ],
  "每次补回字节": [
    [
      200,
      197
    ],
    [
      23,
      137
    ],
    [
      23,
      200
    ]
  ],
  "编码次数": 1,
  "丢失次数": 6,
  "恢复次数": 3,
  "前缀不变": true,
  "上四行是单位阵": true,
  "恢复后一致": true,
  "校验自洽": true,
  "逆乘可用块一致": true,
  "取块下标升序": true,
  "重放不新增": 0,
  "重放报错条数": 0,
  "拆两轮中间态不同": true,
  "拆两轮收尾态一致": true,
  "异常事件数": 0,
  "块下标越界报码": "E_BAD_INDEX",
  "重复丢失报码": "E_ALREADY_LOST",
  "丢失超额报码": "E_TOO_MANY",
  "无丢失恢复报码": "E_NO_LOSS",
  "零元求逆报码": "E_ZERO",
  "字节越界报码": "E_BAD_VALUE"
};
function __same(got, want) {
  if (typeof got === "string") {
    try { const parsed = JSON.parse(got); if (JSON.stringify(parsed) === JSON.stringify(want)) return true; } catch (error) { }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) { __bad += 1; console.log("缺失验收项 " + label); continue; }
  if (__same(found[1], want)) { console.log("一致 " + label + " = " + JSON.stringify(found[1])); }
  else { __bad += 1; console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(found[1])); }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
