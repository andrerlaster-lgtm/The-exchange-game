import { describe, expect, it } from 'vitest';
import { SPACES } from '../data';
import boardTrackSrc from '../components/game/BoardTrack.tsx?raw';
import board3dSrc from '../../public/board-3d.html?raw';
import boardPrintSrc from '../../public/board-print.html?raw';

// Guards against the class of bug fixed on 2026-09-18: BoardTrack.tsx, public/board-3d.html,
// and public/board-print.html each keep a hand-maintained copy of the special-space labels
// and glyphs defined in src/data/boardSpaces.ts (none of them can import a TS module — the
// two public/*.html files aren't part of the Vite module graph). A board redesign has to be
// re-applied to all four by hand, and nothing previously caught a copy left behind.

function normalizeLabel(label: string): string {
  // Handles both real newlines (from the parsed TS AST value) and the literal
  // two-character "\n" escape sequence still present in raw regex-extracted source text.
  return label.replace(/\\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

// Event and regime spaces keep the same wording in every renderer; other
// special spaces (ETF funds, portfolio tax) intentionally use shortened
// labels and a shared ETF glyph on the small board tiles, so this test is
// scoped to the event/regime ones rather than asserting universal parity.
// Renumbered for the 40-space board (2026-09-20): Market Events at 16, 29 and
// 40, Market Swing on the corner at 21.
const SPECIAL_SPACE_NUMBERS = [16, 21, 29, 40];

function canonicalLabelAndGlyph(n: number): { label: string; glyph: string } {
  const space = SPACES.find((s) => s.n === n)!;
  return { label: normalizeLabel((space as { name: string }).name), glyph: (space as { glyph: string }).glyph };
}

function extractFromObjectLiteral(source: string, varName: string, n: number): { label: string; glyph: string } | undefined {
  // Find the object literal assigned to varName, then the block for key `n` within it.
  const varMatch = source.match(new RegExp(`(?:const|let)\\s+${varName}\\s*(?::[^=]+)?=\\s*\\{`));
  if (!varMatch) throw new Error(`could not find ${varName} object literal`);
  const objStart = varMatch.index! + varMatch[0].length - 1;
  // Match a balanced brace region so nested objects don't confuse the entry regex.
  let depth = 0;
  let objEnd = objStart;
  for (let i = objStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { objEnd = i; break; } }
  }
  const body = source.slice(objStart, objEnd + 1);

  const entryMatch = body.match(new RegExp(`\\b${n}:\\s*[\\[{]([\\s\\S]*?)[\\]}],?\\n`));
  if (!entryMatch) return undefined;
  const entry = entryMatch[1];

  const labelMatch = entry.match(/(?:label|name)\s*:\s*'([^']*)'/) ?? entry.match(/'([A-Z][A-Z /]*)'/);
  const glyphMatch = entry.match(/(?:glyph)\s*:\s*'([^']*)'/);

  if (!labelMatch || !glyphMatch) return undefined;
  return { label: normalizeLabel(labelMatch[1]), glyph: glyphMatch[1] };
}

describe('special-space parity across board renderers', () => {
  it.each(SPECIAL_SPACE_NUMBERS)('space %i has matching label and glyph in every renderer', (n) => {
    const canonical = canonicalLabelAndGlyph(n);

    const boardTrack = extractFromObjectLiteral(boardTrackSrc, 'SPECIAL_3D', n);
    const board3d = extractFromObjectLiteral(board3dSrc, 'SPECIAL', n);
    const boardPrint = extractFromObjectLiteral(boardPrintSrc, 'SPECIALS', n);

    expect(boardTrack, `BoardTrack.tsx SPECIAL_3D[${n}]`).toBeDefined();
    expect(board3d, `public/board-3d.html SPECIAL[${n}]`).toBeDefined();
    expect(boardPrint, `public/board-print.html SPECIALS[${n}]`).toBeDefined();

    expect(boardTrack!.label, `BoardTrack.tsx label for space ${n}`).toBe(canonical.label);
    expect(board3d!.label, `board-3d.html label for space ${n}`).toBe(canonical.label);
    expect(boardPrint!.label, `board-print.html label for space ${n}`).toBe(canonical.label);

    expect(boardTrack!.glyph, `BoardTrack.tsx glyph for space ${n}`).toBe(canonical.glyph);
    expect(board3d!.glyph, `board-3d.html glyph for space ${n}`).toBe(canonical.glyph);
    expect(boardPrint!.glyph, `board-print.html glyph for space ${n}`).toBe(canonical.glyph);
  });
});
