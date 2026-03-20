/**
 * Constant Folding Layer
 * Evaluates constant expressions at deobfuscation time
 *
 * Prometheus uses constant obfuscation like:
 * - (1 + 2 + 3) => 6
 * - (10 * 5 - 20) => 30
 * - string.len("test") => 4
 */

import * as t from '../parser/types';
import { DeobfuscationLayer, DeobfuscationResult, LayerInfo } from './base';

export class ConstantFoldingLayer extends DeobfuscationLayer {
  get info(): LayerInfo {
    return {
      name: 'ConstantFolding',
      description: 'Evaluates constant expressions',
      priority: 15
    };
  }

  process(ast: t.Program): DeobfuscationResult {
    const changes: string[] = [];
    let modified = false;

    const fold = (node: any): any => {
      // Try to evaluate binary expressions
      if (node.type === 'BinaryExpression') {
        const result = this.foldBinaryExpression(node as t.BinaryExpression);
        if (result) {
          changes.push(`Folded constant: ${this.nodeToString(node)} => ${this.nodeToString(result)}`);
          modified = true;
          return result;
        }
      }

      // Try to evaluate unary expressions
      if (node.type === 'UnaryExpression') {
        const result = this.foldUnaryExpression(node as t.UnaryExpression);
        if (result) {
          changes.push(`Folded constant: ${this.nodeToString(node)} => ${this.nodeToString(result)}`);
          modified = true;
          return result;
        }
      }

      // Try to evaluate string operations
      if (node.type === 'CallExpression') {
        const result = this.foldStringOperations(node as t.CallExpression);
        if (result) {
          changes.push(`Folded string operation: ${this.nodeToString(node)} => ${this.nodeToString(result)}`);
          modified = true;
          return result;
        }
      }

      // Recurse into children
      this.recurse(node, fold);

      return node;
    };

    const newAST = fold(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }

  private foldBinaryExpression(node: t.BinaryExpression): t.Node | null {
    // First, try to fold children
    const left = this.tryEvaluate(node.left);
    const right = this.tryEvaluate(node.right);

    if (left === null || right === null) {
      return null;
    }

    // Both sides are constants, evaluate
    const result = this.evaluateBinary(node.operator, left, right);

    if (result !== null) {
      if (typeof result === 'number') {
        return {
          type: 'NumericLiteral',
          value: result,
          raw: String(result)
        } as t.NumericLiteral;
      }
      if (typeof result === 'string') {
        return {
          type: 'StringLiteral',
          value: result,
          raw: `"${result}"`
        } as t.StringLiteral;
      }
      if (typeof result === 'boolean') {
        return {
          type: 'BooleanLiteral',
          value: result,
          raw: String(result)
        } as t.BooleanLiteral;
      }
    }

    return null;
  }

  private foldUnaryExpression(node: t.UnaryExpression): t.Node | null {
    const arg = this.tryEvaluate(node.argument);

    if (arg === null) {
      return null;
    }

    const result = this.evaluateUnary(node.operator, arg);

    if (result !== null) {
      if (typeof result === 'number') {
        return {
          type: 'NumericLiteral',
          value: result,
          raw: String(result)
        } as t.NumericLiteral;
      }
      if (typeof result === 'boolean') {
        return {
          type: 'BooleanLiteral',
          value: result,
          raw: String(result)
        } as t.BooleanLiteral;
      }
    }

    return null;
  }

  private foldStringOperations(node: t.CallExpression): t.Node | null {
    // Check for string.len, string.sub, etc.
    if (node.base.type !== 'MemberExpression') {
      return null;
    }

    const member = node.base as t.MemberExpression;
    if (member.base.type !== 'Identifier' ||
        (member.base as t.Identifier).name !== 'string') {
      return null;
    }

    const method = member.identifier.name;

    switch (method) {
      case 'len': {
        if (node.arguments.length === 1 &&
            node.arguments[0].type === 'StringLiteral') {
          const str = (node.arguments[0] as t.StringLiteral).value;
          return {
            type: 'NumericLiteral',
            value: str.length,
            raw: String(str.length)
          } as t.NumericLiteral;
        }
        break;
      }

      case 'sub': {
        if (node.arguments.length >= 2 &&
            node.arguments[0].type === 'StringLiteral' &&
            node.arguments[1].type === 'NumericLiteral') {
          const str = (node.arguments[0] as t.StringLiteral).value;
          const start = (node.arguments[1] as t.NumericLiteral).value;
          let end = str.length;

          if (node.arguments.length >= 3 &&
              node.arguments[2].type === 'NumericLiteral') {
            end = (node.arguments[2] as t.NumericLiteral).value;
          }

          const result = str.substring(start - 1, end);
          return {
            type: 'StringLiteral',
            value: result,
            raw: `"${result}"`
          } as t.StringLiteral;
        }
        break;
      }

      case 'rep': {
        if (node.arguments.length === 2 &&
            node.arguments[0].type === 'StringLiteral' &&
            node.arguments[1].type === 'NumericLiteral') {
          const str = (node.arguments[0] as t.StringLiteral).value;
          const count = Math.floor((node.arguments[1] as t.NumericLiteral).value);
          const result = str.repeat(count);
          return {
            type: 'StringLiteral',
            value: result,
            raw: `"${result}"`
          } as t.StringLiteral;
        }
        break;
      }

      case 'reverse': {
        if (node.arguments.length === 1 &&
            node.arguments[0].type === 'StringLiteral') {
          const str = (node.arguments[0] as t.StringLiteral).value;
          const result = str.split('').reverse().join('');
          return {
            type: 'StringLiteral',
            value: result,
            raw: `"${result}"`
          } as t.StringLiteral;
        }
        break;
      }

      case 'upper': {
        if (node.arguments.length === 1 &&
            node.arguments[0].type === 'StringLiteral') {
          const str = (node.arguments[0] as t.StringLiteral).value;
          return {
            type: 'StringLiteral',
            value: str.toUpperCase(),
            raw: `"${str.toUpperCase()}"`
          } as t.StringLiteral;
        }
        break;
      }

      case 'lower': {
        if (node.arguments.length === 1 &&
            node.arguments[0].type === 'StringLiteral') {
          const str = (node.arguments[0] as t.StringLiteral).value;
          return {
            type: 'StringLiteral',
            value: str.toLowerCase(),
            raw: `"${str.toLowerCase()}"`
          } as t.StringLiteral;
        }
        break;
      }

      case 'byte': {
        if (node.arguments.length >= 1 &&
            node.arguments[0].type === 'StringLiteral') {
          const str = (node.arguments[0] as t.StringLiteral).value;
          let start = 1;

          if (node.arguments.length >= 2 &&
              node.arguments[1].type === 'NumericLiteral') {
            start = (node.arguments[1] as t.NumericLiteral).value;
          }

          if (start >= 1 && start <= str.length) {
            return {
              type: 'NumericLiteral',
              value: str.charCodeAt(start - 1),
              raw: String(str.charCodeAt(start - 1))
            } as t.NumericLiteral;
          }
        }
        break;
      }
    }

    return null;
  }

  private tryEvaluate(node: any): number | string | boolean | null {
    if (node.type === 'NumericLiteral') {
      return (node as t.NumericLiteral).value;
    }
    if (node.type === 'StringLiteral') {
      return (node as t.StringLiteral).value;
    }
    if (node.type === 'BooleanLiteral') {
      return (node as t.BooleanLiteral).value;
    }
    if (node.type === 'NilLiteral') {
      return null;
    }

    return null;
  }

  private evaluateBinary(
    operator: string,
    left: number | string | boolean | null,
    right: number | string | boolean | null
  ): number | string | boolean | null {
    switch (operator) {
      case '+':
        if (typeof left === 'number' && typeof right === 'number') return left + right;
        break;
      case '-':
        if (typeof left === 'number' && typeof right === 'number') return left - right;
        break;
      case '*':
        if (typeof left === 'number' && typeof right === 'number') return left * right;
        break;
      case '/':
        if (typeof left === 'number' && typeof right === 'number' && right !== 0) return left / right;
        break;
      case '%':
        if (typeof left === 'number' && typeof right === 'number' && right !== 0) return left % right;
        break;
      case '^':
        if (typeof left === 'number' && typeof right === 'number') return Math.pow(left, right);
        break;
      case '..':
        if (typeof left === 'string' && typeof right === 'string') return left + right;
        if (typeof left === 'string' && typeof right === 'number') return left + String(right);
        if (typeof left === 'number' && typeof right === 'string') return String(left) + right;
        break;
      case '<':
        if (typeof left === 'number' && typeof right === 'number') return left < right;
        if (typeof left === 'string' && typeof right === 'string') return left < right;
        break;
      case '<=':
        if (typeof left === 'number' && typeof right === 'number') return left <= right;
        if (typeof left === 'string' && typeof right === 'string') return left <= right;
        break;
      case '>':
        if (typeof left === 'number' && typeof right === 'number') return left > right;
        if (typeof left === 'string' && typeof right === 'string') return left > right;
        break;
      case '>=':
        if (typeof left === 'number' && typeof right === 'number') return left >= right;
        if (typeof left === 'string' && typeof right === 'string') return left >= right;
        break;
      case '==':
        return left === right;
      case '~=':
        return left !== right;
    }

    return null;
  }

  private evaluateUnary(
    operator: string,
    arg: number | string | boolean | null
  ): number | boolean | null {
    switch (operator) {
      case '-':
        if (typeof arg === 'number') return -arg;
        break;
      case 'not':
        return !arg;
      case '#':
        if (typeof arg === 'string') return arg.length;
        break;
    }

    return null;
  }

  private recurse(node: any, fn: (n: any) => any): void {
    for (const key in node) {
      const value = node[key];
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          node[key] = value.map(fn);
        } else if (value.type) {
          node[key] = fn(value);
        }
      }
    }
  }

  private nodeToString(node: any): string {
    if (node.type === 'NumericLiteral') return String(node.value);
    if (node.type === 'StringLiteral') return `"${node.value}"`;
    if (node.type === 'BooleanLiteral') return String(node.value);
    if (node.type === 'NilLiteral') return 'nil';
    return `[${node.type}]`;
  }
}
