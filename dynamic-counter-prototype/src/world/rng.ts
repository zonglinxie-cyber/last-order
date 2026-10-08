// 人情场的确定性随机：不持有状态，每一次抽数都由 (seed, 第几抽) 唯一决定。
// 引擎把"已经抽了几次"记在 World.rngCalls 里，所以同一个种子、同一串操作，
// 结果逐位相同 —— 包括存档往返之后（rngCalls 随存档走）。

/** FNV-1a：把任意字符串（种子）折成 32 位整数。 */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** splitmix 风格终 mixing：相邻两抽之间也要足够散。 */
function mix32(a: number): number {
  a |= 0;
  a = (a + 0x9e3779b9) | 0;
  let t = Math.imul(a ^ (a >>> 16), 0x21f0aaad);
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
  return (t ^ (t >>> 15)) >>> 0;
}

/** 第 n 抽：0..1 的均匀分布。 */
export function draw(seed: string, n: number): number {
  return mix32(hashSeed(seed) ^ Math.imul(n + 1, 0x9e3779b1)) / 4294967296;
}

/** 概率判定：draw < p。 */
export function chance(seed: string, n: number, p: number): boolean {
  return draw(seed, n) < p;
}

/** [lo, hi] 闭区间整数。 */
export function drawInt(seed: string, n: number, lo: number, hi: number): number {
  if (hi <= lo) return lo;
  return lo + Math.floor(draw(seed, n) * (hi - lo + 1));
}

/** 等概率取一个下标。空数组返回 -1。 */
export function drawIndex(seed: string, n: number, length: number): number {
  if (length <= 0) return -1;
  return Math.floor(draw(seed, n) * length);
}

/** 按权重取一个下标；权重全 <=0 或空表返回 -1。 */
export function drawWeighted(seed: string, n: number, weights: number[]): number {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return -1;
  let r = draw(seed, n) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return i;
  }
  return weights.length - 1;
}
