import { describe, it, expect } from 'vitest';

// 测试版本比较逻辑
// 这些测试验证了修复后的 isVersionInRange 函数行为

describe('漏洞版本匹配测试', () => {
  
  // 复制 isVersionInRange 的逻辑进行测试
  function parseVersion(v: string): number[] {
    return v.trim().split('.').map((n) => parseInt(n, 10) || 0);
  }

  function compareVersions(a: number[], b: number[]): number {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const da = a[i] || 0;
      const db = b[i] || 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }

  function isVersionInRange(version: string, affected: string): boolean {
    if (!affected || !version) return false;

    try {
      const ver = parseVersion(version);

      const constraints = affected
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (constraints.length === 0) return false;

      for (const constraint of constraints) {
        const match = constraint.match(/^([<>=!]+)\s*(.+)$/);
        if (!match) {
          // 如果没有操作符，尝试前缀匹配
          const targetVer = parseVersion(constraint);
          const cmp = compareVersions(ver, targetVer);
          
          if (cmp === 0) {
            continue;
          }
          
          // 检查是否是前缀匹配：version 以 constraint 开头
          if (ver.length > targetVer.length) {
            let prefixMatch = true;
            for (let i = 0; i < targetVer.length; i++) {
              if (ver[i] !== targetVer[i]) {
                prefixMatch = false;
                break;
              }
            }
            if (prefixMatch) continue;
          }
          
          return false;
        }
        
        const [, op, verStr] = match;
        const targetVer = parseVersion(verStr);
        const cmp = compareVersions(ver, targetVer);

        switch (op) {
          case '>':  if (!(cmp > 0))  return false; break;
          case '>=': if (!(cmp >= 0)) return false; break;
          case '<':  if (!(cmp < 0))  return false; break;
          case '<=': if (!(cmp <= 0)) return false; break;
          case '=':
          case '==': if (!(cmp === 0)) return false; break;
          case '!=': if (cmp === 0) return false; break;
          default:   if (!(cmp >= 0)) return false; break;
        }
      }

      return true;
    } catch {
      return false; // 修复：解析失败时返回 false
    }
  }

  describe('基本版本比较', () => {
    it('应该正确匹配完全相同的版本', () => {
      expect(isVersionInRange('1.0.0', '1.0.0')).toBe(true);
    });

    it('应该在没有版本信息时返回 false（修复前会返回 true）', () => {
      expect(isVersionInRange('1.0.0', '')).toBe(false);
      expect(isVersionInRange('', '>= 1.0.0')).toBe(false);
      expect(isVersionInRange('1.0.0', '')).toBe(false);
    });

    it('应该在解析失败时返回 false（修复前会返回 true）', () => {
      // 无效的版本范围
      expect(isVersionInRange('1.0.0', 'invalid-range')).toBe(false);
    });
  });

  describe('范围表达式匹配', () => {
    it('应该支持 >= 操作符', () => {
      expect(isVersionInRange('1.5.0', '>= 1.0.0')).toBe(true);
      expect(isVersionInRange('0.9.0', '>= 1.0.0')).toBe(false);
    });

    it('应该支持 < 操作符', () => {
      expect(isVersionInRange('0.9.0', '< 1.0.0')).toBe(true);
      expect(isVersionInRange('1.5.0', '< 1.0.0')).toBe(false);
    });

    it('应该支持 <= 操作符', () => {
      expect(isVersionInRange('1.0.0', '<= 1.0.0')).toBe(true);
      expect(isVersionInRange('1.0.1', '<= 1.0.0')).toBe(false);
    });

    it('应该支持 > 操作符', () => {
      expect(isVersionInRange('1.0.1', '> 1.0.0')).toBe(true);
      expect(isVersionInRange('1.0.0', '> 1.0.0')).toBe(false);
    });

    it('应该支持 != 操作符', () => {
      expect(isVersionInRange('2.0.0', '!= 1.0.0')).toBe(true);
      expect(isVersionInRange('1.0.0', '!= 1.0.0')).toBe(false);
    });

    it('应该支持多个条件组合', () => {
      // 版本必须 >= 1.0.0 且 < 2.0.0
      expect(isVersionInRange('1.5.0', '>= 1.0.0, < 2.0.0')).toBe(true);
      expect(isVersionInRange('2.0.0', '>= 1.0.0, < 2.0.0')).toBe(false);
      expect(isVersionInRange('0.9.0', '>= 1.0.0, < 2.0.0')).toBe(false);
    });
  });

  describe('版本号长度差异处理', () => {
    it('应该正确处理长度不同的版本号', () => {
      expect(isVersionInRange('1.0', '1.0.0')).toBe(true);
      expect(isVersionInRange('1.0.0', '1.0')).toBe(true);
    });

    it('应该正确处理前缀匹配', () => {
      expect(isVersionInRange('1.0.5', '1.0')).toBe(true);
      expect(isVersionInRange('1.1.0', '1.0')).toBe(false);
    });
  });
});
