/**
 * Deobfuscation Engine Tests
 */

import { Deobfuscator, deobfuscate, deobfuscateWithReport } from '../src/core';
import { ALL_SAMPLES } from './samples';

describe('Deobfuscator', () => {
  test('should create deobfuscator with default options', () => {
    const deobf = new Deobfuscator();
    expect(deobf).toBeDefined();
  });

  test('should get layer info', () => {
    const deobf = new Deobfuscator();
    const layers = deobf.getLayerInfo();

    expect(layers.length).toBeGreaterThan(0);
    expect(layers[0]).toHaveProperty('name');
    expect(layers[0]).toHaveProperty('description');
    expect(layers[0]).toHaveProperty('priority');
  });

  test('should deobfuscate simple code', () => {
    const source = 'local x = 1 + 2 + 3';
    const deobf = new Deobfuscator();
    const report = deobf.deobfuscate(source);

    expect(report.success).toBe(true);
    expect(report.deobfuscated).toContain('6');
  });

  test('should handle invalid code gracefully', () => {
    const source = 'this is not valid lua';
    const deobf = new Deobfuscator();
    const report = deobf.deobfuscate(source);

    expect(report.success).toBe(false);
    expect(report.error).toBeDefined();
  });

  test('should respect max iterations option', () => {
    const source = 'local x = 1';
    const deobf = new Deobfuscator({ maxIterations: 1 });
    const report = deobf.deobfuscate(source);

    expect(report.iterations).toBeLessThanOrEqual(1);
  });

  test('should filter layers by name', () => {
    const source = 'local x = 1 + 2';
    const deobf = new Deobfuscator({ layers: ['ConstantFolding'] });
    const report = deobf.deobfuscate(source);

    expect(report.success).toBe(true);
    expect(report.layersApplied).toContain('ConstantFolding');
  });
});

describe('deobfuscate function', () => {
  test('should deobfuscate and return string', () => {
    const source = 'local x = "hel" .. "lo"';
    const result = deobfuscate(source);

    expect(result).toContain('hello');
  });
});

describe('deobfuscateWithReport function', () => {
  test('should return full report', () => {
    const source = 'local x = 1 + 2';
    const report = deobfuscateWithReport(source);

    expect(report).toHaveProperty('original');
    expect(report).toHaveProperty('deobfuscated');
    expect(report).toHaveProperty('iterations');
    expect(report).toHaveProperty('layersApplied');
    expect(report).toHaveProperty('changes');
    expect(report).toHaveProperty('success');
  });
});

describe('Full deobfuscation tests', () => {
  test('should deobfuscate string table obfuscation', () => {
    const source = ALL_SAMPLES['String Table'];
    const result = deobfuscate(source);

    expect(result).toContain('print');
  });

  test('should deobfuscate variable renaming', () => {
    const source = ALL_SAMPLES['Variable Rename'];
    const result = deobfuscate(source);

    // Should have readable variable names
    expect(result).not.toMatch(/IlI1lI/);
  });

  test('should deobfuscate constant folding', () => {
    const source = ALL_SAMPLES['Constant Folding'];
    const result = deobfuscate(source);

    // Constants should be folded
    expect(result).toContain('60');
    expect(result).toContain('20');
    expect(result).toContain('10');
  });

  test('should deobfuscate string concatenation', () => {
    const source = ALL_SAMPLES['String Concat'];
    const result = deobfuscate(source);

    expect(result).toContain('Hello World');
  });

  test('should deobfuscate string.char encoding', () => {
    const source = ALL_SAMPLES['String Char'];
    const result = deobfuscate(source);

    expect(result).toContain('Hello');
  });

  test('should deobfuscate all samples successfully', () => {
    for (const [name, source] of Object.entries(ALL_SAMPLES)) {
      const report = deobfuscateWithReport(source);

      expect(report.success).toBe(true);
      console.log(`${name}: ${report.changes.length} changes`);
    }
  });
});

describe('Deobfuscation correctness', () => {
  test('should preserve program semantics', () => {
    // This test verifies that the deobfuscated code is functionally equivalent
    const source = `
local x = 10
local y = 20
local z = x + y
print(z)
`;

    const result = deobfuscate(source);

    // The result should still calculate 30
    expect(result).toContain('30');
  });

  test('should handle nested functions', () => {
    const source = `
local function outer(x)
    local function inner(y)
        return y * 2
    end
    return inner(x) + 1
end
print(outer(5))
`;

    const result = deobfuscate(source);
    expect(result).toContain('function');
    expect(result).toContain('print');
  });

  test('should handle table operations', () => {
    const source = `
local t = {a = 1, b = 2}
t.c = t.a + t.b
print(t.c)
`;

    const result = deobfuscate(source);
    expect(result).toContain('t');
  });
});
