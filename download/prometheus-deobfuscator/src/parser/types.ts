/**
 * Lua AST Types
 * Defines the Abstract Syntax Tree node types for Lua 5.1
 */

export type LuaNodeType =
  | 'Program'
  | 'Block'
  | 'Chunk'
  | 'IfClause'
  // Statements
  | 'AssignmentStatement'
  | 'LocalStatement'
  | 'IfStatement'
  | 'WhileStatement'
  | 'RepeatStatement'
  | 'ForStatement'
  | 'ForInStatement'
  | 'FunctionDeclaration'
  | 'LocalFunctionDeclaration'
  | 'ReturnStatement'
  | 'BreakStatement'
  | 'DoStatement'
  | 'LabelStatement'
  | 'GotoStatement'
  | 'CallStatement'
  // Expressions
  | 'Identifier'
  | 'NumericLiteral'
  | 'StringLiteral'
  | 'BooleanLiteral'
  | 'NilLiteral'
  | 'VarargLiteral'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'LogicalExpression'
  | 'TableConstructorExpression'
  | 'TableKey'
  | 'TableKeyString'
  | 'TableValue'
  | 'MemberExpression'
  | 'IndexExpression'
  | 'CallExpression'
  | 'TableCallExpression'
  | 'StringCallExpression'
  | 'FunctionExpression'
  | 'ParenthesizedExpression'
  // Other
  | 'Comment'
  | 'EOF';

export interface LuaNodeBase {
  type: LuaNodeType;
  loc?: SourceLocation;
  range?: [number, number];
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  column: number;
}

// Program root
export interface Program extends LuaNodeBase {
  type: 'Program';
  body: Statement[];
  comments?: Comment[];
}

export interface Block extends LuaNodeBase {
  type: 'Block';
  body: Statement[];
}

export type Statement =
  | AssignmentStatement
  | LocalStatement
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | ForStatement
  | ForInStatement
  | FunctionDeclaration
  | LocalFunctionDeclaration
  | ReturnStatement
  | BreakStatement
  | DoStatement
  | LabelStatement
  | GotoStatement
  | CallStatement;

export interface AssignmentStatement extends LuaNodeBase {
  type: 'AssignmentStatement';
  variables: Expression[];
  init: Expression[];
}

export interface LocalStatement extends LuaNodeBase {
  type: 'LocalStatement';
  variables: Identifier[];
  init: Expression[];
}

export interface IfStatement extends LuaNodeBase {
  type: 'IfStatement';
  clauses: IfClause[];
}

export interface IfClause extends LuaNodeBase {
  type: 'IfClause';
  condition?: Expression;
  body: Statement[];
}

export interface WhileStatement extends LuaNodeBase {
  type: 'WhileStatement';
  condition: Expression;
  body: Statement[];
}

export interface RepeatStatement extends LuaNodeBase {
  type: 'RepeatStatement';
  body: Statement[];
  condition: Expression;
}

export interface ForStatement extends LuaNodeBase {
  type: 'ForStatement';
  variable: Identifier;
  start: Expression;
  end: Expression;
  step?: Expression;
  body: Statement[];
}

export interface ForInStatement extends LuaNodeBase {
  type: 'ForInStatement';
  variables: Identifier[];
  iterators: Expression[];
  body: Statement[];
}

export interface FunctionDeclaration extends LuaNodeBase {
  type: 'FunctionDeclaration';
  identifier: Identifier | MemberExpression;
  isLocal?: boolean;
  parameters: (Identifier | VarargLiteral)[];
  body: Statement[];
}

export interface LocalFunctionDeclaration extends LuaNodeBase {
  type: 'LocalFunctionDeclaration';
  identifier: Identifier;
  parameters: (Identifier | VarargLiteral)[];
  body: Statement[];
}

export interface ReturnStatement extends LuaNodeBase {
  type: 'ReturnStatement';
  arguments: Expression[];
}

export interface BreakStatement extends LuaNodeBase {
  type: 'BreakStatement';
}

export interface DoStatement extends LuaNodeBase {
  type: 'DoStatement';
  body: Statement[];
}

export interface LabelStatement extends LuaNodeBase {
  type: 'LabelStatement';
  label: Identifier;
}

export interface GotoStatement extends LuaNodeBase {
  type: 'GotoStatement';
  label: Identifier;
}

export interface CallStatement extends LuaNodeBase {
  type: 'CallStatement';
  expression: CallExpression | TableCallExpression | StringCallExpression;
}

export type Expression =
  | Identifier
  | NumericLiteral
  | StringLiteral
  | BooleanLiteral
  | NilLiteral
  | VarargLiteral
  | BinaryExpression
  | UnaryExpression
  | LogicalExpression
  | TableConstructorExpression
  | MemberExpression
  | IndexExpression
  | CallExpression
  | TableCallExpression
  | StringCallExpression
  | FunctionExpression
  | ParenthesizedExpression;

export interface Identifier extends LuaNodeBase {
  type: 'Identifier';
  name: string;
}

export interface NumericLiteral extends LuaNodeBase {
  type: 'NumericLiteral';
  value: number;
  raw: string;
}

export interface StringLiteral extends LuaNodeBase {
  type: 'StringLiteral';
  value: string;
  raw: string;
}

export interface BooleanLiteral extends LuaNodeBase {
  type: 'BooleanLiteral';
  value: boolean;
  raw: string;
}

export interface NilLiteral extends LuaNodeBase {
  type: 'NilLiteral';
  value: null;
  raw: string;
}

export interface VarargLiteral extends LuaNodeBase {
  type: 'VarargLiteral';
  value: '...';
  raw: string;
}

export interface BinaryExpression extends LuaNodeBase {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export type BinaryOperator =
  | '+' | '-' | '*' | '/' | '%' | '^'
  | '..' | '<' | '<=' | '>' | '>=' | '==' | '~=';

export interface UnaryExpression extends LuaNodeBase {
  type: 'UnaryExpression';
  operator: UnaryOperator;
  argument: Expression;
}

export type UnaryOperator = '-' | 'not' | '#';

export interface LogicalExpression extends LuaNodeBase {
  type: 'LogicalExpression';
  operator: LogicalOperator;
  left: Expression;
  right: Expression;
}

export type LogicalOperator = 'and' | 'or';

export interface TableConstructorExpression extends LuaNodeBase {
  type: 'TableConstructorExpression';
  fields: TableField[];
}

export type TableField = TableKey | TableKeyString | TableValue;

export interface TableKey extends LuaNodeBase {
  type: 'TableKey';
  key: Expression;
  value: Expression;
}

export interface TableKeyString extends LuaNodeBase {
  type: 'TableKeyString';
  key: Identifier;
  value: Expression;
}

export interface TableValue extends LuaNodeBase {
  type: 'TableValue';
  value: Expression;
}

export interface MemberExpression extends LuaNodeBase {
  type: 'MemberExpression';
  base: Expression;
  identifier: Identifier;
  indexer: '.' | ':';
}

export interface IndexExpression extends LuaNodeBase {
  type: 'IndexExpression';
  base: Expression;
  index: Expression;
}

export interface CallExpression extends LuaNodeBase {
  type: 'CallExpression';
  base: Expression;
  arguments: Expression[];
}

export interface TableCallExpression extends LuaNodeBase {
  type: 'TableCallExpression';
  base: Expression;
  argument: TableConstructorExpression;
}

export interface StringCallExpression extends LuaNodeBase {
  type: 'StringCallExpression';
  base: Expression;
  argument: StringLiteral;
}

export interface FunctionExpression extends LuaNodeBase {
  type: 'FunctionExpression';
  parameters: (Identifier | VarargLiteral)[];
  body: Statement[];
}

export interface ParenthesizedExpression extends LuaNodeBase {
  type: 'ParenthesizedExpression';
  expression: Expression;
}

export interface Comment extends LuaNodeBase {
  type: 'Comment';
  value: string;
  raw: string;
}

export interface EOF extends LuaNodeBase {
  type: 'EOF';
}

// Union type for all AST nodes
export type Node =
  | Program
  | Block
  | Statement
  | Expression
  | IfClause
  | TableField
  | Comment
  | EOF
  | LuaNodeBase;
