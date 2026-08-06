import { useEffect, useState } from 'react';
import { ETF_BY_CODE, ETF_DEFS, ETF_DIVERSIFICATION_BONUS, FEE_DEBT_INSTALLMENT, PIECE_BY_KEY, SECTORS, STOCK_BY_CODE, calcEtfPayout, hasFullEtfDiversification, isIpoCode } from '../../data';
import {
  completedSectors, diversificationBonus, diversificationTier,
  getBuyingPower, getPlayerNetWorthMovement, getPortfolioRisk, getStockMovementStatus,
  feeDebtBalance, holdingGainLoss, marketGain, marketReturnPct, marketStanceMeta, netWorth, priceOf,
  projectedDividend, stockGainLoss,
  companyLoanBalance, companyMarketTradingOpen, companySharePrice, companySharesHeld, companyPublicSharesHeld, companyPublicSharesRemaining, companyValue,
} from '../../engine';
import { useDispatch, useGameState } from '../../store';

export default function Portfolio() {
  const s = useGameState();
  const dispatch = useDispatch();
  // Any player can view any player's holdings, even when it isn't their turn —
  // defaults to whoever's turn it is, and snaps back there on every new turn.
  const [viewIdx, setViewIdx] = useState(s.cur);
  useEffect(() => setViewIdx(s.cur), [s.cur]);
  const isOwnTurn = viewIdx === s.cur;

  const p = s.players[viewIdx];
  const entries = Object.entries(p.shares).filter(([, n]) => n > 0);
  const etfEntries = Object.entries(p.etfShares).filter(([, n]) => n > 0);
  const nw = netWorth(s, p);
  const gameGain = marketGain(s, p);
  const gameReturn = marketReturnPct(s, p);
  const stockGl = stockGainLoss(s, p);
  const bp = getBuyingPower(viewIdx, s);
  const risk = getPortfolioRisk(viewIdx, s);
  const stance = marketStanceMeta(p.marketStance);
  const nwMv = getPlayerNetWorthMovement(viewIdx, s);
  const nwColor = nwMv.direction === 'up' ? 'var(--green)' : nwMv.direction === 'down' ? 'var(--red)' : 'var(--muted)';
  const nwGlyph = nwMv.direction === 'up' ? '▲' : nwMv.direction === 'down' ? '▼' : '—';
  const nextDividend = projectedDividend(s, p);
  const nextEtfPayout = calcEtfPayout(p.etfShares);
  const fullyDiversifiedEtf = hasFullEtfDiversification(p.etfShares);
  const sectors = completedSectors(p);
  const divTier = diversificationTier(p);
  const divBonus = diversificationBonus(p);
  const feeDebt = feeDebtBalance(p);
  const installment = Math.min(FEE_DEBT_INSTALLMENT, feeDebt);
  const [companyRevealed, setCompanyRevealed] = useState(false);
  const companyLoan = companyLoanBalance(p);
  const companyMarketOpen = companyMarketTradingOpen(s);
  const companyLoanOffer = s.companyLoanOffer?.player === viewIdx ? s.companyLoanOffer.amount : null;
  const companyPublicHeld = companyPublicSharesHeld(s, viewIdx);
  const companyPublicAvailable = companyPublicSharesRemaining(s, viewIdx);
  const ownPublicShares = companySharesHeld(p, viewIdx);

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 12,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderTop: '1px solid var(--border-hi)',
      borderRadius: 12, padding: 14,
      boxShadow: 'var(--panel-shadow)',
    }}>
      {/* Player selector — anyone can peek at any player's holdings, even when
          it isn't their turn. Defaults to (and snaps back to) whoever's turn it is. */}
      {s.players.length > 1 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {s.players.map((pl, i) => {
            const selected = i === viewIdx;
            const emoji = PIECE_BY_KEY[pl.piece]?.emoji ?? '●';
            return (
              <button
                key={i}
                onClick={() => setViewIdx(i)}
                title={pl.name}
                style={{
                  flex: 1, fontSize: 11, padding: '4px 2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  background: selected ? `${pl.color}22` : 'transparent',
                  border: `1px solid ${selected ? pl.color + '77' : 'var(--border)'}`,
                  color: selected ? pl.color : 'var(--muted)',
                  fontWeight: selected ? 700 : 400,
                  borderRadius: 6, cursor: 'pointer',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                <span>{emoji}</span>
                {i === s.cur && <span style={{ fontSize: 8 }}>●</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="slabel" style={{ marginBottom: 3 }}>
            {isOwnTurn ? 'Portfolio' : 'Portfolio · viewing'}
          </span>
          <div className="display" style={{
            fontWeight: 700, fontSize: 16, color: p.color,
            // Dark edge keeps light player colors (gold/teal) legible on parchment
            textShadow: '0 1px 0 rgba(43,32,22,0.55), 0 0 1px rgba(43,32,22,0.7)',
          }}>{p.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 2 }}>
          <span title="Latest qualifying action sets the position for the next Bull or Bear Run" style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
            color: stance.color,
            border: `1px solid ${stance.color}55`,
            background: `${stance.color}14`,
            borderRadius: 4, padding: '3px 8px',
          }}>{stance.glyph} {stance.label}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
            color: risk.color,
            border: `1px solid ${risk.color}45`,
            background: `${risk.color}0f`,
            borderRadius: 4, padding: '3px 8px',
          }}>{risk.badge}</span>
        </div>
      </div>

      {/* Financials block — Cash, Margin Balance, Buying Power = Net Worth */}
      <div style={{
        background: 'var(--sunken)',
        border: '1px solid rgba(74,48,25,0.08)',
        borderRadius: 9, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        <FinRow label="Cash" value={`$${bp.cash.toLocaleString()}`} color="var(--green)" />
        <FinRow label="Margin Balance" value={bp.marginBalance > 0 ? `−$${bp.marginBalance.toLocaleString()}` : '$0'} color={bp.marginBalance > 0 ? 'var(--red)' : 'var(--muted)'} />
        <FinRow label="Outstanding Fees" value={feeDebt > 0 ? `−$${feeDebt.toLocaleString()}` : '$0'} color={feeDebt > 0 ? 'var(--red)' : 'var(--muted)'} />
        <FinRow label="Buying Power" value={`$${bp.buyingPower.toLocaleString()}`} color="var(--accent)" bold />
        <div style={{ height: 1, background: 'rgba(212,165,53,0.12)', margin: '2px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Net Worth</span>
          <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
            ${nw.toLocaleString()}
            <span style={{ fontSize: 10, color: nwColor }}>{nwGlyph}</span>
          </span>
        </div>
        <div style={{ height: 1, background: 'rgba(212,165,53,0.12)', margin: '2px 0' }} />
        <FinRow
          label={s.opts.scoringMode === 'gainLoss' ? 'Market Gain · Winning Score' : 'Market Gain'}
          value={`${signedMoney(gameGain)} (${signedPercent(gameReturn)})`}
          color={gainColor(gameGain)}
          bold={s.opts.scoringMode === 'gainLoss'}
        />
        <FinRow label="Salary Collected · excluded" value={`+$${p.salaryCollected.toLocaleString()}`} color="var(--muted)" />
        <FinRow label="Stock G/L · total" value={signedMoney(stockGl.total)} color={gainColor(stockGl.total)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, fontSize: 9, color: 'var(--muted)' }}>
          <span>Unrealized {signedMoney(stockGl.unrealized)}</span>
          <span>Realized {signedMoney(stockGl.realized)}</span>
        </div>
      </div>

      {s.opts.companiesMode && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '10px 11px', borderRadius: 8,
          background: 'linear-gradient(105deg, rgba(212,165,53,0.10), rgba(74,48,25,0.05))',
          border: '1px solid rgba(212,165,53,0.28)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="slabel">Company Portfolio</span>
            <span style={{ fontSize: 9, color: companyMarketOpen ? 'var(--green)' : 'var(--muted)' }}>
              {companyMarketOpen ? (s.marketHaltUntilLap !== null ? 'MARKET HALTED' : 'MARKET OPEN') : 'OPENS AFTER LAP 1'}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
            <div style={{ color: 'var(--muted)' }}>Company value<div className="mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12 }}>${companyValue(s, viewIdx).toLocaleString()}</div></div>
            <div style={{ color: 'var(--muted)' }}>Founder stake<div className="mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12 }}>60 / 100 shares</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
            <div style={{ color: 'var(--muted)' }}>Public held by players<div className="mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12 }}>{companyPublicHeld} / 40</div></div>
            <div style={{ color: 'var(--muted)' }}>Bank shares available<div className="mono" style={{ color: companyPublicAvailable > 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 700, fontSize: 12 }}>{companyPublicAvailable}</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--muted)' }}>
            <span>{isOwnTurn ? 'Your public shares' : `${p.name}'s public shares`}</span>
            <span className="mono" style={{ color: 'var(--text)', fontWeight: 700 }}>{ownPublicShares} · ${companySharePrice(s, viewIdx)} each</span>
          </div>

          {companyLoan > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--red)' }}>
            <span>Emergency loan −${companyLoan.toLocaleString()}</span>
            {isOwnTurn && <button disabled={p.cash < companyLoan} style={{ marginLeft: 'auto', fontSize: 10, padding: '4px 7px' }} onClick={() => dispatch({ t: 'repayCompanyLoan' })}>Repay</button>}
          </div>}

          {companyLoanOffer !== null && isOwnTurn && <div style={{ padding: 8, borderRadius: 6, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#fca5a5' }}>EMERGENCY LOAN REQUIRED</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Company hit $0. Randomized offer: <b>${companyLoanOffer.toLocaleString()}</b> · 5% interest.</div>
            <button className="danger" style={{ width: '100%', marginTop: 6, fontSize: 10 }} onClick={() => dispatch({ t: 'takeCompanyLoan' })}>Take Loan</button>
          </div>}

          {isOwnTurn && <button
            style={{ fontSize: 10, padding: '5px 8px' }}
            onPointerDown={() => setCompanyRevealed(true)} onPointerUp={() => setCompanyRevealed(false)} onPointerLeave={() => setCompanyRevealed(false)}
          >{companyRevealed ? 'Release to hide company investments' : 'Hold to reveal company investments'}</button>}

          {companyRevealed && isOwnTurn && <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {Object.keys(p.companyHoldings).length === 0 ? 'No public company shares held.' : Object.entries(p.companyHoldings).map(([owner, qty]) => {
              const oi = Number(owner);
              return <div key={owner} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{s.players[oi]?.name}</span><span className="mono">{qty} × ${companySharePrice(s, oi).toLocaleString()}</span></div>;
            })}
          </div>}

          {isOwnTurn && <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
              <span style={{ flex: 1 }}>{p.name} public shares · <span className="mono">${companySharePrice(s, viewIdx)}</span></span>
              <button disabled={!companyMarketOpen || companyPublicAvailable < 1 || p.cash < companySharePrice(s, viewIdx)} style={{ fontSize: 10, padding: '3px 6px' }} onClick={() => dispatch({ t: 'buyCompanyShare', owner: viewIdx })}>Buy More</button>
            </div>
            {s.players.map((owner, oi) => {
              if (oi === viewIdx) return null;
              const held = companySharesHeld(p, oi);
              const price = companySharePrice(s, oi);
              return <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
                <span style={{ flex: 1 }}>{owner.name} · <span className="mono">${price}</span>{companyRevealed && held ? ` · ${held} held` : ''}</span>
                <button disabled={!companyMarketOpen || p.cash < price} style={{ fontSize: 10, padding: '3px 6px' }} onClick={() => dispatch({ t: 'buyCompanyShare', owner: oi })}>Buy</button>
                <button disabled={!companyMarketOpen || held < 1} style={{ fontSize: 10, padding: '3px 6px' }} onClick={() => dispatch({ t: 'sellCompanyShare', owner: oi })}>Sell</button>
              </div>;
            })}
          </div>}
        </div>
      )}

      {feeDebt > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 7,
          padding: '10px 11px', borderRadius: 8,
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', letterSpacing: 0.6 }}>OUTSTANDING FEES</span>
            <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)' }}>−${feeDebt.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
            <span>Unpaid charges ${p.feeDebtPrincipal.toLocaleString()}</span>
            <span>Interest ${p.feeDebtInterest.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>
            Adds 5% at the beginning of this player’s turn, rounded to $100 with a $100 minimum. Already deducted from score.
          </div>
          {isOwnTurn && s.phase === 'play' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ flex: 1, fontSize: 10, padding: '6px 7px' }}
                disabled={p.cash < installment || installment <= 0 || !!s.landingNotice}
                onClick={() => dispatch({ t: 'payFeeDebt', mode: 'installment' })}>
                Pay ${installment.toLocaleString()}
              </button>
              <button className="danger" style={{ flex: 1, fontSize: 10, padding: '6px 7px' }}
                disabled={p.cash < feeDebt || !!s.landingNotice}
                onClick={() => dispatch({ t: 'payFeeDebt', mode: 'full' })}>
                Pay in Full
              </button>
            </div>
          )}
        </div>
      )}

      {/* Projected dividend on next Market Open pass (from current holdings) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '0 2px' }}>
        <span style={{ color: 'var(--muted)' }}>
          Dividends / Market Open
          <span style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.7, marginLeft: 5 }}>next pass</span>
        </span>
        <span className="mono" style={{ color: nextDividend > 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>
          {nextDividend > 0 ? '+' : ''}${nextDividend.toLocaleString()}
        </span>
      </div>

      {/* Projected ETF income — table payout, separate from stock dividends since
          ETFs never had visibility here before. Diversification bonus gets its own
          line once all 4 funds are held. */}
      {etfEntries.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '0 2px' }}>
          <span style={{ color: 'var(--muted)' }}>
            ETF Income / Market Open
            <span style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.7, marginLeft: 5 }}>next pass</span>
          </span>
          <span className="mono" style={{ color: nextEtfPayout > 0 ? 'var(--green)' : 'var(--muted)', fontWeight: 700 }}>
            {nextEtfPayout > 0 ? '+' : ''}${nextEtfPayout.toLocaleString()}
          </span>
        </div>
      )}
      {fullyDiversifiedEtf && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '0 2px' }}>
          <span style={{ color: 'var(--muted)' }}>
            ETF Diversification Bonus
            <span style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.7, marginLeft: 5 }}>all 4 funds · next pass</span>
          </span>
          <span className="mono" style={{ color: 'var(--green)', fontWeight: 700 }}>+${ETF_DIVERSIFICATION_BONUS.toLocaleString()}</span>
        </div>
      )}

      {/* Diversification bonus (Diversified 3+ / Broad Market 6+ distinct sectors) */}
      {divTier !== 'none' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '0 2px' }}>
          <span style={{ color: 'var(--muted)' }}>
            {divTier === 'broad' ? 'Broad Market Portfolio' : 'Diversified Portfolio'}
            <span style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.7, marginLeft: 5 }}>next pass</span>
          </span>
          <span className="mono" style={{ color: 'var(--green)', fontWeight: 700 }}>+${divBonus.toLocaleString()}</span>
        </div>
      )}

      {/* Sector Portfolio badges — completed sector "color groups" */}
      {sectors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="slabel">Sector Portfolio</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {sectors.map((sec) => {
              const def = SECTORS[sec];
              return (
                <span key={sec} style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                  padding: '3px 8px', borderRadius: 5,
                  color: def.color,
                  background: `${def.color}18`,
                  border: `1px solid ${def.color}55`,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{def.glyph}</span>{def.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Holdings */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="slabel">Holdings</span>
          {entries.map(([code, qty]) => {
            const price = priceOf(s, code);
            const total = qty * price;
            const gl = holdingGainLoss(s, p, code);
            const mv = isIpoCode(code) ? null : getStockMovementStatus(code, s);
            const mvColor = mv?.direction === 'up' ? 'var(--green)' : mv?.direction === 'down' ? 'var(--red)' : 'var(--muted)';
            const mvGlyph = mv?.direction === 'up' ? '▲' : mv?.direction === 'down' ? '▼' : '—';
            const sc = STOCK_BY_CODE[code]?.color ?? 'var(--accent)';
            return (
              <div key={code} style={{
                padding: '6px 8px', borderRadius: 6,
                background: `linear-gradient(100deg, ${sc}0d, rgba(74,48,25,0.10))`,
                border: `1px solid ${sc}28`,
                borderLeft: `3px solid ${sc}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: sc }}>{code}</span>
                  <span style={{ fontSize: 10, color: mvColor, fontWeight: 700 }}>{mvGlyph} {mv?.label ?? ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)' }}>{qty}× ${price >= 1000 ? `${price / 1000}k` : price}</span>
                  <span className="mono" style={{ color: 'var(--text)' }}>${total.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginTop: 3 }}>
                  <span style={{ color: 'var(--muted)' }}>Basis ${Math.round(gl.costBasis).toLocaleString()}</span>
                  <span className="mono" style={{ color: gainColor(gl.unrealized), fontWeight: 700 }}>
                    G/L {signedMoney(gl.unrealized)} · {signedPercent(gl.returnPct)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ETF Holdings — previously invisible here entirely. Fixed price (no
          movement arrow), and a lock badge marking them un-sellable / immune to
          forced sale, so the distinction from regular stock holdings is visible. */}
      {etfEntries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="slabel">ETF Holdings</span>
          {etfEntries.map(([code, qty]) => {
            const def = ETF_BY_CODE[code];
            if (!def) return null;
            const total = qty * def.price;
            return (
              <div key={code} style={{
                padding: '6px 8px', borderRadius: 6,
                background: `linear-gradient(100deg, ${def.color}0d, rgba(74,48,25,0.10))`,
                border: `1px solid ${def.color}28`,
                borderLeft: `3px solid ${def.color}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: def.color }}>{def.name}</span>
                  <span title="Fixed price · never force-sold · can't be sold" style={{ fontSize: 10 }}>🔒</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)' }}>{qty}× ${def.price.toLocaleString()} fixed</span>
                  <span className="mono" style={{ color: 'var(--text)' }}>${total.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
          {!fullyDiversifiedEtf && etfEntries.length < ETF_DEFS.length && (
            <div style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.8, padding: '2px 2px 0' }}>
              Hold all 4 funds for +${ETF_DIVERSIFICATION_BONUS.toLocaleString()}/lap.
            </div>
          )}
        </div>
      )}

      {entries.length === 0 && etfEntries.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
          No holdings
        </div>
      )}

      {/* Taxes & Fees — margin calls, Market Open income, Audit Notice, Portfolio Tax, and forced-sale-settled Payout Claim payments */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="slabel">Taxes &amp; Fees</span>
        {s.feeLog.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
            No taxes or fees yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {s.feeLog.map((f, i) => {
              const label = f.kind === 'marginCall' ? 'Margin Call'
                : f.kind === 'audit' ? 'Audit Notice'
                : f.kind === 'tax' ? 'Portfolio Tax'
                : f.kind === 'payout' ? 'Payout Claim'
                : f.kind === 'debt' ? 'Debt Payment'
                : 'Income';
              const amtColor = f.amount >= 0 ? 'var(--green)' : 'var(--red)';
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', borderRadius: 6,
                  background: 'rgba(74,48,25,0.08)',
                  border: '1px solid rgba(74,48,25,0.08)',
                  borderLeft: `3px solid ${f.color}`,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: f.color }}>{f.player}</span>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{label} · Lap {f.lap}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: amtColor }}>
                    {f.amount >= 0 ? '+' : ''}${f.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer actions — repaying margin always acts on whoever's turn it
          actually is, so this is only offered while viewing your own portfolio.
          Also blocked during your own active margin call / insolvency: that forced
          settlement must go through its own panel (payMarginCall/marginSell) —
          spending cash here instead doesn't clear the call, leaving you to raise
          the same amount again. */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isOwnTurn && (s.marginCall?.player === s.cur || s.insolvency?.player === s.cur) ? (
          <div style={{ fontSize: 10, color: 'var(--red)', textAlign: 'center', opacity: 0.9, padding: '4px 0' }}>
            Resolve the forced sale above before repaying margin voluntarily.
          </div>
        ) : isOwnTurn ? (
          <>
            <button onClick={() => dispatch({ t: 'repayMargin' })} disabled={p.margin <= 0} style={{ width: '100%', fontSize: 12 }}>
              Repay Margin $2k
            </button>
            <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', opacity: 0.7 }}>
              Margin available during purchase only · max $4k
            </div>
          </>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', opacity: 0.7, padding: '4px 0' }}>
            Read-only — actions are only available on your own turn.
          </div>
        )}
      </div>
    </div>
  );
}

function signedMoney(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '$0';
  return `${rounded > 0 ? '+' : '−'}$${Math.abs(rounded).toLocaleString()}`;
}

function signedPercent(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

function gainColor(value: number): string {
  return value > 0 ? 'var(--green)' : value < 0 ? 'var(--red)' : 'var(--muted)';
}

function FinRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="mono" style={{ color, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}
