/**
 * Deobfuscation Layer Tests
 */

import {
  StringDecoderLayer,
  ControlFlowCleanerLayer,
  VariableRenamerLayer,
  ConstantFoldingLayer,
  DeadCodeRemoverLayer
} from '../src/layers';
import { parse, generate } from '../src/parser';
import { ALL_SAMPLES } from './samples';

describe('StringDecoderLayer', () => {
  const layer = new StringDecoderLayer();

  test('should decode string from array', () => {
    const source = 'local t = {"hello", "world"}\nprint(t[1])';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  test('should resolve string concatenation', () => {
    const source = 'local s = "hel" .. "lo"';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
  });

  test('should resolve string.char calls', () => {
    const source = 'local s = string.char(72, 101, 108, 108, 111)';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
  });
});

describe('ControlFlowCleanerLayer', () => {
  const layer = new ControlFlowCleanerLayer();

  test('should remove always-true while loops', () => {
    const source = 'while true do x = 1 break end';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
  });

  test('should remove dead code blocks', () => {
    const source = 'if false then print(1) end';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
  });
});

describe('VariableRenamerLayer', () => {
  const layer = new VariableRenamerLayer();

  test('should rename confusing variable names', () => {
    const source = 'local IlI1lI = 5\nprint(IlI1lI)';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
    const generated = generate(result.ast);
    expect(generated).not.toContain('IlI1lI');
  });

  test('should not rename reserved words', () => {
    const source = 'local print = print\nprint(1)';
    const ast = parse(source);
    const result = layer.process(ast);

    const generated = generate(result.ast);
    expect(generated).toContain('print');
  });
});

describe('ConstantFoldingLayer', () => {
  const layer = new ConstantFoldingLayer();

  test('should fold arithmetic expressions', () => {
    const source = 'local x = (1 + 2) * 3';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
    const generated = generate(result.ast);
    expect(generated).toContain('9');
  });

  test('should fold string operations', () => {
    const source = 'local n = string.len("hello")';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
    const generated = generate(result.ast);
    expect(generated).toContain('5');
  });
});

describe('DeadCodeRemoverLayer', () => {
  const layer = new DeadCodeRemoverLayer();

  test('should remove empty do blocks', () => {
    const source = 'do end\nx = 1';
    const ast = parse(source);
    const result = layer.process(ast);

    expect(result.modified).toBe(true);
  });
});

describe('Integration Tests', () => {
  test('should deobfuscate string table sample', () => {
    const source = ALL_SAMPLES['String Table'];
    const ast = parse(source);

    const layers = [
      new StringDecoderLayer(),
      new ConstantFoldingLayer(),
      new DeadCodeRemoverLayer()
    ];

    let result = ast;
    for (const layer of layers) {
      const r = layer.process(result);
      result = r.ast;
    }

    const generated = generate(result);
    expect(generated).toContain('print');
  });

  test('should deobfuscate Prometheus Weak sample', () => {
    const source = ALL_SAMPLES['Prometheus Weak'];
    const ast = parse(source);

    const layers = [
      new ConstantFoldingLayer(),
      new StringDecoderLayer(),
      new ControlFlowCleanerLayer(),
      new VariableRenamerLayer(),
      new DeadCodeRemoverLayer()
    ];

    let result = ast;
    for (const layer of layers) {
      const r = layer.process(result);
      result = r.ast;
    }

    const generated = generate(result);
    // Should have meaningful variable names
    expect(generated).toBeDefined();
    expect(generated.length).toBeGreaterThan(0);
  });

  test('should handle all samples without errors', () => {
    for (const [name, source] of Object.entries(ALL_SAMPLES)) {
      expect(() => {
        const ast = parse(source);
        const layers = [
          new ConstantFoldingLayer(),
          new StringDecoderLayer(),
          new ControlFlowCleanerLayer(),
          new VariableRenamerLayer(),
          new DeadCodeRemoverLayer()
        ];

        let result = ast;
        for (const layer of layers) {
          const r = layer.process(result);
          result = r.ast;
        }

        generate(result);
      }).not.toThrow();
    }
  });
});
