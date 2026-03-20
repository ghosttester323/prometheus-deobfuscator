/**
 * Parser Tests
 */

import { parse, generate, tokenize } from '../src/parser';

describe('Lexer', () => {
  test('should tokenize simple identifiers', () => {
    const tokens = tokenize('local x = 5');
    expect(tokens.some(t => t.type === 'Identifier' && t.value === 'x')).toBe(true);
  });

  test('should tokenize numeric literals', () => {
    const tokens = tokenize('x = 42');
    expect(tokens.some(t => t.type === 'NumericLiteral' && t.value === '42')).toBe(true);
  });

  test('should tokenize string literals', () => {
    const tokens = tokenize('x = "hello"');
    expect(tokens.some(t => t.type === 'StringLiteral' && t.value === 'hello')).toBe(true);
  });

  test('should tokenize keywords', () => {
    const tokens = tokenize('local function if then else end');
    expect(tokens.filter(t => t.type === 'Keyword').length).toBe(6);
  });

  test('should handle long strings', () => {
    const tokens = tokenize('x = [[hello world]]');
    expect(tokens.some(t => t.type === 'StringLiteral' && t.value === 'hello world')).toBe(true);
  });

  test('should handle comments', () => {
    const tokens = tokenize('x = 1 -- comment\ny = 2');
    expect(tokens.some(t => t.type === 'NumericLiteral' && t.value === '1')).toBe(true);
    expect(tokens.some(t => t.type === 'NumericLiteral' && t.value === '2')).toBe(true);
  });
});

describe('Parser', () => {
  test('should parse local variable declaration', () => {
    const ast = parse('local x = 5');
    expect(ast.body[0].type).toBe('LocalStatement');
  });

  test('should parse function declaration', () => {
    const ast = parse('function foo() end');
    expect(ast.body[0].type).toBe('FunctionDeclaration');
  });

  test('should parse if statement', () => {
    const ast = parse('if true then print(1) end');
    expect(ast.body[0].type).toBe('IfStatement');
  });

  test('should parse while loop', () => {
    const ast = parse('while true do break end');
    expect(ast.body[0].type).toBe('WhileStatement');
  });

  test('should parse for loop', () => {
    const ast = parse('for i = 1, 10 do print(i) end');
    expect(ast.body[0].type).toBe('ForStatement');
  });

  test('should parse for-in loop', () => {
    const ast = parse('for k, v in pairs(t) do print(k, v) end');
    expect(ast.body[0].type).toBe('ForInStatement');
  });

  test('should parse table constructor', () => {
    const ast = parse('local t = {1, 2, 3}');
    const stmt = ast.body[0] as any;
    expect(stmt.init[0].type).toBe('TableConstructorExpression');
  });

  test('should parse table with key-value pairs', () => {
    const ast = parse('local t = {a = 1, b = 2}');
    const stmt = ast.body[0] as any;
    expect(stmt.init[0].fields.length).toBe(2);
  });

  test('should parse member expressions', () => {
    const ast = parse('x.y.z = 1');
    const stmt = ast.body[0] as any;
    expect(stmt.variables[0].type).toBe('MemberExpression');
  });

  test('should parse method calls', () => {
    const ast = parse('obj:method(1, 2)');
    const stmt = ast.body[0] as any;
    expect(stmt.expression.base.indexer).toBe(':');
  });
});

describe('Generator', () => {
  test('should generate simple assignment', () => {
    const source = 'local x = 5';
    const ast = parse(source);
    const generated = generate(ast);
    expect(generated.trim()).toBe('local x = 5');
  });

  test('should generate function declaration', () => {
    const source = 'function foo(a, b) return a + b end';
    const ast = parse(source);
    const generated = generate(ast);
    expect(generated).toContain('function foo(a, b)');
    expect(generated).toContain('return a + b');
    expect(generated).toContain('end');
  });

  test('should generate if statement', () => {
    const source = 'if x > 0 then print(x) end';
    const ast = parse(source);
    const generated = generate(ast);
    expect(generated).toContain('if x > 0 then');
    expect(generated).toContain('end');
  });

  test('should generate table constructor', () => {
    const source = 'local t = {a = 1, b = 2}';
    const ast = parse(source);
    const generated = generate(ast);
    expect(generated).toContain('a = 1');
    expect(generated).toContain('b = 2');
  });
});

describe('Round-trip', () => {
  test('should round-trip simple code', () => {
    const sources = [
      'local x = 5',
      'print("hello")',
      'x = x + 1',
      'if true then end',
      'while false do break end'
    ];

    for (const source of sources) {
      const ast = parse(source);
      const generated = generate(ast);
      expect(generated.trim()).toBe(source);
    }
  });
});
