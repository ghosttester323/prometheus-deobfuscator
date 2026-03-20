/**
 * Lua Parser
 * Parses Lua source code into an Abstract Syntax Tree
 */

import { Token, tokenize as lex } from './lexer';
import * as t from './types';

export class LuaParser {
  private tokens: Token[];
  private index: number = 0;

  constructor(source: string) {
    this.tokens = lex(source);
  }

  parse(): t.Program {
    const start = this.current().loc.start;
    const body: t.Statement[] = [];

    while (!this.eof()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    return {
      type: 'Program',
      body,
      loc: { start, end: this.previous().loc.end }
    };
  }

  private current(): Token {
    return this.tokens[this.index] || this.tokens[this.tokens.length - 1];
  }

  private previous(): Token {
    return this.tokens[Math.max(0, this.index - 1)];
  }

  private peek(offset: number = 0): Token {
    return this.tokens[this.index + offset] || this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const token = this.current();
    if (!this.eof()) this.index++;
    return token;
  }

  private eof(): boolean {
    return this.current().type === 'EOF';
  }

  private match(...types: string[]): boolean {
    return types.includes(this.current().type) ||
           types.includes(this.current().value);
  }

  private expect(type: string, value?: string): Token {
    const token = this.current();
    if (token.type !== type && (!value || token.value !== value)) {
      throw new Error(
        `Expected ${type}${value ? ` '${value}'` : ''} ` +
        `but got ${token.type} '${token.value}' at line ${token.loc.start.line}`
      );
    }
    return this.advance();
  }

  private parseStatement(): t.Statement | null {
    if (this.eof()) return null;

    const token = this.current();

    // Check for various statement types
    if (token.type === 'Keyword') {
      switch (token.value) {
        case 'local':
          return this.parseLocalStatement();
        case 'if':
          return this.parseIfStatement();
        case 'while':
          return this.parseWhileStatement();
        case 'repeat':
          return this.parseRepeatStatement();
        case 'for':
          return this.parseForStatement();
        case 'function':
          return this.parseFunctionDeclaration();
        case 'return':
          return this.parseReturnStatement();
        case 'break':
          return this.parseBreakStatement();
        case 'do':
          return this.parseDoStatement();
        case 'goto':
          return this.parseGotoStatement();
      }
    }

    // Label ::name::
    if (token.type === 'Punctuator' && token.value === '::') {
      return this.parseLabelStatement();
    }

    // Expression statement (assignment or function call)
    return this.parseExpressionStatement();
  }

  private parseLocalStatement(): t.Statement {
    this.expect('Keyword', 'local');

    // local function name() ... end
    if (this.match('Keyword', 'function')) {
      return this.parseLocalFunctionDeclaration();
    }

    // local name = value
    const variables: t.Identifier[] = [];
    do {
      const name = this.expect('Identifier').value;
      variables.push({ type: 'Identifier', name });
    } while (this.match('Punctuator', ',') && this.advance());

    const init: t.Expression[] = [];
    if (this.match('Punctuator', '=')) {
      this.advance();
      do {
        init.push(this.parseExpression());
      } while (this.match('Punctuator', ',') && this.advance());
    }

    return {
      type: 'LocalStatement',
      variables,
      init
    };
  }

  private parseLocalFunctionDeclaration(): t.LocalFunctionDeclaration {
    this.expect('Keyword', 'function');
    const name = this.expect('Identifier').value;
    const { parameters, body } = this.parseFunctionBody();

    return {
      type: 'LocalFunctionDeclaration',
      identifier: { type: 'Identifier', name },
      parameters,
      body
    };
  }

  private parseFunctionDeclaration(): t.FunctionDeclaration {
    this.expect('Keyword', 'function');

    // Parse function name (can be a.b.c or a:b)
    let identifier: t.Identifier | t.MemberExpression =
      { type: 'Identifier', name: this.expect('Identifier').value };

    while (this.match('Punctuator', '.') || this.match('Punctuator', ':')) {
      const indexer = this.advance().value as '.' | ':';
      const prop = this.expect('Identifier').value;
      identifier = {
        type: 'MemberExpression',
        base: identifier,
        identifier: { type: 'Identifier', name: prop },
        indexer
      };
    }

    const { parameters, body } = this.parseFunctionBody();

    return {
      type: 'FunctionDeclaration',
      identifier,
      parameters,
      body
    };
  }

  private parseFunctionBody(): { parameters: (t.Identifier | t.VarargLiteral)[], body: t.Statement[] } {
    this.expect('Punctuator', '(');

    const parameters: (t.Identifier | t.VarargLiteral)[] = [];

    if (!this.match('Punctuator', ')')) {
      do {
        if (this.match('VarargLiteral')) {
          parameters.push({ type: 'VarargLiteral', value: '...', raw: '...' });
          this.advance();
        } else {
          const name = this.expect('Identifier').value;
          parameters.push({ type: 'Identifier', name });
        }
      } while (this.match('Punctuator', ',') && this.advance());
    }

    this.expect('Punctuator', ')');

    const body: t.Statement[] = [];
    while (!this.match('Keyword', 'end') && !this.eof()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    this.expect('Keyword', 'end');

    return { parameters, body };
  }

  private parseIfStatement(): t.IfStatement {
    this.expect('Keyword', 'if');
    const condition = this.parseExpression();
    this.expect('Keyword', 'then');

    const clauses: t.IfClause[] = [];
    const thenBody: t.Statement[] = [];

    while (!this.match('Keyword', 'elseif') &&
           !this.match('Keyword', 'else') &&
           !this.match('Keyword', 'end') &&
           !this.eof()) {
      const stmt = this.parseStatement();
      if (stmt) thenBody.push(stmt);
    }

    clauses.push({ type: 'IfClause', condition, body: thenBody });

    while (this.match('Keyword', 'elseif')) {
      this.advance();
      const elseifCondition = this.parseExpression();
      this.expect('Keyword', 'then');
      const elseifBody: t.Statement[] = [];

      while (!this.match('Keyword', 'elseif') &&
             !this.match('Keyword', 'else') &&
             !this.match('Keyword', 'end') &&
             !this.eof()) {
        const stmt = this.parseStatement();
        if (stmt) elseifBody.push(stmt);
      }

      clauses.push({ type: 'IfClause', condition: elseifCondition, body: elseifBody });
    }

    if (this.match('Keyword', 'else')) {
      this.advance();
      const elseBody: t.Statement[] = [];

      while (!this.match('Keyword', 'end') && !this.eof()) {
        const stmt = this.parseStatement();
        if (stmt) elseBody.push(stmt);
      }

      clauses.push({ type: 'IfClause', body: elseBody });
    }

    this.expect('Keyword', 'end');

    return { type: 'IfStatement', clauses };
  }

  private parseWhileStatement(): t.WhileStatement {
    this.expect('Keyword', 'while');
    const condition = this.parseExpression();
    this.expect('Keyword', 'do');

    const body: t.Statement[] = [];
    while (!this.match('Keyword', 'end') && !this.eof()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    this.expect('Keyword', 'end');

    return { type: 'WhileStatement', condition, body };
  }

  private parseRepeatStatement(): t.RepeatStatement {
    this.expect('Keyword', 'repeat');

    const body: t.Statement[] = [];
    while (!this.match('Keyword', 'until') && !this.eof()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    this.expect('Keyword', 'until');
    const condition = this.parseExpression();

    return { type: 'RepeatStatement', body, condition };
  }

  private parseForStatement(): t.Statement {
    this.expect('Keyword', 'for');

    const name = this.expect('Identifier').value;
    const variable: t.Identifier = { type: 'Identifier', name };

    // for name = start, end, step do ... end
    if (this.match('Punctuator', '=')) {
      this.advance();
      const start = this.parseExpression();
      this.expect('Punctuator', ',');
      const end = this.parseExpression();
      let step: t.Expression | undefined;
      if (this.match('Punctuator', ',')) {
        this.advance();
        step = this.parseExpression();
      }
      this.expect('Keyword', 'do');

      const body: t.Statement[] = [];
      while (!this.match('Keyword', 'end') && !this.eof()) {
        const stmt = this.parseStatement();
        if (stmt) body.push(stmt);
      }
      this.expect('Keyword', 'end');

      return { type: 'ForStatement', variable, start, end, step, body };
    }

    // for name in iterator do ... end
    if (this.match('Keyword', 'in')) {
      this.advance();
      const iterators: t.Expression[] = [];
      do {
        iterators.push(this.parseExpression());
      } while (this.match('Punctuator', ',') && this.advance());

      this.expect('Keyword', 'do');

      const body: t.Statement[] = [];
      while (!this.match('Keyword', 'end') && !this.eof()) {
        const stmt = this.parseStatement();
        if (stmt) body.push(stmt);
      }
      this.expect('Keyword', 'end');

      return { type: 'ForInStatement', variables: [variable], iterators, body };
    }

    // for var1, var2, ... in iterator do ... end
    const variables: t.Identifier[] = [variable];
    while (this.match('Punctuator', ',')) {
      this.advance();
      const nextName = this.expect('Identifier').value;
      variables.push({ type: 'Identifier', name: nextName });
    }

    this.expect('Keyword', 'in');
    const iterators: t.Expression[] = [];
    do {
      iterators.push(this.parseExpression());
    } while (this.match('Punctuator', ',') && this.advance());

    this.expect('Keyword', 'do');

    const body: t.Statement[] = [];
    while (!this.match('Keyword', 'end') && !this.eof()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.expect('Keyword', 'end');

    return { type: 'ForInStatement', variables, iterators, body };
  }

  private parseReturnStatement(): t.ReturnStatement {
    this.expect('Keyword', 'return');

    const args: t.Expression[] = [];
    if (!this.match('Keyword', 'end') &&
        !this.match('Keyword', 'else') &&
        !this.match('Keyword', 'elseif') &&
        !this.match('Keyword', 'until') &&
        !this.eof()) {
      do {
        args.push(this.parseExpression());
      } while (this.match('Punctuator', ',') && this.advance());
    }

    return { type: 'ReturnStatement', arguments: args };
  }

  private parseBreakStatement(): t.BreakStatement {
    this.expect('Keyword', 'break');
    return { type: 'BreakStatement' };
  }

  private parseDoStatement(): t.DoStatement {
    this.expect('Keyword', 'do');

    const body: t.Statement[] = [];
    while (!this.match('Keyword', 'end') && !this.eof()) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }

    this.expect('Keyword', 'end');

    return { type: 'DoStatement', body };
  }

  private parseLabelStatement(): t.LabelStatement {
    this.expect('Punctuator', '::');
    const name = this.expect('Identifier').value;
    this.expect('Punctuator', '::');

    return {
      type: 'LabelStatement',
      label: { type: 'Identifier', name }
    };
  }

  private parseGotoStatement(): t.GotoStatement {
    this.expect('Keyword', 'goto');
    const name = this.expect('Identifier').value;

    return {
      type: 'GotoStatement',
      label: { type: 'Identifier', name }
    };
  }

  private parseExpressionStatement(): t.Statement {
    const expression = this.parseExpression();

    // Assignment
    if (this.match('Punctuator', '=') || this.match('Punctuator', ',')) {
      const variables: t.Expression[] = [expression];

      while (this.match('Punctuator', ',')) {
        this.advance();
        variables.push(this.parsePrimaryExpression());
      }

      this.expect('Punctuator', '=');

      const init: t.Expression[] = [];
      do {
        init.push(this.parseExpression());
      } while (this.match('Punctuator', ',') && this.advance());

      return { type: 'AssignmentStatement', variables, init };
    }

    // Function call
    if (expression.type === 'CallExpression' ||
        expression.type === 'TableCallExpression' ||
        expression.type === 'StringCallExpression') {
      return { type: 'CallStatement', expression };
    }

    throw new Error(`Unexpected expression type: ${expression.type}`);
  }

  private parseExpression(): t.Expression {
    return this.parseLogicalExpression();
  }

  private parseLogicalExpression(): t.Expression {
    let left = this.parseRelationalExpression();

    while (this.match('Keyword', 'and') || this.match('Keyword', 'or')) {
      const operator = this.advance().value as 'and' | 'or';
      const right = this.parseRelationalExpression();
      left = { type: 'LogicalExpression', operator, left, right };
    }

    return left;
  }

  private parseRelationalExpression(): t.Expression {
    let left = this.parseConcatExpression();

    while (this.match('Punctuator', '<') || this.match('Punctuator', '>') ||
           this.match('Punctuator', '<=') || this.match('Punctuator', '>=') ||
           this.match('Punctuator', '==') || this.match('Punctuator', '~=')) {
      const operator = this.advance().value as t.BinaryOperator;
      const right = this.parseConcatExpression();
      left = { type: 'BinaryExpression', operator, left, right };
    }

    return left;
  }

  private parseConcatExpression(): t.Expression {
    const expressions: t.Expression[] = [this.parseAdditiveExpression()];

    while (this.match('Punctuator', '..')) {
      this.advance();
      expressions.push(this.parseAdditiveExpression());
    }

    if (expressions.length === 1) {
      return expressions[0];
    }

    // Right-associative
    let result = expressions.pop()!;
    while (expressions.length > 0) {
      result = {
        type: 'BinaryExpression',
        operator: '..',
        left: expressions.pop()!,
        right: result
      };
    }
    return result;
  }

  private parseAdditiveExpression(): t.Expression {
    let left = this.parseMultiplicativeExpression();

    while (this.match('Punctuator', '+') || this.match('Punctuator', '-')) {
      const operator = this.advance().value as t.BinaryOperator;
      const right = this.parseMultiplicativeExpression();
      left = { type: 'BinaryExpression', operator, left, right };
    }

    return left;
  }

  private parseMultiplicativeExpression(): t.Expression {
    let left = this.parseUnaryExpression();

    while (this.match('Punctuator', '*') || this.match('Punctuator', '/') ||
           this.match('Punctuator', '%')) {
      const operator = this.advance().value as t.BinaryOperator;
      const right = this.parseUnaryExpression();
      left = { type: 'BinaryExpression', operator, left, right };
    }

    return left;
  }

  private parseUnaryExpression(): t.Expression {
    if (this.match('Keyword', 'not') || this.match('Punctuator', '-') ||
        this.match('Punctuator', '#')) {
      const operator = this.advance().value as t.UnaryOperator;
      const argument = this.parseUnaryExpression();
      return { type: 'UnaryExpression', operator, argument };
    }

    return this.parsePowerExpression();
  }

  private parsePowerExpression(): t.Expression {
    let left = this.parsePrimaryExpression();

    if (this.match('Punctuator', '^')) {
      this.advance();
      const right = this.parseUnaryExpression(); // Right-associative
      return { type: 'BinaryExpression', operator: '^', left, right };
    }

    return left;
  }

  private parsePrimaryExpression(): t.Expression {
    // Literals
    if (this.match('NumericLiteral')) {
      const value = this.advance().value;
      return {
        type: 'NumericLiteral',
        value: parseFloat(value),
        raw: value
      };
    }

    if (this.match('StringLiteral')) {
      const raw = this.advance().value;
      return {
        type: 'StringLiteral',
        value: raw,
        raw: `"${raw}"`
      };
    }

    if (this.match('BooleanLiteral')) {
      const value = this.advance().value === 'true';
      return { type: 'BooleanLiteral', value, raw: value.toString() };
    }

    if (this.match('NilLiteral')) {
      this.advance();
      return { type: 'NilLiteral', value: null, raw: 'nil' };
    }

    if (this.match('VarargLiteral')) {
      this.advance();
      return { type: 'VarargLiteral', value: '...', raw: '...' };
    }

    // Function expression
    if (this.match('Keyword', 'function')) {
      this.advance();
      const { parameters, body } = this.parseFunctionBody();
      return { type: 'FunctionExpression', parameters, body };
    }

    // Table constructor
    if (this.match('Punctuator', '{')) {
      return this.parseTableConstructor();
    }

    // Parenthesized expression
    if (this.match('Punctuator', '(')) {
      this.advance();
      const expression = this.parseExpression();
      this.expect('Punctuator', ')');
      return { type: 'ParenthesizedExpression', expression };
    }

    // Identifier or member expression
    return this.parsePrefixExpression();
  }

  private parsePrefixExpression(): t.Expression {
    let base: t.Expression;

    if (this.match('Identifier')) {
      const name = this.advance().value;
      base = { type: 'Identifier', name };
    } else if (this.match('Punctuator', '(')) {
      this.advance();
      base = this.parseExpression();
      this.expect('Punctuator', ')');
      base = { type: 'ParenthesizedExpression', expression: base };
    } else {
      throw new Error(`Unexpected token: ${this.current().type} '${this.current().value}'`);
    }

    return this.parsePostfixExpression(base);
  }

  private parsePostfixExpression(base: t.Expression): t.Expression {
    while (true) {
      // Index expression [expr]
      if (this.match('Punctuator', '[')) {
        this.advance();
        const index = this.parseExpression();
        this.expect('Punctuator', ']');
        base = { type: 'IndexExpression', base, index };
      }
      // Member expression .name or :name
      else if (this.match('Punctuator', '.') || this.match('Punctuator', ':')) {
        const indexer = this.advance().value as '.' | ':';
        const name = this.expect('Identifier').value;
        base = {
          type: 'MemberExpression',
          base,
          identifier: { type: 'Identifier', name },
          indexer
        };
      }
      // Function call (args)
      else if (this.match('Punctuator', '(')) {
        this.advance();
        const args: t.Expression[] = [];
        if (!this.match('Punctuator', ')')) {
          do {
            args.push(this.parseExpression());
          } while (this.match('Punctuator', ',') && this.advance());
        }
        this.expect('Punctuator', ')');
        base = { type: 'CallExpression', base, arguments: args };
      }
      // Table call { ... }
      else if (this.match('Punctuator', '{')) {
        const argument = this.parseTableConstructor();
        base = { type: 'TableCallExpression', base, argument };
      }
      // String call "string"
      else if (this.match('StringLiteral')) {
        const raw = this.advance().value;
        const argument: t.StringLiteral = {
          type: 'StringLiteral',
          value: raw,
          raw: `"${raw}"`
        };
        base = { type: 'StringCallExpression', base, argument };
      }
      else {
        break;
      }
    }

    return base;
  }

  private parseTableConstructor(): t.TableConstructorExpression {
    this.expect('Punctuator', '{');

    const fields: t.TableField[] = [];

    while (!this.match('Punctuator', '}')) {
      // [expr] = value
      if (this.match('Punctuator', '[')) {
        this.advance();
        const key = this.parseExpression();
        this.expect('Punctuator', ']');
        this.expect('Punctuator', '=');
        const value = this.parseExpression();
        fields.push({ type: 'TableKey', key, value });
      }
      // name = value
      else if (this.match('Identifier') && this.peek(1).value === '=') {
        const name = this.advance().value;
        this.expect('Punctuator', '=');
        const value = this.parseExpression();
        fields.push({
          type: 'TableKeyString',
          key: { type: 'Identifier', name },
          value
        });
      }
      // value (array part)
      else {
        const value = this.parseExpression();
        fields.push({ type: 'TableValue', value });
      }

      // Optional separator
      if (this.match('Punctuator', ',') || this.match('Punctuator', ';')) {
        this.advance();
      }
    }

    this.expect('Punctuator', '}');

    return { type: 'TableConstructorExpression', fields };
  }
}

export function parse(source: string): t.Program {
  const parser = new LuaParser(source);
  return parser.parse();
}
