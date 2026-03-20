# Prometheus Deobfuscator

A complete deobfuscator for [Prometheus Lua Obfuscator](https://github.com/prometheus-lua/Prometheus) (Weak preset), written in pure Node.js/TypeScript.

## Features

- 🔄 **Complete AST-based deobfuscation** - Parses and reconstructs Lua code at the AST level
- 🧩 **Modular layer architecture** - Each deobfuscation technique is a separate layer
- ⚡ **Multi-pass processing** - Runs multiple iterations until no more changes
- 📊 **Detailed reports** - Track all changes made during deobfuscation
- 🛠️ **CLI & API** - Use as command-line tool or library

## Supported Obfuscation Techniques (Weak Preset)

| Technique | Layer | Description |
|-----------|-------|-------------|
| String Table Lookup | `StringDecoder` | Decodes strings from array/key-value tables |
| String Concatenation | `StringDecoder` | Resolves `"a" .. "b"` patterns |
| String.char Encoding | `StringDecoder` | Decodes `string.char(65, 66, 67)` patterns |
| Constant Folding | `ConstantFolding` | Evaluates `(1 + 2) * 3` → `9` |
| Control Flow Obfuscation | `ControlFlowCleaner` | Removes always-true loops, dead branches |
| Variable Renaming | `VariableRenamer` | Restores meaningful names from `IlI1lI` patterns |
| Dead Code Injection | `DeadCodeRemover` | Removes unused variables and unreachable code |

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/prometheus-deobfuscator.git
cd prometheus-deobfuscator

# Install dependencies
npm install

# Build
npm run build
```

## CLI Usage

```bash
# Deobfuscate a single file
npm run start -- input.lua -o output.lua

# Deobfuscate with verbose output
npm run start -- input.lua -v

# Process entire directory
npm run start -- ./obfuscated/ -o ./deobfuscated/

# Generate detailed report
npm run start -- input.lua --report

# Use specific layers only
npm run start -- input.lua -l ConstantFolding,StringDecoder

# List available layers
npm run start -- --list-layers
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Output file or directory |
| `-v, --verbose` | Show detailed output |
| `-i, --iterations <n>` | Maximum deobfuscation iterations (default: 5) |
| `-l, --layers <names>` | Comma-separated list of layers to use |
| `-r, --report` | Generate JSON deobfuscation report |
| `-w, --overwrite` | Overwrite input files |
| `--list-layers` | List available deobfuscation layers |

## API Usage

```typescript
import { deobfuscate, deobfuscateWithReport, Deobfuscator } from 'prometheus-deobfuscator';

// Simple usage
const deobfuscated = deobfuscate(obfuscatedCode);

// With detailed report
const report = deobfuscateWithReport(obfuscatedCode);
console.log(report.changes);

// Custom configuration
const deobfuscator = new Deobfuscator({
  verbose: true,
  maxIterations: 10,
  layers: ['StringDecoder', 'ConstantFolding']
});

const result = deobfuscator.deobfuscate(obfuscatedCode);
```

## Deobfuscation Report

```typescript
interface DeobfuscationReport {
  original: string;        // Original obfuscated code
  deobfuscated: string;    // Clean deobfuscated code
  iterations: number;      // Number of passes performed
  layersApplied: string[]; // Names of layers that made changes
  changes: string[];       // List of all modifications
  success: boolean;        // Whether deobfuscation succeeded
  error?: string;          // Error message if failed
}
```

## Architecture

```
prometheus-deobfuscator/
├── src/
│   ├── parser/           # Lua parser and code generator
│   │   ├── lexer.ts      # Tokenizer
│   │   ├── parser.ts     # AST parser
│   │   ├── generator.ts  # Code generator
│   │   └── types.ts      # AST type definitions
│   ├── layers/           # Deobfuscation layers
│   │   ├── base.ts       # Layer interface
│   │   ├── string-decoder.ts
│   │   ├── constant-folding.ts
│   │   ├── control-flow-cleaner.ts
│   │   ├── variable-renamer.ts
│   │   └── dead-code-remover.ts
│   ├── core/             # Engine and public API
│   │   └── engine.ts     # Deobfuscation orchestrator
│   ├── cli.ts            # Command-line interface
│   └── index.ts          # Main entry point
├── tests/                # Test suite
│   ├── parser.test.ts
│   ├── layers.test.ts
│   ├── engine.test.ts
│   └── samples/          # Test samples
└── .github/
    └── workflows/        # CI/CD workflows
```

## Example

### Input (Obfuscated)

```lua
local IlI1lIlI1lI = {[1]="print",[2]="Hello World!"}
local lI1IlI1IlI1 = _G[IlI1lIlI1lI[1]]
local function I1lIlI1lIlI(IllIllIllI)
    local lIIlIIlIIlI = 0
    while true do
        lIIlIIlIIlI = lIIlIIlIIlI + 1
        if lIIlIIlIIlI > IllIllIllI then
            break
        end
    end
    return lIIlIIlIIlI
end
lI1IlI1IlI1(IlI1lIlI1lI[2])
```

### Output (Deobfuscated)

```lua
print("Hello World!")
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type checking
npm run typecheck
```

## Limitations

- Currently supports **Lua 5.1** only
- Designed for **Weak preset** - Medium and Strong presets may require additional work
- Some complex control flow patterns may not be fully simplified
- Dynamic string generation (runtime-dependent) cannot be resolved statically

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This tool is intended for educational purposes and legitimate reverse engineering. Do not use it for any illegal activities.
