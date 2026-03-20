/**
 * Test samples for Prometheus deobfuscator
 * These are representative examples of Prometheus Weak preset obfuscation
 */

// Sample 1: String table obfuscation
export const SAMPLE_STRING_TABLE = `
local strings = {"print", "Hello", "World"}
local func = _G[strings[1]]
func(strings[2] .. " " .. strings[3])
`;

// Sample 2: Variable renaming with confusing characters
export const SAMPLE_VARIABLE_RENAME = `
local IlI1lI = 10
local lI1IlI = 20
local I1lIlI = IlI1lI + lI1IlI
print(I1lIlI)
`;

// Sample 3: Constant folding
export const SAMPLE_CONSTANT_FOLDING = `
local x = (10 + 20) * 2
local y = 100 / 4 - 5
local z = string.len("hello") + 5
print(x, y, z)
`;

// Sample 4: Control flow obfuscation (always-true while)
export const SAMPLE_CONTROL_FLOW = `
local x = 0
while true do
    x = x + 1
    if x > 5 then
        break
    end
end
print(x)
`;

// Sample 5: Combined obfuscation
export const SAMPLE_COMBINED = `
local IllIII = {"func1", "value", 42}
local llllll = function(IIIIII)
    local IIIIII = IIIIII + 1
    return IIIIII
end
local I1I1I1 = _G[IllIII[1]]
local result = llllll(IllIII[3])
print(result)
`;

// Sample 6: String concatenation
export const SAMPLE_STRING_CONCAT = `
local str = "Hel" .. "lo" .. " " .. "Wor" .. "ld"
print(str)
`;

// Sample 7: String.char encoding
export const SAMPLE_STRING_CHAR = `
local str = string.char(72, 101, 108, 108, 111)
print(str)
`;

// Sample 8: Dead code
export const SAMPLE_DEAD_CODE = `
local unused = "this is never used"
local x = 5
do
    -- Empty block
end
if false then
    print("never executed")
end
print(x)
`;

// Sample 9: Real Prometheus-style obfuscation (Weak preset simulation)
export const SAMPLE_PROMETHEUS_WEAK = `
local IlI1lIlI1lI = {[1]="print",[2]="Hello World!",[3]="concat",[4]="format"}
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
local result = I1lIlI1lIlI(10)
lI1IlI1IlI1(tostring(result))
`;

// Expected outputs for validation
export const EXPECTED_OUTPUTS = {
  SAMPLE_STRING_TABLE: `local strings = {"print", "Hello", "World"}
local func = _G["print"]
func("Hello World")`,

  SAMPLE_VARIABLE_RENAME: `local num0 = 10
local num1 = 20
local num2 = num0 + num1
print(num2)`,

  SAMPLE_CONSTANT_FOLDING: `local x = 60
local y = 20
local z = 10
print(x, y, z)`,

  SAMPLE_CONTROL_FLOW: `local x = 0
x = x + 1
x = x + 1
x = x + 1
x = x + 1
x = x + 1
x = x + 1
print(x)`
};

// All samples for batch testing
export const ALL_SAMPLES = {
  'String Table': SAMPLE_STRING_TABLE,
  'Variable Rename': SAMPLE_VARIABLE_RENAME,
  'Constant Folding': SAMPLE_CONSTANT_FOLDING,
  'Control Flow': SAMPLE_CONTROL_FLOW,
  'Combined': SAMPLE_COMBINED,
  'String Concat': SAMPLE_STRING_CONCAT,
  'String Char': SAMPLE_STRING_CHAR,
  'Dead Code': SAMPLE_DEAD_CODE,
  'Prometheus Weak': SAMPLE_PROMETHEUS_WEAK
};
