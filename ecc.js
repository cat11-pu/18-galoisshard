// ecc.js：编码、标记丢失与恢复（基线：一律原样返回）
import { gfMul, generatorOf, multiply, invert } from "./galois.js";

export function encode(state, data) {
  return state;
}

export function lose(state, index) {
  return state;
}

export function recover(state) {
  return state;
}
