// galois.js：GF(256) 的域乘、域逆与生成矩阵（本原多项式 0x11D）
const PRIM = 0x11d;

function fail(code) {
  throw Object.assign(new Error(code), { code: code });
}

export function gfMul(a, b) {
  let x = a;
  let y = b;
  let acc = 0;
  while (y > 0) {
    if (y & 1) { acc ^= x; }
    y >>= 1;
    x <<= 1;
    if (x & 0x100) { x ^= PRIM; }
  }
  return acc;
}

export function gfInv(a) {
  if (a === 0) { fail("E_ZERO"); }
  let result = 1;
  let base = a;
  let exp = 254;
  while (exp > 0) {
    if (exp & 1) { result = gfMul(result, base); }
    base = gfMul(base, base);
    exp >>= 1;
  }
  return result;
}

export function multiply(matrix, vector) {
  return matrix.map(function (row) {
    let acc = 0;
    for (let j = 0; j < row.length; j += 1) { acc ^= gfMul(row[j], vector[j]); }
    return acc;
  });
}

export function invert(matrix) {
  const n = matrix.length;
  if (n === 0 || matrix.some(function (row) { return !Array.isArray(row) || row.length !== n; })) {
    fail("E_BAD_SHAPE");
  }
  const aug = matrix.map(function (row, i) {
    return row.slice().concat(row.map(function (_, j) { return i === j ? 1 : 0; }));
  });
  for (let col = 0; col < n; col += 1) {
    let pivot = -1;
    for (let r = col; r < n; r += 1) {
      if (aug[r][col] !== 0) { pivot = r; break; }
    }
    if (pivot < 0) { fail("E_SINGULAR"); }
    const swap = aug[col]; aug[col] = aug[pivot]; aug[pivot] = swap;
    const inv = gfInv(aug[col][col]);
    for (let c = 0; c < 2 * n; c += 1) { aug[col][c] = gfMul(aug[col][c], inv); }
    for (let r = 0; r < n; r += 1) {
      if (r !== col && aug[r][col] !== 0) {
        const factor = aug[r][col];
        for (let c = 0; c < 2 * n; c += 1) { aug[r][c] ^= gfMul(factor, aug[col][c]); }
      }
    }
  }
  return aug.map(function (row) { return row.slice(n); });
}

export function generatorOf(k, m) {
  if (!Number.isInteger(k) || !Number.isInteger(m) || k < 1 || m < 1) {
    fail("E_BAD_SHAPE");
  }
  const rows = [];
  for (let r = 0; r < k + m; r += 1) {
    const row = [];
    let power = 1;
    for (let c = 0; c < k; c += 1) {
      row.push(power);
      power = gfMul(power, r);
    }
    rows.push(row);
  }
  const topInv = invert(rows.slice(0, k));
  return rows.map(function (row) {
    const out = [];
    for (let c = 0; c < k; c += 1) {
      let acc = 0;
      for (let j = 0; j < k; j += 1) { acc ^= gfMul(row[j], topInv[j][c]); }
      out.push(acc);
    }
    return out;
  });
}
