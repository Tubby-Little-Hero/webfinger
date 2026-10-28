// ============================================================
// WebFinger - MurmurHash3 Implementation
// 用于 favicon hash 计算（兼容 Shodan 格式）
// ============================================================

/**
 * MurmurHash3 32-bit x86 实现
 * 与 Shodan 的 favicon hash 算法兼容
 */
export function murmur3_32(key: string, seed: number = 0): number {
  let len = key.length;
  let h = seed ^ len;
  let i = 0;

  // 每次处理 4 字节
  for (; len >= 4; len -= 4, i += 4) {
    let k =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);

    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);

    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = Math.imul(h, 5) + 0xe6546b64;
  }

  // 处理剩余 1-3 字节
  if (len > 0) {
    let k = 0;
    if (len >= 3) k |= (key.charCodeAt(i + 2) & 0xff) << 16;
    if (len >= 2) k |= (key.charCodeAt(i + 1) & 0xff) << 8;
    if (len >= 1) k |= key.charCodeAt(i) & 0xff;

    k = Math.imul(k, 0xcc9e2d51);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, 0x1b873593);

    h ^= k;
  }

  // 最终混合
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;

  return h >>> 0; // 返回无符号 32 位整数
}

/**
 * 用于测试：验证 MurmurHash3 实现是否正确
 */
export function testMurmurHash3(): boolean {
  // 已知的测试向量
  const test1 = murmur3_32('test', 0);
  const known1 = 3127628307;
  return test1 === known1;
}
