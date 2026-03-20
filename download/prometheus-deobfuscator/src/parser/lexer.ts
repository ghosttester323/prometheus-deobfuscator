/**
 * Lua Lexer/Tokenizer
 * Converts Lua source code into tokens for the parser
 */

import { Position, SourceLocation } from './types';

export interface Token {
  type: TokenType;
  value: string;
  loc: SourceLocation;
  range: [number, number];
}

export type TokenType =
  | 'Identifier'
  | 'NumericLiteral'
  | 'StringLiteral'
  | 'BooleanLiteral'
  | 'NilLiteral'
  | 'VarargLiteral'
  | 'Punctuator'
  | 'Keyword'
  | 'EOF';

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while'
]);

const PUNCTUATORS = new Set([
  '+', '-', '*', '/', '%', '^', '#', '..', '~=', '<=', '>=', '<', '>', '=',
  '==', '(', ')', '{', '}', '[', ']', ';', ':', ',', '.'
]);

export class LuaLexer {
  private source: string;
  private index: number = 0;
  private line: number = 1;
  private column: number = 1;
  private length: number;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
    this.length = source.length;
  }

  tokenize(): Token[] {
    while (!this.eof()) {
      this.skipWhitespaceAndComments();
      if (this.eof()) break;

      const token = this.scanToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    this.tokens.push(this.createToken('EOF', ''));
    return this.tokens;
  }

  private eof(): boolean {
    return this.index >= this.length;
  }

  private peek(offset: number = 0): string {
    return this.source[this.index + offset] || '';
  }

  private peekString(length: number): string {
    return this.source.substr(this.index, length);
  }

  private advance(): string {
    const char = this.source[this.index++];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private getPosition(): Position {
    return { line: this.line, column: this.column };
  }

  private createToken(type: TokenType, value: string): Token {
    const start = this.getPosition();
    return {
      type,
      value,
      loc: { start, end: start },
      range: [this.index - value.length, this.index]
    };
  }

  private skipWhitespaceAndComments(): void {
    while (!this.eof()) {
      const char = this.peek();

      // Whitespace
      if (/\s/.test(char)) {
        this.advance();
        continue;
      }

      // Comments
      if (char === '-' && this.peek(1) === '-') {
        this.advance(); // -
        this.advance(); // -

        // Long comment --[[
        if (this.peek() === '[' && this.isLongStringStart()) {
          this.skipLongString();
        } else {
          // Single line comment
          while (!this.eof() && this.peek() !== '\n') {
            this.advance();
          }
        }
        continue;
      }

      break;
    }
  }

  private isLongStringStart(): boolean {
    if (this.peek() !== '[') return false;
    let i = 1;
    while (this.peek(i) === '=') i++;
    return this.peek(i) === '[';
  }

  private skipLongString(): void {
    // Find the opening bracket
    let eqCount = 0;
    while (this.peek() === '=') {
      eqCount++;
      this.advance();
    }
    if (this.peek() === '[') {
      this.advance();
    }

    // Find the closing bracket
    const closingPattern = ']' + '='.repeat(eqCount) + ']';
    while (!this.eof()) {
      if (this.peekString(closingPattern.length) === closingPattern) {
        for (let i = 0; i < closingPattern.length; i++) {
          this.advance();
        }
        return;
      }
      this.advance();
    }
  }

  private scanToken(): Token | null {
    const char = this.peek();
    const start = this.getPosition();
    const startIndex = this.index;

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(char)) {
      return this.scanIdentifier();
    }

    // Number
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.peek(1)))) {
      return this.scanNumber();
    }

    // String
    if (char === '"' || char === "'") {
      return this.scanString();
    }

    // Long string [[ ]]
    if (char === '[' && this.isLongStringStart()) {
      return this.scanLongString();
    }

    // Vararg
    if (this.peekString(3) === '...') {
      this.advance();
      this.advance();
      this.advance();
      return {
        type: 'VarargLiteral',
        value: '...',
        loc: { start, end: this.getPosition() },
        range: [startIndex, this.index]
      };
    }

    // Punctuators (check longer ones first)
    const twoChar = this.peekString(2);
    if (PUNCTUATORS.has(twoChar)) {
      this.advance();
      this.advance();
      return {
        type: 'Punctuator',
        value: twoChar,
        loc: { start, end: this.getPosition() },
        range: [startIndex, this.index]
      };
    }

    if (PUNCTUATORS.has(char)) {
      this.advance();
      return {
        type: 'Punctuator',
        value: char,
        loc: { start, end: this.getPosition() },
        range: [startIndex, this.index]
      };
    }

    // Unknown character
    this.advance();
    return null;
  }

  private scanIdentifier(): Token {
    const start = this.getPosition();
    const startIndex = this.index;

    while (!this.eof() && /[a-zA-Z0-9_]/.test(this.peek())) {
      this.advance();
    }

    const value = this.source.substring(startIndex, this.index);

    if (KEYWORDS.has(value)) {
      if (value === 'true' || value === 'false') {
        return {
          type: 'BooleanLiteral',
          value,
          loc: { start, end: this.getPosition() },
          range: [startIndex, this.index]
        };
      }
      if (value === 'nil') {
        return {
          type: 'NilLiteral',
          value,
          loc: { start, end: this.getPosition() },
          range: [startIndex, this.index]
        };
      }
      return {
        type: 'Keyword',
        value,
        loc: { start, end: this.getPosition() },
        range: [startIndex, this.index]
      };
    }

    return {
      type: 'Identifier',
      value,
      loc: { start, end: this.getPosition() },
      range: [startIndex, this.index]
    };
  }

  private scanNumber(): Token {
    const start = this.getPosition();
    const startIndex = this.index;

    // Hexadecimal
    if (this.peekString(2).toLowerCase() === '0x') {
      this.advance();
      this.advance();
      while (!this.eof() && /[0-9a-fA-F]/.test(this.peek())) {
        this.advance();
      }
    } else {
      // Decimal
      while (!this.eof() && /[0-9]/.test(this.peek())) {
        this.advance();
      }

      // Decimal part
      if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
        this.advance();
        while (!this.eof() && /[0-9]/.test(this.peek())) {
          this.advance();
        }
      }
    }

    // Exponent
    if (this.peek().toLowerCase() === 'e') {
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        this.advance();
      }
      while (!this.eof() && /[0-9]/.test(this.peek())) {
        this.advance();
      }
    }

    const value = this.source.substring(startIndex, this.index);
    return {
      type: 'NumericLiteral',
      value,
      loc: { start, end: this.getPosition() },
      range: [startIndex, this.index]
    };
  }

  private scanString(): Token {
    const start = this.getPosition();
    const startIndex = this.index;
    const quote = this.advance();

    let value = '';

    while (!this.eof() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const escaped = this.advance();
        value += this.unescape(escaped);
      } else if (this.peek() === '\n') {
        throw new Error('Unterminated string literal');
      } else {
        value += this.advance();
      }
    }

    if (this.eof()) {
      throw new Error('Unterminated string literal');
    }

    this.advance(); // closing quote

    const raw = this.source.substring(startIndex, this.index);
    return {
      type: 'StringLiteral',
      value,
      loc: { start, end: this.getPosition() },
      range: [startIndex, this.index]
    };
  }

  private scanLongString(): Token {
    const start = this.getPosition();
    const startIndex = this.index;

    // Skip [=[
    let eqCount = 0;
    this.advance(); // [
    while (this.peek() === '=') {
      eqCount++;
      this.advance();
    }
    this.advance(); // [

    // Skip initial newline if present
    if (this.peek() === '\n') {
      this.advance();
    }

    let value = '';
    const closingPattern = ']' + '='.repeat(eqCount) + ']';

    while (!this.eof()) {
      if (this.peekString(closingPattern.length) === closingPattern) {
        for (let i = 0; i < closingPattern.length; i++) {
          this.advance();
        }
        break;
      }
      value += this.advance();
    }

    return {
      type: 'StringLiteral',
      value,
      loc: { start, end: this.getPosition() },
      range: [startIndex, this.index]
    };
  }

  private unescape(char: string): string {
    const escapes: Record<string, string> = {
      'a': '\x07',
      'b': '\x08',
      'f': '\x0c',
      'n': '\n',
      'r': '\r',
      't': '\t',
      'v': '\x0b',
      '\\': '\\',
      '"': '"',
      "'": "'"
    };

    if (escapes[char]) {
      return escapes[char];
    }

    // Numeric escape
    if (/[0-9]/.test(char)) {
      let num = char;
      while (!this.eof() && /[0-9]/.test(this.peek()) && num.length < 3) {
        num += this.advance();
      }
      return String.fromCharCode(parseInt(num, 10));
    }

    return char;
  }
}

export function tokenize(source: string): Token[] {
  const lexer = new LuaLexer(source);
  return lexer.tokenize();
}
