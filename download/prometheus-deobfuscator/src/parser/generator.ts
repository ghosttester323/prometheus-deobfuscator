/**
 * Lua Code Generator
 * Converts AST back to Lua source code
 */

import * as t from './types';

export class LuaGenerator {
  private indentLevel: number = 0;
  private indentStr: string = '  ';

  generate(ast: t.Program | t.Statement | t.Expression): string {
    return this.generateNode(ast);
  }

  private indent(): string {
    return this.indentStr.repeat(this.indentLevel);
  }

  private generateNode(node: any): string {
    switch (node.type) {
      case 'Program':
        return this.generateProgram(node as t.Program);
      case 'LocalStatement':
        return this.generateLocalStatement(node as t.LocalStatement);
      case 'AssignmentStatement':
        return this.generateAssignmentStatement(node as t.AssignmentStatement);
      case 'IfStatement':
        return this.generateIfStatement(node as t.IfStatement);
      case 'WhileStatement':
        return this.generateWhileStatement(node as t.WhileStatement);
      case 'RepeatStatement':
        return this.generateRepeatStatement(node as t.RepeatStatement);
      case 'ForStatement':
        return this.generateForStatement(node as t.ForStatement);
      case 'ForInStatement':
        return this.generateForInStatement(node as t.ForInStatement);
      case 'FunctionDeclaration':
        return this.generateFunctionDeclaration(node as t.FunctionDeclaration);
      case 'LocalFunctionDeclaration':
        return this.generateLocalFunctionDeclaration(node as t.LocalFunctionDeclaration);
      case 'ReturnStatement':
        return this.generateReturnStatement(node as t.ReturnStatement);
      case 'BreakStatement':
        return 'break';
      case 'DoStatement':
        return this.generateDoStatement(node as t.DoStatement);
      case 'LabelStatement':
        return `::${(node as t.LabelStatement).label.name}::`;
      case 'GotoStatement':
        return `goto ${(node as t.GotoStatement).label.name}`;
      case 'CallStatement':
        return this.generateExpression((node as t.CallStatement).expression);
      case 'Identifier':
        return (node as t.Identifier).name;
      case 'NumericLiteral':
        return (node as t.NumericLiteral).raw;
      case 'StringLiteral':
        return this.generateStringLiteral(node as t.StringLiteral);
      case 'BooleanLiteral':
        return (node as t.BooleanLiteral).value ? 'true' : 'false';
      case 'NilLiteral':
        return 'nil';
      case 'VarargLiteral':
        return '...';
      case 'BinaryExpression':
        return this.generateBinaryExpression(node as t.BinaryExpression);
      case 'UnaryExpression':
        return this.generateUnaryExpression(node as t.UnaryExpression);
      case 'LogicalExpression':
        return this.generateLogicalExpression(node as t.LogicalExpression);
      case 'TableConstructorExpression':
        return this.generateTableConstructor(node as t.TableConstructorExpression);
      case 'MemberExpression':
        return this.generateMemberExpression(node as t.MemberExpression);
      case 'IndexExpression':
        return this.generateIndexExpression(node as t.IndexExpression);
      case 'CallExpression':
        return this.generateCallExpression(node as t.CallExpression);
      case 'TableCallExpression':
        return this.generateTableCallExpression(node as t.TableCallExpression);
      case 'StringCallExpression':
        return this.generateStringCallExpression(node as t.StringCallExpression);
      case 'FunctionExpression':
        return this.generateFunctionExpression(node as t.FunctionExpression);
      case 'ParenthesizedExpression':
        return `(${this.generateExpression((node as t.ParenthesizedExpression).expression)})`;
      default:
        return '';
    }
  }

  private generateProgram(node: t.Program): string {
    return node.body.map(stmt => this.generateStatement(stmt)).join('\n');
  }

  private generateStatement(stmt: t.Statement): string {
    return this.indent() + this.generateNode(stmt);
  }

  private generateLocalStatement(node: t.LocalStatement): string {
    const vars = node.variables.map(v => v.name).join(', ');
    if (node.init.length === 0) {
      return `local ${vars}`;
    }
    const init = node.init.map(e => this.generateExpression(e)).join(', ');
    return `local ${vars} = ${init}`;
  }

  private generateAssignmentStatement(node: t.AssignmentStatement): string {
    const vars = node.variables.map(e => this.generateExpression(e)).join(', ');
    const init = node.init.map(e => this.generateExpression(e)).join(', ');
    return `${vars} = ${init}`;
  }

  private generateIfStatement(node: t.IfStatement): string {
    const parts: string[] = [];
    const clauses = node.clauses;

    // if clause
    const ifClause = clauses[0];
    parts.push(`if ${this.generateExpression(ifClause.condition!)} then`);
    this.indentLevel++;
    ifClause.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;

    // elseif clauses
    for (let i = 1; i < clauses.length; i++) {
      const clause = clauses[i];
      if (clause.condition) {
        parts.push(`${this.indent()}elseif ${this.generateExpression(clause.condition)} then`);
      } else {
        parts.push(`${this.indent()}else`);
      }
      this.indentLevel++;
      clause.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
      this.indentLevel--;
    }

    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }

  private generateWhileStatement(node: t.WhileStatement): string {
    const parts: string[] = [];
    parts.push(`while ${this.generateExpression(node.condition)} do`);
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }

  private generateRepeatStatement(node: t.RepeatStatement): string {
    const parts: string[] = [];
    parts.push('repeat');
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}until ${this.generateExpression(node.condition)}`);
    return parts.join('\n');
  }

  private generateForStatement(node: t.ForStatement): string {
    const parts: string[] = [];
    let header = `for ${node.variable.name} = ${this.generateExpression(node.start)}, ${this.generateExpression(node.end)}`;
    if (node.step) {
      header += `, ${this.generateExpression(node.step)}`;
    }
    parts.push(`${header} do`);
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }

  private generateForInStatement(node: t.ForInStatement): string {
    const parts: string[] = [];
    const vars = node.variables.map(v => v.name).join(', ');
    const iterators = node.iterators.map(e => this.generateExpression(e)).join(', ');
    parts.push(`for ${vars} in ${iterators} do`);
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }

  private generateFunctionDeclaration(node: t.FunctionDeclaration): string {
    const parts: string[] = [];
    const name = this.generateExpression(node.identifier);
    const params = node.parameters.map(p =>
      p.type === 'VarargLiteral' ? '...' : (p as t.Identifier).name
    ).join(', ');
    parts.push(`function ${name}(${params})`);
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }

  private generateLocalFunctionDeclaration(node: t.LocalFunctionDeclaration): string {
    const parts: string[] = [];
    const params = node.parameters.map(p =>
      p.type === 'VarargLiteral' ? '...' : (p as t.Identifier).name
    ).join(', ');
    parts.push(`local function ${node.identifier.name}(${params})`);
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }

  private generateReturnStatement(node: t.ReturnStatement): string {
    if (node.arguments.length === 0) {
      return 'return';
    }
    const args = node.arguments.map(e => this.generateExpression(e)).join(', ');
    return `return ${args}`;
  }

  private generateDoStatement(node: t.DoStatement): string {
    const parts: string[] = [];
    parts.push('do');
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }

  private generateExpression(node: t.Expression): string {
    return this.generateNode(node);
  }

  private generateStringLiteral(node: t.StringLiteral): string {
    // Escape special characters
    const escaped = node.value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${escaped}"`;
  }

  private generateBinaryExpression(node: t.BinaryExpression): string {
    const left = this.generateExpression(node.left);
    const right = this.generateExpression(node.right);
    return `${left} ${node.operator} ${right}`;
  }

  private generateUnaryExpression(node: t.UnaryExpression): string {
    const arg = this.generateExpression(node.argument);
    if (node.operator === 'not') {
      return `not ${arg}`;
    }
    return `${node.operator}${arg}`;
  }

  private generateLogicalExpression(node: t.LogicalExpression): string {
    const left = this.generateExpression(node.left);
    const right = this.generateExpression(node.right);
    return `${left} ${node.operator} ${right}`;
  }

  private generateTableConstructor(node: t.TableConstructorExpression): string {
    if (node.fields.length === 0) {
      return '{}';
    }

    const fields = node.fields.map(field => {
      if (field.type === 'TableKey') {
        return `[${this.generateExpression(field.key)}] = ${this.generateExpression(field.value)}`;
      }
      if (field.type === 'TableKeyString') {
        return `${field.key.name} = ${this.generateExpression(field.value)}`;
      }
      return this.generateExpression((field as t.TableValue).value);
    });

    return `{ ${fields.join(', ')} }`;
  }

  private generateMemberExpression(node: t.MemberExpression): string {
    const base = this.generateExpression(node.base);
    return `${base}${node.indexer}${node.identifier.name}`;
  }

  private generateIndexExpression(node: t.IndexExpression): string {
    const base = this.generateExpression(node.base);
    const index = this.generateExpression(node.index);
    return `${base}[${index}]`;
  }

  private generateCallExpression(node: t.CallExpression): string {
    const base = this.generateExpression(node.base);
    const args = node.arguments.map(e => this.generateExpression(e)).join(', ');
    return `${base}(${args})`;
  }

  private generateTableCallExpression(node: t.TableCallExpression): string {
    const base = this.generateExpression(node.base);
    const arg = this.generateTableConstructor(node.argument);
    return `${base}${arg}`;
  }

  private generateStringCallExpression(node: t.StringCallExpression): string {
    const base = this.generateExpression(node.base);
    const arg = this.generateStringLiteral(node.argument);
    return `${base}(${arg})`;
  }

  private generateFunctionExpression(node: t.FunctionExpression): string {
    const params = node.parameters.map(p =>
      p.type === 'VarargLiteral' ? '...' : (p as t.Identifier).name
    ).join(', ');

    const parts: string[] = [];
    parts.push(`function(${params})`);
    this.indentLevel++;
    node.body.forEach(stmt => parts.push(this.generateStatement(stmt)));
    this.indentLevel--;
    parts.push(`${this.indent()}end`);
    return parts.join('\n');
  }
}

export function generate(ast: t.Program | t.Statement | t.Expression): string {
  const generator = new LuaGenerator();
  return generator.generate(ast);
}
