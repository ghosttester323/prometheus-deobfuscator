/**
 * Control Flow Cleaner Layer
 * Cleans up control flow obfuscation in Prometheus Weak preset
 *
 * Prometheus uses several control flow obfuscation techniques:
 * 1. While loops with always-true conditions
 * 2. Switch-case emulation with if-elseif chains
 * 3. Fake jumps and labels
 * 4. Dead code insertion between control structures
 */

import * as t from '../parser/types';
import { DeobfuscationLayer, DeobfuscationResult, LayerInfo } from './base';

export class ControlFlowCleanerLayer extends DeobfuscationLayer {
  get info(): LayerInfo {
    return {
      name: 'ControlFlowCleaner',
      description: 'Cleans up control flow obfuscation patterns',
      priority: 20
    };
  }

  process(ast: t.Program): DeobfuscationResult {
    const changes: string[] = [];
    let modified = false;

    // Step 1: Remove always-true while loops
    let result = this.removeAlwaysTrueLoops(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 2: Simplify if-elseif switch patterns
    result = this.simplifySwitchPatterns(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 3: Remove dead code
    result = this.removeDeadCode(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 4: Remove redundant do-end blocks
    result = this.removeRedundantDoBlocks(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    // Step 5: Simplify boolean conditions
    result = this.simplifyBooleanConditions(ast, changes);
    if (result.modified) {
      modified = true;
      ast = result.ast;
    }

    return this.createResult(ast, modified, changes);
  }

  private removeAlwaysTrueLoops(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;
    const newBody: t.Statement[] = [];

    for (const stmt of ast.body) {
      if (stmt.type === 'WhileStatement') {
        const whileStmt = stmt as t.WhileStatement;

        // Check for always-true condition
        if (this.isAlwaysTrue(whileStmt.condition)) {
          changes.push('Removed always-true while loop wrapper');
          modified = true;

          // Extract the body content
          const bodyStmts = this.extractRealBody(whileStmt.body);
          newBody.push(...bodyStmts);
          continue;
        }
      }

      // Also check inside other statements
      if ('body' in stmt && Array.isArray((stmt as any).body)) {
        const result = this.cleanLoopsInStatement(stmt, changes);
        if (result.modified) {
          modified = true;
          newBody.push(result.stmt);
          continue;
        }
      }

      newBody.push(stmt);
    }

    return this.createResult({ ...ast, body: newBody }, modified, changes);
  }

  private cleanLoopsInStatement(stmt: t.Statement, changes: string[]): { stmt: t.Statement, modified: boolean } {
    let modified = false;
    const result = { ...stmt };

    // Handle various statement types that contain body
    if ('body' in stmt && Array.isArray((stmt as any).body)) {
      const newBody: t.Statement[] = [];

      for (const bodyStmt of (stmt as any).body) {
        if (bodyStmt.type === 'WhileStatement') {
          const whileStmt = bodyStmt as t.WhileStatement;

          if (this.isAlwaysTrue(whileStmt.condition)) {
            changes.push('Removed nested always-true while loop');
            modified = true;
            newBody.push(...this.extractRealBody(whileStmt.body));
            continue;
          }
        }

        // Recurse
        const innerResult = this.cleanLoopsInStatement(bodyStmt, changes);
        if (innerResult.modified) {
          modified = true;
          newBody.push(innerResult.stmt);
        } else {
          newBody.push(bodyStmt);
        }
      }

      (result as any).body = newBody;
    }

    return { stmt: result, modified };
  }

  private isAlwaysTrue(expr: t.Expression): boolean {
    if (expr.type === 'BooleanLiteral') {
      return (expr as t.BooleanLiteral).value === true;
    }

    if (expr.type === 'NumericLiteral') {
      return (expr as t.NumericLiteral).value !== 0;
    }

    // Check for patterns like: not false, true, 1 == 1, etc.
    if (expr.type === 'UnaryExpression') {
      const unary = expr as t.UnaryExpression;
      if (unary.operator === 'not') {
        return this.isAlwaysFalse(unary.argument);
      }
    }

    if (expr.type === 'BinaryExpression') {
      const binary = expr as t.BinaryExpression;
      if (binary.operator === '==' &&
          binary.left.type === 'NumericLiteral' &&
          binary.right.type === 'NumericLiteral') {
        return (binary.left as t.NumericLiteral).value ===
               (binary.right as t.NumericLiteral).value;
      }
    }

    return false;
  }

  private isAlwaysFalse(expr: t.Expression): boolean {
    if (expr.type === 'BooleanLiteral') {
      return (expr as t.BooleanLiteral).value === false;
    }

    if (expr.type === 'NumericLiteral') {
      return (expr as t.NumericLiteral).value === 0;
    }

    if (expr.type === 'NilLiteral') {
      return true;
    }

    return false;
  }

  private extractRealBody(body: t.Statement[]): t.Statement[] {
    // Remove break statements that would end the loop
    // Keep only real statements
    return body.filter(stmt => {
      if (stmt.type === 'BreakStatement') {
        // Check if there's a condition before the break
        return false;
      }
      return true;
    });
  }

  private simplifySwitchPatterns(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    // Look for if-elseif chains that emulate switch statements
    // Pattern: if var == 1 then ... elseif var == 2 then ... end
    // This can be simplified if the variable is a constant

    const simplify = (node: t.Node): t.Node => {
      if (node.type === 'IfStatement') {
        const ifStmt = node as t.IfStatement;

        // Check if we can determine which branch will execute
        if (ifStmt.clauses.length > 0 && ifStmt.clauses[0].condition) {
          const condition = ifStmt.clauses[0].condition;

          // Check for literal comparison
          if (condition.type === 'BinaryExpression') {
            const binary = condition as t.BinaryExpression;

            if (binary.operator === '==' &&
                binary.right.type === 'NumericLiteral') {
              // We found a switch-like pattern
              // Keep as is for now, but mark as detected
            }
          }
        }
      }

      // Recurse
      if ('body' in node && Array.isArray((node as any).body)) {
        (node as any).body = (node as any).body.map(simplify);
      }

      if ('clauses' in node && Array.isArray((node as any).clauses)) {
        (node as any).clauses = (node as any).clauses.map((clause: any) => {
          clause.body = clause.body.map(simplify);
          return clause;
        });
      }

      return node;
    };

    const newAST = simplify(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }

  private removeDeadCode(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;
    const newBody: t.Statement[] = [];

    for (const stmt of ast.body) {
      // Remove statements after return/break in the same block
      if (this.isUnreachable(stmt)) {
        changes.push('Removed unreachable code');
        modified = true;
        continue;
      }

      newBody.push(stmt);
    }

    return this.createResult({ ...ast, body: newBody }, modified, changes);
  }

  private isUnreachable(stmt: t.Statement): boolean {
    // Check for patterns that are obviously dead code
    // Like: if false then ... end

    if (stmt.type === 'IfStatement') {
      const ifStmt = stmt as t.IfStatement;

      // if false then ... end
      if (ifStmt.clauses.length === 1 &&
          ifStmt.clauses[0].condition &&
          this.isAlwaysFalse(ifStmt.clauses[0].condition)) {
        return true;
      }
    }

    return false;
  }

  private removeRedundantDoBlocks(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    const remove = (node: any): any => {
      if (node.type === 'DoStatement') {
        const doStmt = node as t.DoStatement;

        // If do block has no labels and is not needed, inline it
        if (!this.hasLabels(doStmt.body) && !this.hasGoto(doStmt.body)) {
          changes.push('Removed redundant do-end block');
          modified = true;

          // Return a marker that the body should be inlined
          return { type: 'INLINE', body: doStmt.body };
        }
      }

      // Recurse
      if ('body' in node && Array.isArray(node.body)) {
        const newBody: any[] = [];
        for (const child of node.body) {
          const result = remove(child);
          if (result && result.type === 'INLINE') {
            newBody.push(...result.body);
          } else {
            newBody.push(result);
          }
        }
        node.body = newBody;
      }

      return node;
    };

    const newAST = remove(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }

  private hasLabels(body: t.Statement[]): boolean {
    return body.some(stmt => stmt.type === 'LabelStatement');
  }

  private hasGoto(body: t.Statement[]): boolean {
    return body.some(stmt => stmt.type === 'GotoStatement');
  }

  private simplifyBooleanConditions(ast: t.Program, changes: string[]): DeobfuscationResult {
    let modified = false;

    const simplify = (node: any): any => {
      if (node.type === 'LogicalExpression') {
        const logical = node as t.LogicalExpression;

        const left = simplify(logical.left);
        const right = simplify(logical.right);

        // true and x => x
        if (logical.operator === 'and' && left.type === 'BooleanLiteral') {
          if ((left as t.BooleanLiteral).value === true) {
            changes.push('Simplified: true and x => x');
            modified = true;
            return right;
          }
          // false and x => false
          if ((left as t.BooleanLiteral).value === false) {
            changes.push('Simplified: false and x => false');
            modified = true;
            return left;
          }
        }

        // true or x => true
        if (logical.operator === 'or' && left.type === 'BooleanLiteral') {
          if ((left as t.BooleanLiteral).value === true) {
            changes.push('Simplified: true or x => true');
            modified = true;
            return left;
          }
          // false or x => x
          if ((left as t.BooleanLiteral).value === false) {
            changes.push('Simplified: false or x => x');
            modified = true;
            return right;
          }
        }

        return { ...logical, left, right };
      }

      // Recurse
      if ('condition' in node) {
        node.condition = simplify(node.condition);
      }

      if ('body' in node && Array.isArray(node.body)) {
        node.body = node.body.map(simplify);
      }

      return node;
    };

    const newAST = simplify(ast) as t.Program;
    return this.createResult(newAST, modified, changes);
  }
}
