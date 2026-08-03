import { LADDER, PLAYER_COLORS, SECTORS, SPACES, STOCK_BY_CODE, PIECE_BY_KEY, WEAK_DEMAND_THRESHOLD } from '../../data';
import { getStockMovementStatus } from '../../engine';
import { useGameState } from '../../store';
import investabearImg from '../../assets/investabear.png';

// Bull Market Club palette — mirrors PAL in public/board-3d.html
const PARCH = '#f0e7d1', ETF_PARCH = '#eddbb0', SPEC_PARCH = '#e9dec3';
const CORNER_BG = '#3a2717', INK = '#2b2016', INK_LT = '#efe3c4';

// Risk chip colors — mirrors RISK_COL in the 3D board
const RISK_CHIP: Record<string, string> = {
  Low: '#5f7a52', Med: '#9c6f1f', High: '#a83a2c',
};

function gridPos(n: number): { col: number; row: number } {
  if (n <= 10) return { col: n, row: 1 };
  if (n <= 18) return { col: 10, row: n - 9 };
  if (n === 19) return { col: 10, row: 10 };
  if (n <= 27) return { col: 10 - (n - 19), row: 10 };
  if (n === 28) return { col: 1, row: 10 };
  return { col: 1, row: 10 - (n - 28) };
}

// Special-space colors, labels and glyphs — mirrors SPECIAL in public/board-3d.html
const SPECIAL_3D: Record<number, { color: string; label: string; glyph: string; corner?: boolean; etf?: boolean }> = {
  1:  { color: '#22c55e', label: 'MKT\nOPEN',      glyph: '»', corner: true },
  4:  { color: '#4da3ff', label: 'GROWTH\nFUND',   glyph: '◆', etf: true },
  7:  { color: '#f0b429', label: 'THE\nFED',       glyph: '%' },
  10: { color: '#4ade80', label: 'IPO',            glyph: '↑', corner: true },
  13: { color: '#3ed598', label: 'INCOME\nFUND',   glyph: '◆', etf: true },
  16: { color: '#3ed598', label: 'BULL\nRUN',       glyph: '🐂' },
  19: { color: '#FF5C5C', label: 'MARKET\nEVENT',  glyph: '◈', corner: true },
  22: { color: '#a78bfa', label: 'PROP\nFUND',     glyph: '◆', etf: true },
  25: { color: '#9aa5b1', label: 'PORT\nTAX',      glyph: '$' },
  26: { color: '#ef4444', label: 'BEAR\nRUN',       glyph: '🐻' },
  28: { color: '#4ade80', label: 'IPO',            glyph: '↑', corner: true },
  30: { color: '#ff9442', label: 'ENERGY\nFUND',   glyph: '◆', etf: true },
  31: { color: '#c4b5fd', label: 'INVESTOR\nDAY',  glyph: '★' },
  34: { color: '#e8b44c', label: 'AUDIT\nNOTICE',  glyph: '⚑' },
};

// Parchment fibre vignette — mirrors paintTileBase in the 3D board
const TILE_VIGNETTE = 'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.05) 10%, rgba(60,40,20,0.10) 72%)';

// Letterpress type: light offset under an ink fill (canvas does fill offset +1.5px)
const LETTERPRESS = '1px 1px 0 rgba(255,250,235,0.7)';

/** Routed inner keyline at 5% inset — mirrors the 3D tile's strokeRect. */
function Keyline({ color = 'rgba(43,32,22,0.18)', inset = '5%' }: { color?: string; inset?: string }) {
  return (
    <div style={{
      position: 'absolute', inset, pointerEvents: 'none',
      border: `1px solid ${color}`, borderRadius: 1,
    }} />
  );
}

function PlayerTokens({ players, s }: { players: number[]; s: ReturnType<typeof useGameState> }) {
  if (players.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', top: 2, right: 2, zIndex: 3,
      display: 'flex', gap: 1,
      flexWrap: 'wrap', justifyContent: 'flex-end',
      maxWidth: 18,
    }}>
      {players.map((pi) => (
        <div key={pi} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${PLAYER_COLORS[pi]}ff, ${PLAYER_COLORS[pi]}88)`,
          boxShadow: `0 0 5px ${PLAYER_COLORS[pi]}`,
          border: '1px solid rgba(255,255,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 7, lineHeight: 1,
        }}>
          {PIECE_BY_KEY[s.players[pi]?.piece]?.emoji ?? ''}
        </div>
      ))}
    </div>
  );
}

export default function BoardTrack() {
  const s = useGameState();
  const byPos: Record<number, number[]> = {};
  s.players.forEach((p, i) => { if (!byPos[p.pos]) byPos[p.pos] = []; byPos[p.pos].push(i); });

  return (
    <div style={{
      // Lacquered walnut slab — repeating grain + warm sheen, brass edge
      background: [
        'linear-gradient(105deg, rgba(0,0,0,0.22), rgba(255,240,210,0.06) 30%, rgba(0,0,0,0.18) 62%, rgba(255,240,210,0.04))',
        'repeating-linear-gradient(97deg, #57391f 0 6px, #4a2f18 6px 10px, #5c3d22 10px 18px, #452b15 18px 24px)',
      ].join(', '),
      border: '1px solid #6a4f2e',
      borderTop: '1px solid rgba(201,162,79,0.4)',
      borderRadius: 14,
      padding: '12px',
      boxShadow: '0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,162,79,0.12), 0 0 0 1px rgba(201,162,79,0.1)',
    }}>
      <div className="display" style={{ fontSize: 10, fontWeight: 600, letterSpacing: 3, color: 'rgba(224,193,132,0.9)', textTransform: 'uppercase', marginBottom: 8 }}>
        The Exchange · Board
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 1fr)',
        gridTemplateRows: 'repeat(10, 1fr)',
        gap: 3,
        aspectRatio: '1',
      }}>
        {/* Center panel — club-green felt well, brass bezel, bear-mascot medallion */}
        <div style={{
          gridColumn: '2 / 10',
          gridRow: '2 / 10',
          background: [
            /* felt crosshatch weave */
            'repeating-linear-gradient(45deg, rgba(58,85,68,0.10) 0 2px, transparent 2px 5px)',
            'repeating-linear-gradient(-45deg, rgba(18,32,26,0.14) 0 2px, transparent 2px 5px)',
            /* felt base with a soft center glow */
            'radial-gradient(ellipse at 50% 46%, #2a3a30 0%, #223026 60%, #1a251d 100%)',
          ].join(', '),
          border: '2px solid #c9a24f',
          borderRadius: 10,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px rgba(201,162,79,0.35), inset 0 0 44px rgba(0,0,0,0.45)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Title lockup — top */}
          <div style={{ position: 'absolute', top: '9%', left: 0, right: 0, textAlign: 'center', userSelect: 'none' }}>
            <div className="display" style={{ fontSize: 8, letterSpacing: 6, color: 'rgba(212,165,53,0.85)', textTransform: 'uppercase' }}>The</div>
            <div className="display" style={{
              fontSize: 26, letterSpacing: 4, color: '#e6c887',
              textShadow: '0 0 18px rgba(212,165,53,0.45), 0 2px 6px rgba(0,0,0,0.85)', lineHeight: 1, marginTop: 1,
            }}>EXCHANGE</div>
            <div style={{ fontSize: 6, color: 'rgba(224,222,205,0.6)', marginTop: 4, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace' }}>
              Stock Market Game
            </div>
            <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,162,79,0.6), transparent)', margin: '6px auto 0' }} />
          </div>

          {/* Bear mascot medallion — center, brass ring */}
          <div style={{
            width: '38%', aspectRatio: '1', borderRadius: '50%',
            background: `#1c2a22 url("${investabearImg}") center bottom / auto 118% no-repeat`,
            border: '2px solid #c9a24f',
            boxShadow: '0 0 0 4px rgba(201,162,79,0.22), inset 0 0 22px rgba(0,0,0,0.55)',
            marginTop: '10%',
          }} />

          {/* InvestaBear label — bottom left */}
          <div style={{ position: 'absolute', bottom: 7, left: 9, userSelect: 'none' }}>
            <div className="display" style={{ fontSize: 7, letterSpacing: 1.2, color: 'rgba(224,193,132,0.92)', textTransform: 'uppercase' }}>InvestaBear</div>
            <div style={{ fontSize: 5.5, color: 'rgba(179,156,120,0.8)', fontStyle: 'italic', marginTop: 1 }}>Market Guide</div>
          </div>

          {/* EST badge — bottom center */}
          <div style={{ position: 'absolute', bottom: 7, left: 0, right: 0, textAlign: 'center', userSelect: 'none' }}>
            <span style={{ fontSize: 5, color: 'rgba(201,162,79,0.5)', letterSpacing: 2, fontFamily: 'IBM Plex Mono, monospace' }}>EST. 2025</span>
          </div>
        </div>

        {SPACES.map((sp) => {
          const { col, row } = gridPos(sp.n);
          const players = byPos[sp.n] ?? [];
          const isCur = players.includes(s.cur);

          if (sp.type === 'stock') {
            const stock = STOCK_BY_CODE[sp.code!];
            const price = LADDER[s.prices[sp.code!]];
            const weakCount = s.skips[sp.code!] ?? 0;
            const soldOut = s.soldOut[sp.code!];
            const claimIdx = soldOut?.claimHolder ?? null;
            const claimColor = claimIdx !== null ? PLAYER_COLORS[claimIdx] : null;
            const mv = getStockMovementStatus(sp.code!, s);
            const mvColor = mv.direction === 'up' ? '#1e7a4a' : mv.direction === 'down' ? '#b03a2c' : '#8a795e';
            const mvGlyph = mv.direction === 'up' ? '▲' : mv.direction === 'down' ? '▼' : '';
            const sc = stock ? SECTORS[stock.sector].color : '#c9a24f';
            const secGlyph = stock ? SECTORS[stock.sector].glyph : '';

            // Parchment certificate tile — mirrors makeStockLabel in the 3D board:
            // sector glyph upper-left, letterpress ticker, centered price + arrow,
            // centered risk chip, full-width sold-out claim band.
            return (
              <div key={sp.n} style={{
                gridColumn: col, gridRow: row,
                background: `${TILE_VIGNETTE}, ${isCur ? 'linear-gradient(160deg, #fdf6e6, ' + PARCH + ')' : PARCH}`,
                border: claimColor ? `1px solid ${claimColor}` : '1px solid rgba(43,32,22,0.22)',
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden',
                minHeight: 0,
                boxShadow: claimColor
                  ? `0 0 10px ${claimColor}66, inset 0 0 0 1px ${claimColor}55`
                  : isCur ? '0 0 0 1px #c9a24f, 0 0 12px rgba(201,162,79,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.5)',
              }}>
                <Keyline />

                {/* Sector glyph — upper-left, sector color */}
                <span style={{
                  position: 'absolute', left: '10%', top: '13%',
                  fontSize: 8, color: sc, lineHeight: 1, fontFamily: 'IBM Plex Mono, monospace',
                }}>{secGlyph}</span>

                {/* Ticker — letterpress Marcellus, centered */}
                <div className="display" style={{
                  position: 'absolute', top: '27%', left: 0, right: 0,
                  textAlign: 'center', fontSize: 11, fontWeight: 700,
                  color: INK, lineHeight: 1, letterSpacing: 0.3,
                  textShadow: LETTERPRESS,
                }}>{sp.code}</div>

                {/* Price + movement arrow — centered */}
                <div style={{
                  position: 'absolute', top: '52%', left: 0, right: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, lineHeight: 1,
                }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, fontWeight: 700, color: INK }}>
                    ${price >= 1000 ? `${price / 1000}k` : price}
                  </span>
                  {mvGlyph && <span style={{ fontSize: 7, color: mvColor, fontWeight: 700, lineHeight: 1 }}>{mvGlyph}</span>}
                </div>

                {/* Risk chip — centered pill (hidden when sold out) */}
                {!soldOut && (
                  <div style={{ position: 'absolute', top: '72%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      fontSize: 6, fontWeight: 700, letterSpacing: 0.3,
                      fontFamily: 'IBM Plex Mono, monospace',
                      background: RISK_CHIP[stock?.risk ?? 'Med'], color: '#f4ecd9',
                      borderRadius: 3, padding: '1px 5px', lineHeight: 1.4,
                    }}>{(stock?.risk ?? '').toUpperCase()}</span>
                  </div>
                )}

                {/* Sold-out claim band — full-width bottom strip */}
                {soldOut && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, height: '16%',
                    background: claimColor ?? '#8a8a8a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{
                      fontSize: 5.5, fontWeight: 700, color: '#14100a',
                      fontFamily: 'IBM Plex Mono, monospace', letterSpacing: 0.3, lineHeight: 1,
                    }}>{claimColor ? 'SOLD OUT' : 'CONTESTED'}</span>
                  </div>
                )}

                {/* Weak-demand marker — bottom-right corner */}
                {!soldOut && weakCount > 0 && (
                  <span style={{
                    position: 'absolute', bottom: 1, right: 1,
                    fontSize: 6, fontWeight: 700,
                    background: '#b03a2c', color: '#fbe3dd',
                    borderRadius: 2, padding: '1px 3px', lineHeight: 1,
                  }}>{weakCount}/{WEAK_DEMAND_THRESHOLD}</span>
                )}

                <PlayerTokens players={players} s={s} />
              </div>
            );
          }

          // Special / ETF / corner tile — mirrors makeSpecialLabel in the 3D board
          const def = SPECIAL_3D[sp.n] ?? { color: sp.color ?? '#c9a24f', label: sp.name ?? '', glyph: sp.glyph ?? '' };
          const color = def.color;
          const isCorner = !!def.corner;
          const isEtf = !!def.etf;
          const tileBg = isCorner ? CORNER_BG : isEtf ? ETF_PARCH : SPEC_PARCH;
          const labelInk = isCorner ? INK_LT : INK;
          const lines = def.label.split('\n');

          return (
            <div key={sp.n} style={{
              gridColumn: col, gridRow: row,
              background: isCorner
                ? [
                    // guilloche rosette approximation — concentric engraved rings
                    `radial-gradient(circle at 50% 50%, transparent 22%, ${color}30 23%, transparent 25%, transparent 38%, ${color}26 39%, transparent 41%)`,
                    `repeating-radial-gradient(circle at 50% 50%, ${color}12 0 1px, transparent 1px 5px)`,
                    CORNER_BG,
                  ].join(', ')
                : `${TILE_VIGNETTE}, ${tileBg}`,
              border: isCorner
                ? (isCur ? `1px solid ${color}` : '1px solid rgba(0,0,0,0.4)')
                : (isCur ? '1px solid #c9a24f' : '1px solid rgba(43,32,22,0.22)'),
              borderRadius: isCorner ? 7 : 4,
              position: 'relative',
              overflow: 'hidden',
              minHeight: 0,
              boxShadow: isCorner
                ? `inset 0 0 16px ${color}22${isCur ? ', 0 0 12px rgba(201,162,79,0.5)' : ''}`
                : isCur ? '0 0 0 1px #c9a24f, 0 0 12px rgba(201,162,79,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}>
              {/* Keyline — colored on corners, routed ink on parchment */}
              <Keyline color={isCorner ? `${color}99` : 'rgba(43,32,22,0.18)'} inset={isCorner ? '6%' : '5%'} />

              {/* Glyph medallion */}
              <div style={{
                position: 'absolute', top: isCorner ? '22%' : '20%', left: 0, right: 0,
                textAlign: 'center',
                fontSize: isCorner ? 15 : 12,
                fontFamily: 'IBM Plex Mono, monospace',
                color,
                lineHeight: 1,
                filter: isCorner ? `drop-shadow(0 0 5px ${color}99)` : 'none',
              }}>{def.glyph}</div>

              {/* Label — letterpress Marcellus */}
              <div className="display" style={{
                position: 'absolute', top: isCorner ? '52%' : '54%', left: 0, right: 0,
                fontSize: 6.5, fontWeight: 700,
                color: labelInk,
                textAlign: 'center',
                lineHeight: 1.4,
                letterSpacing: 0.2,
                textShadow: isCorner ? 'none' : LETTERPRESS,
              }}>
                {lines.map((t, i) => <div key={i}>{t}</div>)}
              </div>

              {/* ETF safe-haven badge — fixed price, never force-sold */}
              {isEtf && (
                <span title="Fixed price · never force-sold · can't be sold" style={{
                  position: 'absolute', bottom: 1, left: 2,
                  fontSize: 6, lineHeight: 1, opacity: 0.8,
                }}>🔒</span>
              )}

              <PlayerTokens players={players} s={s} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
