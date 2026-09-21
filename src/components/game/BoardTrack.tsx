import type { CSSProperties } from 'react';
import { BOARD_SIDE, PRICE_MOVE_SOURCE_LABEL, REGULAR_SUPPLY, UPGRADE_LEVELS, PLAYER_COLORS, SECTORS, SECTOR_PAIRS, SECTOR_PAIR_BY_CODE, SPACES, STOCK_BY_CODE, PIECE_BY_KEY, WEAK_DEMAND_THRESHOLD } from '../../data';
import { developmentOf, getStockMovementStatus, sectorPairOwner } from '../../engine';
import { pctBp } from '../../utils/formatMoney';
import { useGameState, useDispatch } from '../../store';
import { LandingResultBanner } from './ActionPanel';
import investabearImg from '../../assets/investabear.png';
import BoardDiceControls from './BoardDiceControls';
import MarketRegimeBadge from './MarketRegimeBadge';
import { BOARD_PALETTES, useBoardTheme } from './useBoardTheme';

// Bull Market Club palette — mirrors PAL in public/board-3d.html. The tile
// colours now come from the board theme (useBoardTheme): parchment by
// default, slate when the table wants the sector colours to carry.
const CORNER_BG = '#3a2717', INK_LT = '#efe3c4';

/** Where a space sits on the square: clockwise from the top-left corner,
    across the top, down the right, back along the bottom, up the left. Reads
    the board's size rather than hard-coding it, so the 36 → 40 change
    (2026-09-20) needed no arithmetic here. */
function gridPos(n: number): { col: number; row: number } {
  const side = BOARD_SIDE;                 // spaces along one edge, corners included
  if (n <= side) return { col: n, row: 1 };                          // top edge
  if (n < side * 2 - 1) return { col: side, row: n - side + 1 };     // right edge
  if (n === side * 2 - 1) return { col: side, row: side };           // bottom-right corner
  if (n < side * 3 - 2) return { col: side - (n - (side * 2 - 1)), row: side };  // bottom edge
  if (n === side * 3 - 2) return { col: 1, row: side };              // bottom-left corner
  return { col: 1, row: side - (n - (side * 3 - 2)) };               // left edge, and n === last is row 2
}

// Special-space colors, labels and glyphs — mirrors SPECIAL in public/board-3d.html
const SPECIAL_3D: Record<number, { color: string; label: string; glyph: string; corner?: boolean; etf?: boolean }> = {
  1:  { color: '#22c55e', label: 'MKT\nOPEN',      glyph: '»', corner: true },
  4:  { color: '#4da3ff', label: 'GROWTH\nFUND',   glyph: '◆', etf: true },
  7:  { color: '#f0b429', label: 'THE\nFED',       glyph: '%' },
  11: { color: '#4ade80', label: 'IPO',            glyph: '↑', corner: true },
  13: { color: '#3ed598', label: 'INCOME\nFUND',   glyph: '◆', etf: true },
  16: { color: '#FF5C5C', label: 'MARKET\nEVENT',  glyph: '◈' },
  19: { color: '#e8b44c', label: 'RATE\nDECISION', glyph: '%' },
  21: { color: '#A78BFA', label: 'MARKET\nSWING',  glyph: '⚡', corner: true },
  23: { color: '#a78bfa', label: 'PROP\nFUND',     glyph: '◆', etf: true },
  26: { color: '#9aa5b1', label: 'PORT\nTAX',      glyph: '$' },
  29: { color: '#FF5C5C', label: 'MARKET\nEVENT',  glyph: '◈' },
  31: { color: '#e8b44c', label: 'RATE\nDECISION', glyph: '%', corner: true },
  34: { color: '#ff9442', label: 'ENERGY\nFUND',   glyph: '◆', etf: true },
  35: { color: '#e8b44c', label: 'AUDIT\nNOTICE',  glyph: '⚑' },
  38: { color: '#c4b5fd', label: 'INVESTOR\nDAY',  glyph: '★' },
  40: { color: '#FF5C5C', label: 'MARKET\nEVENT',  glyph: '◈' },
};

// Parchment fibre vignette — mirrors paintTileBase in the 3D board


// Letterpress type: light offset under an ink fill (canvas does fill offset +1.5px)


/** Routed inner keyline at 5% inset — mirrors the 3D tile's strokeRect. */
/** The sector band, Monopoly-style: a solid stripe along the tile's OUTER
    edge. Drawn as a thick border rather than an overlay, so the tile's
    absolutely-positioned contents are inset by it instead of running under
    it. Which edge is "outer" depends on the side of the board. */
function sectorBandStyle(color: string, col: number, row: number, edge: string): CSSProperties {
  const band = `6px solid ${color}`;
  const hairline = `1px solid ${edge}`;
  const side = row === 1 ? 'top' : row === BOARD_SIDE ? 'bottom' : col === 1 ? 'left' : 'right';
  return {
    borderTop: side === 'top' ? band : hairline,
    borderBottom: side === 'bottom' ? band : hairline,
    borderLeft: side === 'left' ? band : hairline,
    borderRight: side === 'right' ? band : hairline,
  };
}

function Keyline({ color = 'rgba(43,32,22,0.18)', inset = '5%' }: { color?: string; inset?: string }) {
  return (
    <div style={{
      position: 'absolute', inset, pointerEvents: 'none',
      border: `1px solid ${color}`, borderRadius: 1,
    }} />
  );
}

/** Who is standing on a space. Sits along the bottom edge rather than the
    corner: a token there covered the outstanding-shares badge, and at four
    or more players on one space the row wrapped over the ticker. */
function PlayerTokens({ players, s }: { players: number[]; s: ReturnType<typeof useGameState> }) {
  if (players.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 1, zIndex: 4,
      display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center',
    }}>
      {players.map((pi) => {
        const color = PLAYER_COLORS[pi];
        const isTurn = pi === s.cur;
        return (
          <div key={pi} title={`${s.players[pi]?.name}${isTurn ? ' — to act' : ''}`} style={{
            width: 12, height: 12, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${color}ff, ${color}99)`,
            // The player whose turn it is gets a white ring and a stronger
            // glow, so "where everyone is" and "who is moving" read apart.
            border: `1.5px solid ${isTurn ? '#fffdf6' : 'rgba(255,255,255,0.45)'}`,
            boxShadow: isTurn ? `0 0 7px ${color}, 0 0 0 1px ${color}` : `0 0 4px ${color}aa`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, lineHeight: 1,
          }}>
            {PIECE_BY_KEY[s.players[pi]?.piece]?.emoji ?? ''}
          </div>
        );
      })}
    </div>
  );
}

/** The eight sector colours, so a tile's outline can be read off the board. */
function SectorLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
      {Object.values(SECTORS).map((sec) => (
        <span key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 2,
            background: `${sec.color}33`, border: `1.5px solid ${sec.color}`,
          }} />
          <span style={{ fontSize: 8, letterSpacing: 0.4, color: 'rgba(224,193,132,0.85)', textTransform: 'uppercase' }}>
            {sec.name}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function BoardTrack() {
  const s = useGameState();
  const dispatch = useDispatch();
  const theme = useBoardTheme();
  const pal = BOARD_PALETTES[theme];
  const PARCH = pal.tile, ETF_PARCH = pal.tileEtf, SPEC_PARCH = pal.tileSpecial;
  const INK = pal.ink, TILE_VIGNETTE = pal.vignette, LETTERPRESS = pal.letterpress;
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

      <SectorLegend />

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIDE}, 1fr)`,
        gridTemplateRows: `repeat(${BOARD_SIDE}, 1fr)`,
        gap: 3,
        aspectRatio: '1',
      }}>
        {/* Center panel — club-green felt well, brass bezel, bear-mascot medallion */}
        <div style={{
          gridColumn: `2 / ${BOARD_SIDE}`,
          gridRow: `2 / ${BOARD_SIDE}`,
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

          {s.opts.roundMarket && (
            <div style={{ position: 'absolute', top: '30%', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 4 }}>
              <MarketRegimeBadge round={s.marketRound} variant="board" />
            </div>
          )}

          <BoardDiceControls />


          {s.landingNotice && (
            <div style={{ position: 'absolute', left: '4%', right: '4%', top: '38%', zIndex: 9 }}>
              <LandingResultBanner s={s} dispatch={dispatch} />
            </div>
          )}

        </div>

        {SPACES.map((sp) => {
          const { col, row } = gridPos(sp.n);
          const players = byPos[sp.n] ?? [];
          const isCur = players.includes(s.cur);

          if (sp.type === 'stock') {
            const stock = STOCK_BY_CODE[sp.code!];
            const price = s.prices[sp.code!];
            const isPublic = (s.supply[sp.code!] ?? REGULAR_SUPPLY) < REGULAR_SUPPLY;
            const themeDirection = isPublic && s.marketTheme?.tailwinds.includes(stock.sector) ? 'up'
              : isPublic && s.marketTheme?.headwinds.includes(stock.sector) ? 'down' : null;
            const themeColor = themeDirection === 'up' ? '#3ed598' : '#ef4444';
            const weakCount = s.skips[sp.code!] ?? 0;
            const soldOut = s.soldOut[sp.code!];
            const outstanding = s.bankPool[sp.code!] ?? 0;
            const claimIdx = soldOut?.claimHolder ?? null;
            const claimColor = claimIdx !== null ? PLAYER_COLORS[claimIdx] : null;
            const dev = developmentOf(s, sp.code!);
            const last = s.lastMove?.[sp.code!];
            const lastColor = last && last.pct > 0 ? pal.up : pal.down;
            const mv = getStockMovementStatus(sp.code!, s);
            const mvColor = mv.direction === 'up' ? pal.up : mv.direction === 'down' ? pal.down : pal.flatText;
            const mvGlyph = mv.direction === 'up' ? '▲' : mv.direction === 'down' ? '▼' : '';
            const sc = stock ? SECTORS[stock.sector].color : '#c9a24f';
            const secGlyph = stock ? SECTORS[stock.sector].glyph : '';
            // Sector Control: a small ring around the sector glyph in the
            // controlling player's color. Owning a whole company requires
            // the all-or-nothing buyout (always sold out), so a controlled
            // pair's tiles are themselves always sold out too — this ring
            // is an extra cue on top of the claim-holder band below, not a
            // replacement for it (both companies could be sold out to
            // *different* players without either controlling the pair).
            const pairId = sp.code ? SECTOR_PAIR_BY_CODE[sp.code] : undefined;
            const pairOwnerIdx = pairId ? sectorPairOwner(s, pairId) : null;
            const pairOwnerColor = pairOwnerIdx !== null ? PLAYER_COLORS[pairOwnerIdx] : null;

            // Parchment certificate tile — mirrors makeStockLabel in the 3D board:
            // sector glyph upper-left, letterpress ticker, centered price + arrow,
            // centered risk chip, full-width sold-out claim band.
            return (
              <div key={sp.n} style={{
                gridColumn: col, gridRow: row,
                background: `${themeDirection === 'up' ? 'linear-gradient(160deg, rgba(62,213,152,0.30), rgba(62,213,152,0.08))' : themeDirection === 'down' ? 'linear-gradient(160deg, rgba(239,68,68,0.28), rgba(239,68,68,0.07))' : TILE_VIGNETTE}, ${isCur
                  ? `linear-gradient(160deg, ${theme === 'dark' ? '#2b2620' : '#fdf6e6'}, ${PARCH})`
                  : PARCH}`,
                // The tile is outlined in its sector's colour, so the board
                // reads as eight groups at a glance. A Payout Claim holder's
                // colour still wins the border — who is owed outranks which
                // sector — and the sector then shows as the inner keyline.
                ...sectorBandStyle(sc, col, row, claimColor ?? pal.edge),
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden',
                minHeight: 0,
                boxShadow: claimColor
                  ? `0 0 10px ${claimColor}66, inset 0 0 0 1px ${claimColor}55`
                  : themeDirection ? `0 0 0 1px ${themeColor}, 0 0 12px ${themeColor}66`
                  : isCur ? '0 0 0 1px #c9a24f, 0 0 12px rgba(201,162,79,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.5)',
              }}>
                {/* A Payout Claim holder's colour rides as the inner keyline,
                    so the sector band can keep the tile's outer edge. */}
                <Keyline color={claimColor ? `${claimColor}dd` : pal.keyline} inset="3%" />

                {/* Sector glyph — upper-left, sector color. A colored ring
                    appears around it when a player controls this stock's
                    Sector Control pair (owns both companies exclusively). */}
                <span title={pairOwnerColor ? `Sector Control: ${SECTOR_PAIRS[pairId!].name} — rent applies` : undefined} style={{
                  position: 'absolute', left: '10%', top: '13%',
                  fontSize: 8, color: sc, lineHeight: 1, fontFamily: 'IBM Plex Mono, monospace',
                  boxShadow: pairOwnerColor ? `0 0 0 1.5px ${pairOwnerColor}` : undefined,
                  borderRadius: pairOwnerColor ? '50%' : undefined,
                  padding: pairOwnerColor ? 1.5 : undefined,
                }}>{secGlyph}</span>
                {themeDirection && <span title={`Market Theme ${themeDirection === 'up' ? 'Tailwind' : 'Headwind'} — this public company will ${themeDirection === 'up' ? 'rise' : 'fall'} when the round ends`} style={{ position: 'absolute', right: '7%', top: '14%', color: themeColor, fontSize: 9, fontWeight: 900 }}>{themeDirection === 'up' ? '▲' : '▼'}</span>}

                {outstanding > 0 && (
                  <span title={`${outstanding} outstanding share${outstanding === 1 ? '' : 's'} · land here to buy`} style={{
                    // Above the ticker letters: at 9% a wide code (GMBX) ran under it.
                    position: 'absolute', right: '4%', top: '2%', zIndex: 2,
                    fontSize: 5.5, fontWeight: 900, lineHeight: 1,
                    color: '#f4ecd9', background: '#2f6fb0',
                    borderRadius: 3, padding: '2px 3px',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>{outstanding} OUT</span>
                )}

                {/* Ticker — letterpress Marcellus, centered */}
                <div className="display" style={{
                  position: 'absolute', top: '27%', left: 0, right: 0,
                  textAlign: 'center', fontSize: 11, fontWeight: 700,
                  color: INK, lineHeight: 1, letterSpacing: 0.3,
                  textShadow: LETTERPRESS,
                }}>
                  {sp.code}
                  {dev.level > 0 && (
                    <span title={`Development Level ${UPGRADE_LEVELS[dev.level - 1].numeral}`} style={{ fontSize: 8, marginLeft: 2, color: '#8a5a12' }}>
                      {UPGRADE_LEVELS[dev.level - 1].numeral}
                    </span>
                  )}
                  {dev.shieldActive && <span title="Market Protection active" style={{ fontSize: 7, marginLeft: 1 }}>🛡️</span>}
                </div>

                {/* Price + movement arrow — centered */}
                <div style={{
                  position: 'absolute', top: '52%', left: 0, right: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, lineHeight: 1,
                }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, fontWeight: 700, color: INK }}>
                    ${price.toLocaleString('en-US')}
                  </span>
                  {mvGlyph && <span style={{ fontSize: 7, color: mvColor, fontWeight: 700, lineHeight: 1 }}>{mvGlyph}</span>}
                </div>

                {/* Bottom row — risk chip (hidden when sold out) beside the last
                    move. Tiles are ~39px square at laptop sizes, so the last
                    move shares this row rather than taking a line of its own;
                    it is rounded to a whole percent here, with the exact figure,
                    cause and round in the tooltip. The ▲/▼ beside the price is
                    direction since OPENING — this is only the latest move. */}
                {(!soldOut || last) && (
                  <div style={{
                    // Sold out: no risk chip, so the last move takes this row
                    // alone, sitting a little higher and smaller to stay clear
                    // of both the price and the claim band below it.
                    position: 'absolute', top: soldOut ? '70%' : '72%', left: 0, right: 0,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2,
                  }}>
                    {!soldOut && (
                      <span style={{
                        fontSize: 6, fontWeight: 700, letterSpacing: 0.3,
                        fontFamily: 'IBM Plex Mono, monospace',
                        background: pal.riskChip[stock?.risk ?? 'Med'], color: '#f4ecd9',
                        borderRadius: 3, padding: last ? '1px 3px' : '1px 5px', lineHeight: 1.4,
                      }}>{(stock?.risk ?? '').toUpperCase()}</span>
                    )}
                    {last && (
                      <span
                        title={`Last move ${pctBp(last.pct)} · ${PRICE_MOVE_SOURCE_LABEL[last.source]} · round ${last.lap}`}
                        style={{
                          fontFamily: 'IBM Plex Mono, monospace', fontSize: soldOut ? 5.5 : 6, fontWeight: 700,
                          lineHeight: 1, color: lastColor,
                        }}
                      >
                        {last.pct > 0 ? '▲' : '▼'}{Math.abs(last.pct) >= 1 ? Math.round(Math.abs(last.pct)) : Math.abs(last.pct).toFixed(1)}%
                      </span>
                    )}
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

                {/* Weak-demand marker — top-right corner. It used to sit bottom-
                    right, but the bottom row now holds the risk chip AND the last
                    move. Top-right is the Outstanding Shares ("OUT") badge's slot,
                    and the two never coexist: weak-demand markers only count on
                    untouched companies, outstanding shares only exist once sold out. */}
                {!soldOut && weakCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '2%', right: '4%', zIndex: 2,
                    fontSize: 6, fontWeight: 700,
                    background: '#b03a2c', color: '#fbe3dd',
                    borderRadius: 2, padding: '1px 3px', lineHeight: 1,
                  }}>{weakCount}/{WEAK_DEMAND_THRESHOLD}</span>
                )}

                <PlayerTokens players={players} s={s} />
              </div>
            );
          }

          // Special / ETF / corner tile — mirrors makeSpecialLabel in the 3D
          // board. Monopoly keeps every non-property space as line art on
          // cream, so the eight group colours are the only chroma: the same
          // rule here (2026-09-20) leaves these tiles in ink, with the space's
          // own colour kept only for the corners, which are illustrations.
          const def = SPECIAL_3D[sp.n] ?? { color: sp.color ?? '#c9a24f', label: sp.name ?? '', glyph: sp.glyph ?? '' };
          const color = def.corner ? def.color : pal.ink;
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
                : (isCur ? '1px solid #c9a24f' : `1px solid ${pal.edge}`),
              borderRadius: isCorner ? 7 : 4,
              position: 'relative',
              overflow: 'hidden',
              minHeight: 0,
              boxShadow: isCorner
                ? `inset 0 0 16px ${color}22${isCur ? ', 0 0 12px rgba(201,162,79,0.5)' : ''}`
                : isCur ? '0 0 0 1px #c9a24f, 0 0 12px rgba(201,162,79,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}>
              {/* Keyline — colored on corners, routed ink on parchment */}
              <Keyline color={isCorner ? `${color}99` : pal.keyline} inset={isCorner ? '6%' : '5%'} />

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
