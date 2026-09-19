import { ETF_BY_CODE, ETF_DEFS, ETF_PRICE, ETF_DIVERSIFICATION_BONUS_BY_FUNDS, distinctEtfFunds, etfDiversificationBonus, projectedEtfIncome, SPACES, STOCK_BY_CODE, PIECE_BY_KEY, MARGIN_DEFAULT_PENALTY, IPO_BY_CODE, MOVE_BP, isIpoCode } from '../../data';
import { gameProgressLabel, minNextBid, priceOf, sellBackPrice } from '../../engine';
import type { Action, GameState, MarketOpenIncome } from '../../engine';
import { useDispatch, useGameState } from '../../store';

export default function ActionPanel() {
  const s = useGameState();
  const dispatch = useDispatch();
  const p = s.players[s.cur];

  // Head of the forced-draw queue — the draw the player must resolve next.
  const nextDraw = s.pendingDraws[0] ?? null;

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Player header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${p.color}ee, ${p.color}77)`,
          boxShadow: `0 0 18px ${p.color}77, 0 0 6px ${p.color}44, inset 0 1px 0 rgba(255,255,255,0.3)`,
          border: '2px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{PIECE_BY_KEY[p.piece]?.emoji ?? '●'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: 'var(--text)' }}>{p.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3, marginTop: 2 }}>
            Space {p.pos}
            {(() => {
              const sp = SPACES[p.pos - 1];
              const label = sp.type === 'stock' ? sp.code : sp.name;
              return label ? <span style={{ color: 'var(--gold)' }}> {label}</span> : null;
            })()}
            {' · '}
            <span className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>${p.cash.toLocaleString()}</span>
            {p.margin > 0 && (
              <span className="mono" style={{ color: 'var(--red)', marginLeft: 6 }}>−${p.margin.toLocaleString()} margin</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.3, marginTop: 2 }}>
            {gameProgressLabel(s)}
          </div>
        </div>
        {s.closing && s.extendedRoundsLeft > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(212,165,53,0.14)', color: 'var(--gold)',
            border: '1px solid rgba(212,165,53,0.3)',
          }}>EXTENDED ROUND</span>
        )}
        {s.closing && s.extendedRoundsLeft === 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(239,68,68,0.12)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.28)',
          }}>FINAL ROUND</span>
        )}
        {!s.closing && s.extendedHoursAvailable && (
          <span title="Extended Hours banked — Market Close will be delayed by 1 round" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(61,213,152,0.12)', color: 'var(--green)',
            border: '1px solid rgba(61,213,152,0.3)',
          }}>⏱ EXTENDED HOURS</span>
        )}
        {s.bonusRollPending && (
          <span title="Resolve this landing, then roll once more" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(212,165,53,0.14)', color: 'var(--gold)',
            border: '1px solid rgba(212,165,53,0.3)',
          }}>🎲 DOUBLES · BONUS ROLL</span>
        )}
        <button
          className="danger"
          style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
          onClick={() => { if (confirm('Call Market Close?')) dispatch({ t: 'callClose' }); }}
          disabled={s.closing}>
          Call Close
        </button>
      </div>

      {s.marketConditions[s.cur] && <MarketConditionPanel s={s} />}

      {/* Cardless financial spaces still need a loud, explicit result. */}
      {s.cyberattackPrompt && s.cyberattackPrompt.player === s.cur && (
        <CyberattackPanel s={s} dispatch={dispatch} />
      )}

      {s.openingBellPrompt && s.openingBellPrompt.player === s.cur && (
        <OpeningBellCardPanel s={s} dispatch={dispatch} />
      )}

      {s.regulatoryInvestigationPrompt && s.regulatoryInvestigationPrompt.player === s.cur && (
        <RegulatoryInvestigationPanel s={s} dispatch={dispatch} />
      )}

      {/* Market Open Report — recap of this lap's trades + current holdings'
          gain/loss, shown where the old Market Open Trading Window was. */}
      {s.marketOpenReport && <MarketOpenReportPanel s={s} dispatch={dispatch} />}

      {/* Sold-back shares can only be bought by landing on that company. */}
      {s.outstandingBuy && !s.landingNotice && !s.insolvency && (
        <OutstandingSharesPanel s={s} dispatch={dispatch} />
      )}

      {/* Bank Auction variant (s.opts.bankAuction) — pooled shares bid out at Market Open */}
      {s.auction && <AuctionPanel s={s} dispatch={dispatch} />}

      {/* Margin call — forced sell-to-cover, blocks the turn until resolved */}
      {s.marginCall && s.marginCall.player === s.cur && (
        <MarginCallPanel s={s} dispatch={dispatch} />
      )}

      {/* Payout Claim shortfall — debtor chooses force-sale or a negotiated loan */}
      {s.payoutShortfallChoice && !s.landingNotice && <PayoutShortfallChoicePanel s={s} dispatch={dispatch} />}

      {/* Creditor picks the 1-5%/turn rate for a newly-negotiated loan */}
      {s.loanRatePrompt && <LoanRatePanel s={s} dispatch={dispatch} />}

      {/* Market Swing landing — roll a d6 to decide Bull Run vs. Bear Run */}
      {s.regimeRollPrompt && <RegimeRollPanel s={s} dispatch={dispatch} />}

      {/* Payout Claim shortfall — forced sale to pay the other player */}
      {s.insolvency && !s.landingNotice && <InsolvencyPanel s={s} dispatch={dispatch} />}

      {/* Pending draw — loud, deck-colored, pulsing banner: the turn cannot
          continue until this button is pressed, so make it impossible to miss. */}
      {nextDraw && <PendingDrawBanner deck={nextDraw} count={s.pendingDraws.length} dispatch={dispatch} />}

      {s.investorDay && <InvestorDayChoicePanel s={s} dispatch={dispatch} />}

      {s.pick?.source === 'investor' && <InvestorDayPanel s={s} dispatch={dispatch} />}

    </div>
  );
}

function MarketConditionPanel({ s }: { s: GameState }) {
  const condition = s.marketConditions[s.cur];
  if (!condition) return null;
  const remainingLabel = condition.durationUnit === 'turns'
    ? `${condition.remaining} of your turn${condition.remaining === 1 ? '' : 's'} left`
    : `${condition.remaining} of your Market Open pass${condition.remaining === 1 ? '' : 'es'} left`;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 11,
      padding: '12px 14px', borderRadius: 9,
      background: `linear-gradient(100deg, ${condition.color}22, ${condition.color}0d)`,
      border: `2px solid ${condition.color}99`,
      boxShadow: `0 2px 14px ${condition.color}33`,
    }}>
      <span style={{ fontSize: 24, lineHeight: 1, color: condition.color, flexShrink: 0 }}>{condition.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: condition.color, fontWeight: 900, letterSpacing: 1.2 }}>YOUR MARKET CONDITION</span>
          <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700 }}>{remainingLabel}</span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 800, marginTop: 2 }}>{condition.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, marginTop: 3 }}>
          {condition.detail}
        </div>
      </div>
    </div>
  );
}

function CyberattackPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const prompt = s.cyberattackPrompt!;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 9,
      padding: '13px 15px', borderRadius: 10,
      background: 'linear-gradient(105deg, rgba(239,68,68,0.20), rgba(239,68,68,0.06))',
      border: '2px solid rgba(239,68,68,0.70)',
      boxShadow: '0 3px 18px rgba(239,68,68,0.14)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: 'var(--red)' }}>⚠ CYBERATTACK · CHOOSE ONE</div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>
        Your portfolio security system has been breached. Protect your cash by dropping one owned holding one price step, or pay <span className="mono" style={{ color: 'var(--red)', fontWeight: 800 }}>${prompt.fee.toLocaleString()}</span>.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {prompt.codes.map((code) => (
          <button key={code} className="danger" style={{ fontSize: 11, padding: '6px 9px' }} onClick={() => dispatch({ t: 'chooseCyberattackStock', code })}>
            {code} ↓1 · ${priceOf(s, code).toLocaleString()}
          </button>
        ))}
        <button style={{ fontSize: 11, padding: '6px 10px', marginLeft: 'auto' }} onClick={() => dispatch({ t: 'payCyberattackFee' })}>
          Pay ${prompt.fee.toLocaleString()}
        </button>
      </div>
    </div>
  );
}

function OpeningBellCardPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const offer = s.openingBellPrompt!;
  const stock = STOCK_BY_CODE[offer.code];
  const canBuy = s.players[s.cur].cash >= offer.price;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '12px 14px', borderRadius: 10,
      background: 'rgba(61,213,152,0.12)', border: '2px solid rgba(61,213,152,0.55)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: 'var(--green)' }}>🔔 OPENING BELL · CARD OPPORTUNITY</div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>
        The card reveals an untouched company: <strong>{stock?.name ?? offer.code} ({offer.code})</strong>. Buy the entire 11-share company at its current market price of <span className="mono" style={{ fontWeight: 800 }}>${offer.price.toLocaleString()}</span>, or pass.
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <button className="primary" disabled={!canBuy} style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => dispatch({ t: 'buyOpeningBell' })}>
          {canBuy ? `Buy ${offer.code}` : 'Not enough cash'}
        </button>
        <button style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => dispatch({ t: 'passOpeningBell' })}>Pass</button>
      </div>
    </div>
  );
}

function RegulatoryInvestigationPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const prompt = s.regulatoryInvestigationPrompt!;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '12px 14px', borderRadius: 10,
      background: 'linear-gradient(105deg, rgba(239,68,68,0.18), rgba(245,158,11,0.08))',
      border: '2px solid rgba(245,158,11,0.70)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: 'var(--yellow)' }}>⚖ REGULATORY INVESTIGATION · CHOOSE ONE</div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>
        Choose a holding to drop 1 price step and lose 50% of its next dividend, or pay <span className="mono" style={{ fontWeight: 800, color: 'var(--yellow)' }}>${prompt.fee.toLocaleString()}</span> to settle the investigation.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {prompt.codes.map((code) => (
          <button key={code} className="danger" style={{ fontSize: 11, padding: '6px 9px' }} onClick={() => dispatch({ t: 'chooseRegulatoryInvestigationStock', code })}>
            {code} ↓1 · −50% next dividend
          </button>
        ))}
        <button style={{ fontSize: 11, padding: '6px 10px', marginLeft: 'auto' }} onClick={() => dispatch({ t: 'payRegulatoryInvestigation' })}>
          Pay ${prompt.fee.toLocaleString()}
        </button>
      </div>
    </div>
  );
}

/** One compact line-item breakdown of everything a Market Open pass paid or
    deducted — salary, dividends, ETFs, bonuses, Recovery Bonus, then any
    margin payment — instead of players having to piece it together from the
    activity log. */
function MarketOpenIncomeSection({ income: inc }: { income: MarketOpenIncome }) {
  const rows: { label: string; amount: number }[] = [
    { label: `Salary${inc.landedExactly ? ' (landed exactly)' : ''}`, amount: inc.salary },
  ];
  if (inc.dividends > 0) {
    rows.push({ label: `Dividends${inc.controllingCodes.length > 0 ? ` (Controller: ${inc.controllingCodes.join(', ')})` : ''}`, amount: inc.dividends });
  }
  if (inc.etfPayout > 0) rows.push({ label: 'ETF Payout', amount: inc.etfPayout });
  if (inc.etfDiversificationBonus > 0) rows.push({ label: 'ETF Diversification (different funds)', amount: inc.etfDiversificationBonus });
  if (inc.conditionDividend > 0) rows.push({ label: inc.conditionTitle ?? 'Dividend Windfall', amount: inc.conditionDividend });
  if (inc.conditionEtf > 0) rows.push({ label: inc.conditionTitle ?? 'ETF Inflows', amount: inc.conditionEtf });
  if (inc.diversificationBonus > 0) {
    rows.push({ label: inc.diversificationTier === 'broad' ? 'Broad Market Bonus' : 'Diversified Bonus', amount: inc.diversificationBonus });
  }
  if (inc.recoveryBonus > 0) rows.push({ label: 'Recovery Bonus (cash was low)', amount: inc.recoveryBonus });
  if (inc.developmentBonus > 0) rows.push({ label: 'Company development bonus', amount: inc.developmentBonus });

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>
        Market Open Income
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: 'var(--text)' }}>{r.label}</span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>+${r.amount.toLocaleString()}</span>
          </div>
        ))}
        <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 3, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ color: 'var(--text)', fontWeight: 800 }}>Total</span>
          <span className="mono" style={{ fontWeight: 800, color: 'var(--green)', flexShrink: 0 }}>+${inc.total.toLocaleString()}</span>
        </div>
        {inc.marginPaid > 0 && (
          <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: 'var(--text)' }}>Margin Repayment</span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>−${inc.marginPaid.toLocaleString()}</span>
          </div>
        )}
        {inc.marginShortfall > 0 && (
          <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>
            Short ${inc.marginShortfall.toLocaleString()} on margin — a forced sale is due.
          </div>
        )}
      </div>
    </div>
  );
}

function MarketOpenReportPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const report = s.marketOpenReport!;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '14px 16px', borderRadius: 10,
      background: 'linear-gradient(105deg, rgba(61,213,152,0.16), rgba(61,213,152,0.05))',
      border: '2px solid rgba(61,213,152,0.55)',
      boxShadow: '0 3px 18px rgba(61,213,152,0.16)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.3, color: 'var(--green)' }}>{report.player}'s Report</span>
        <button style={{ fontSize: 11, padding: '3px 10px', marginLeft: 'auto' }}
          onClick={() => dispatch({ t: 'dismissMarketOpenReport' })}>
          Dismiss
        </button>
      </div>

      <MarketOpenIncomeSection income={report.income} />

      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          This Lap's Trades
        </div>
        {report.trades.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No buys or sells this lap.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {report.trades.map((t, i) => (
              <div key={i} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--text)' }}>{t.text}</span>
                <span className="mono" style={{ fontWeight: 700, color: t.amount >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                  {t.amount >= 0 ? '+' : '−'}${Math.abs(t.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>
          Holdings Gain / Loss
        </div>
        {report.holdings.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No stock holdings.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {report.holdings.map((h) => (
              <div key={h.code} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mono" style={{ color: 'var(--accent)', width: 46, fontWeight: 700 }}>{h.code}</span>
                <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                <span style={{ color: 'var(--muted)', width: 24 }}>×{h.qty}</span>
                <span className="mono" style={{ fontWeight: 700, color: h.unrealized >= 0 ? 'var(--green)' : 'var(--red)', width: 70, textAlign: 'right' }}>
                  {h.unrealized >= 0 ? '+' : '−'}${Math.abs(h.unrealized).toLocaleString()}
                </span>
                <span className="mono" style={{ color: h.unrealized >= 0 ? 'var(--green)' : 'var(--red)', width: 54, textAlign: 'right' }}>
                  ({h.returnPct >= 0 ? '+' : ''}{h.returnPct.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LandingResultBanner({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const notice = s.landingNotice!;
  const needsMore = notice.remaining > 0;
  const canPayNow = s.players[s.cur].cash >= notice.amount;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 10,
      // OPAQUE parchment base. This banner is absolutely positioned over the
      // board art (BoardTrack renders it at top: 38%, right on the mascot), and
      // its body copy is dark ink — a 22%→7% alpha red wash left the detail
      // text painted straight onto the illustration and unreadable. The red
      // tint now sits on top of a solid surface instead of replacing one.
      background: `linear-gradient(105deg, rgba(239,68,68,0.22), rgba(239,68,68,0.07)), var(--surface)`,
      border: '2px solid #ef4444',
      boxShadow: '0 10px 34px rgba(0,0,0,0.5), 0 3px 20px rgba(239,68,68,0.28)',
    }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{notice.kind === 'audit' ? '⚑' : notice.kind === 'tax' ? '$' : notice.kind === 'fund' ? '◆' : '↗'}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', letterSpacing: 1, textTransform: 'uppercase' }}>
          Landing Result · {notice.title}
        </div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: 'var(--red)', marginTop: 3 }}>
          −${notice.amount.toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45, marginTop: 3 }}>
          {notice.player}: {notice.detail}
        </div>
        {notice.canDefer ? (
          <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 4 }}>
            Choose now: pay from cash or carry the full amount as debt. Unpaid debt adds 5% each turn and lowers final score.
          </div>
        ) : (
          <div style={{ fontSize: 11, color: needsMore ? 'var(--yellow)' : 'var(--muted)', marginTop: 4 }}>
            ${notice.paidFromCash.toLocaleString()} taken from cash
            {needsMore ? ` · $${notice.remaining.toLocaleString()} still due — sell regular stock if available` : ' · paid in full'}
          </div>
        )}
      </div>
      {notice.canDefer ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="danger" disabled={!canPayNow}
            style={{ fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}
            onClick={() => dispatch({ t: 'payLandingFee' })}>
            {canPayNow ? `Pay Now · $${notice.amount.toLocaleString()}` : `Need $${(notice.amount - s.players[s.cur].cash).toLocaleString()} More`}
          </button>
          <button style={{ fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}
            onClick={() => dispatch({ t: 'deferLandingFee' })}>
            Carry as Debt
          </button>
        </div>
      ) : (
        <button className="danger" style={{ fontSize: 12, padding: '9px 14px', whiteSpace: 'nowrap' }}
          onClick={() => dispatch({ t: 'ackLandingNotice' })}>
          {needsMore ? 'Continue to Payment →' : 'Acknowledge'}
        </button>
      )}
    </div>
  );
}

// Deck colors/labels mirror the drawn-card display (3D DECK_COLORS)
const DRAW_META: Record<string, { color: string; label: string; icon: string }> = {
  ME:  { color: '#ef4444', label: 'Market Event', icon: '📈' },
  FED: { color: '#d4a535', label: 'Fed',          icon: '🏛️' },
};

function PendingDrawBanner({ deck, count, dispatch }: {
  deck: string; count: number; dispatch: (a: Action) => void;
}) {
  const meta = DRAW_META[deck] ?? { color: '#c9a24f', label: deck, icon: '🃏' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 9,
      background: `linear-gradient(100deg, ${meta.color}26, ${meta.color}0d)`,
      border: `2px solid ${meta.color}`,
      animation: 'drawPulse 1.1s ease-in-out infinite',
      // Deck color drives the pulse glow (referenced by the keyframes)
      ['--pulse' as never]: meta.color,
    }}>
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: meta.color, textTransform: 'uppercase' }}>
          Draw a {meta.label} card
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          Required before your turn continues{count > 1 ? ` · ${count} draws pending` : ''}
        </div>
      </div>
      <button
        style={{
          fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
          padding: '10px 20px', borderRadius: 7, border: 'none',
          background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
          color: '#14100a', cursor: 'pointer', flexShrink: 0,
          boxShadow: `0 2px 14px ${meta.color}66`,
        }}
        onClick={() => dispatch({ t: 'draw', deck: deck as 'ME' | 'FED' })}>
        Draw Card
      </button>
    </div>
  );
}

function InvestorDayChoicePanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const eligible = s.investorDay?.eligibleCodes.length ?? 0;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 9,
      padding: '11px 13px', borderRadius: 8,
      background: 'rgba(167,139,250,0.10)',
      border: '1px solid rgba(167,139,250,0.38)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd', letterSpacing: 0.5 }}>
        ★ INVESTOR DAY · CHOOSE ONE
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>
        Grow an owned company, or use Insider Information to preview the next Market Event without drawing it.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <button className="primary" style={{ fontSize: 11, padding: '7px 11px' }}
          onClick={() => dispatch({ t: 'chooseInvestorGrowth' })}>
          {eligible > 0 ? `Company Growth · ${eligible} eligible` : 'Company Growth · Collect $500'}
        </button>
        <button style={{ fontSize: 11, padding: '7px 11px' }}
          title="See the next Market Event; the card stays on top of the deck"
          onClick={() => dispatch({ t: 'chooseInvestorTip' })}>
          👁 Insider Information
        </button>
      </div>
    </div>
  );
}

function InvestorDayPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const pick = s.pick!;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '11px 13px', borderRadius: 8,
      background: 'rgba(167,139,250,0.10)',
      border: '1px solid rgba(167,139,250,0.38)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd', letterSpacing: 0.5 }}>
        ★ INVESTOR DAY
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{pick.label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(pick.codes ?? []).map((code) => (
          <button key={code}
            style={{ fontSize: 11, padding: '6px 10px' }}
            title={`Grow ${STOCK_BY_CODE[code]?.name ?? code} by ${moveSize(pick.bp)}`}
            onClick={() => dispatch({ t: 'pickTarget', code })}>
            {code} · ${priceOf(s, code).toLocaleString()} →
          </button>
        ))}
      </div>
    </div>
  );
}

function MarginCallPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const mc = s.marginCall!;
  const p = s.players[s.cur];
  const holdings = Object.keys(p.shares)
    .filter((code) => (p.shares[code] ?? 0) > 0)
    .map((code) => ({
      code,
      name: isIpoCode(code) ? (IPO_BY_CODE[code]?.name ?? code) : (STOCK_BY_CODE[code]?.name ?? code),
      qty: p.shares[code],
      // IPO shares sell at market; regular stock sells one step below (rulebook §11).
      price: isIpoCode(code) ? priceOf(s, code) : sellBackPrice(s, code),
    }));
  // With stock still on hand the player must raise the full amount first. Once
  // nothing is sellable the engine settles the call from whatever cash exists
  // and carries the remainder as Outstanding Fees — so the button has to stay
  // live there, or the turn can never end (see payMarginCall).
  const nothingLeftToSell = holdings.length === 0;
  const canPay = p.cash >= mc.owed || nothingLeftToSell;
  const carried = Math.max(0, mc.owed + MARGIN_DEFAULT_PENALTY - Math.max(p.cash, 0));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.45)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--red)' }}>⚠ MARGIN CALL</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
          Cash <span className="mono" style={{ color: p.cash < 0 ? 'var(--red)' : 'var(--text)' }}>${p.cash.toLocaleString()}</span>
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
        Sell stock to raise <span className="mono" style={{ color: 'var(--red)', fontWeight: 700 }}>${mc.owed.toLocaleString()}</span>,
        then pay the call. A flat <span className="mono">${MARGIN_DEFAULT_PENALTY.toLocaleString()}</span> penalty applies.
      </div>

      {holdings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 168, overflowY: 'auto' }}>
          {holdings.map((h) => (
            <div key={h.code} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
              padding: '4px 8px', borderRadius: 5,
              background: 'rgba(74,48,25,0.05)', border: '1px solid rgba(74,48,25,0.07)',
            }}>
              <span className="mono" style={{ color: 'var(--accent)', width: 46 }}>{h.code}</span>
              <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              <span style={{ color: 'var(--muted)', width: 22 }}>×{h.qty}</span>
              <span className="mono" style={{ width: 52, textAlign: 'right' }}>${h.price.toLocaleString()}</span>
              <button style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => dispatch({ t: 'marginSell', code: h.code })}>Sell 1</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
          No stock left to sell — settle with available cash
          {carried > 0 && <> · <span className="mono" style={{ color: 'var(--red)' }}>${carried.toLocaleString()}</span> moves to Outstanding Fees</>}.
        </div>
      )}

      <button
        className="danger"
        style={{ fontSize: 12, padding: '7px 0', fontWeight: 700 }}
        disabled={!canPay}
        onClick={() => dispatch({ t: 'payMarginCall' })}>
        {nothingLeftToSell && carried > 0
          ? `Settle — $${Math.max(p.cash, 0).toLocaleString()} cash + $${carried.toLocaleString()} debt`
          : canPay
            ? `Pay Margin Call — $${(mc.owed + MARGIN_DEFAULT_PENALTY).toLocaleString()}`
            : `Need $${(mc.owed - Math.max(p.cash, 0)).toLocaleString()} more`}
      </button>
    </div>
  );
}

function PayoutShortfallChoicePanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const choice = s.payoutShortfallChoice!;
  const debtor = s.players[choice.player];
  const creditor = s.players[choice.creditor];
  const canPayCash = debtor.cash >= choice.owed;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 9,
      padding: '13px 15px', borderRadius: 10,
      background: 'linear-gradient(105deg, rgba(240,180,41,0.18), rgba(240,180,41,0.06))',
      border: '2px solid rgba(240,180,41,0.65)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: 'var(--yellow)' }}>⚠ {choice.label.toUpperCase()}</div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>
        {debtor.name} owes {creditor.name} <span className="mono" style={{ color: 'var(--yellow)', fontWeight: 800 }}>${choice.owed.toLocaleString()}</span>.
        Pay it now, force-sell regular stock to cover it, or carry it as a loan from {creditor.name} instead.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <button className="primary" disabled={!canPayCash} style={{ fontSize: 11, padding: '7px 11px' }}
          onClick={() => dispatch({ t: 'choosePayoutPayCash' })}>
          {canPayCash ? `Pay Now · $${choice.owed.toLocaleString()}` : `Need $${(choice.owed - Math.max(debtor.cash, 0)).toLocaleString()} More`}
        </button>
        {choice.canForceSell && (
          <button className="danger" style={{ fontSize: 11, padding: '7px 11px' }}
            onClick={() => dispatch({ t: 'choosePayoutForceSell' })}>
            Force-Sell Stock
          </button>
        )}
        <button style={{ fontSize: 11, padding: '7px 11px' }}
          onClick={() => dispatch({ t: 'choosePayoutLoan' })}>
          Ask {creditor.name} for a Loan
        </button>
      </div>
    </div>
  );
}

function LoanRatePanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const prompt = s.loanRatePrompt!;
  const debtor = s.players[prompt.debtor];
  const creditor = s.players[prompt.creditor];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 9,
      padding: '13px 15px', borderRadius: 10,
      background: 'linear-gradient(105deg, rgba(96,165,250,0.18), rgba(96,165,250,0.06))',
      border: '2px solid rgba(96,165,250,0.65)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: 'var(--blue)' }}>💰 {creditor.name} — ROLL FOR LOAN RATE</div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>
        {debtor.name} is asking to borrow <span className="mono" style={{ fontWeight: 800, color: 'var(--blue)' }}>${prompt.amount.toLocaleString()}</span> on their {prompt.label}. Roll a d6 for the interest rate charged per turn — a 6 is capped at 5%. Unpaid at game end counts against {debtor.name}'s score and adds to yours.
      </div>
      <button className="primary" style={{ fontSize: 12, padding: '8px 12px', fontWeight: 800, alignSelf: 'flex-start' }}
        onClick={() => dispatch({ t: 'rollLoanRate' })}>
        🎲 Roll for Rate
      </button>
    </div>
  );
}

function RegimeRollPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const prompt = s.regimeRollPrompt!;
  const player = s.players[prompt.player];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 9,
      padding: '13px 15px', borderRadius: 10,
      background: 'linear-gradient(105deg, rgba(167,139,250,0.18), rgba(167,139,250,0.06))',
      border: '2px solid rgba(167,139,250,0.65)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: '#a78bfa' }}>⚡ {player.name} — ROLL FOR BULL OR BEAR</div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45 }}>
        {player.name} landed on Market Swing. Roll a d6 — 1-3 is a Bear Run, 4-6 is a Bull Run — and the entire market reacts.
      </div>
      <button className="primary" style={{ fontSize: 12, padding: '8px 12px', fontWeight: 800, alignSelf: 'flex-start' }}
        onClick={() => dispatch({ t: 'rollRegime' })}>
        🎲 Roll
      </button>
    </div>
  );
}

function InsolvencyPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const iv = s.insolvency!;
  const p = s.players[iv.player];
  const holdings = Object.keys(p.shares)
    .filter((code) => !isIpoCode(code) && (p.shares[code] ?? 0) > 0)
    // Forced sales pay one step below market (rulebook §11/§17).
    .map((code) => ({ code, name: STOCK_BY_CODE[code]?.name ?? code, qty: p.shares[code], price: sellBackPrice(s, code) }));
  const canSettle = p.cash >= iv.owed || holdings.length === 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(240,180,41,0.10)',
      border: '1px solid rgba(240,180,41,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--yellow)' }}>⚠ INSUFFICIENT FUNDS</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
          Cash <span className="mono" style={{ color: 'var(--text)' }}>${p.cash.toLocaleString()}</span>
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
        {p.name} still owes <span className="mono" style={{ color: 'var(--yellow)', fontWeight: 700 }}>${iv.owed.toLocaleString()}</span> toward {iv.label}.
        Sell regular stock (IPO/ETF holdings can't be force-sold) until it's covered, or run out and the rest is waived.
      </div>

      {holdings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 168, overflowY: 'auto' }}>
          {holdings.map((h) => (
            <div key={h.code} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
              padding: '4px 8px', borderRadius: 5,
              background: 'rgba(74,48,25,0.05)', border: '1px solid rgba(74,48,25,0.07)',
            }}>
              <span className="mono" style={{ color: 'var(--accent)', width: 46 }}>{h.code}</span>
              <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              <span style={{ color: 'var(--muted)', width: 22 }}>×{h.qty}</span>
              <span className="mono" style={{ width: 52, textAlign: 'right' }}>${h.price.toLocaleString()}</span>
              <button style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => dispatch({ t: 'forcedSell', code: h.code })}>Sell 1</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
          No regular stock left to sell — the remaining balance will be waived.
        </div>
      )}

      <button
        className="danger"
        style={{ fontSize: 12, padding: '7px 0', fontWeight: 700 }}
        disabled={!canSettle}
        onClick={() => dispatch({ t: 'payInsolvency' })}>
        {p.cash >= iv.owed
          ? `Pay ${iv.label} — $${iv.owed.toLocaleString()}`
          : holdings.length === 0
          ? `Pay $${Math.max(p.cash, 0).toLocaleString()} & Waive $${(iv.owed - Math.max(p.cash, 0)).toLocaleString()}`
          : `Need $${(iv.owed - Math.max(p.cash, 0)).toLocaleString()} more`}
      </button>
    </div>
  );
}


function OutstandingSharesPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const offer = s.outstandingBuy!;
  const stock = STOCK_BY_CODE[offer.code];
  const actor = s.players[offer.actor];
  const available = s.bankPool[offer.code] || 0;
  const affordable = Math.min(available, Math.floor(actor.cash / offer.price));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(74,163,255,0.10)',
      border: '1px solid rgba(74,163,255,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--blue)' }}>◆ OUTSTANDING SHARES</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: stock?.color ?? 'var(--text)', marginLeft: 2 }}>{offer.code}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{available} available</span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
        <strong style={{ color: actor.color }}>{actor.name}</strong> landed on {stock?.name ?? offer.code} and is the only buyer.
        Buy up to {available} at the current price of <span className="mono" style={{ color: 'var(--blue)', fontWeight: 800 }}>${offer.price.toLocaleString()}</span> each.
        The purchase does not move the market price.
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 6,
        background: `${actor.color}14`, border: `1px solid ${actor.color}55`,
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 35%, ${actor.color}, ${actor.color}88)`,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: actor.color }}>{actor.name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>bought {offer.bought} this landing</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>${actor.cash.toLocaleString()}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button className="primary" style={{ fontSize: 12, padding: '6px 14px' }}
          disabled={affordable < 1}
          onClick={() => dispatch({ t: 'buyOutstandingShares', qty: 1 })}>
          Buy 1 · ${offer.price.toLocaleString()}
        </button>
        {affordable > 1 && (
          <button className="primary" style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => dispatch({ t: 'buyOutstandingShares', qty: affordable })}>
            Buy Max ({affordable}) · ${(affordable * offer.price).toLocaleString()}
          </button>
        )}
        <button style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => dispatch({ t: 'outstandingBuyDone' })}>
          {offer.bought > 0 ? 'Done' : 'Skip Shares'}
        </button>
      </div>
      {affordable < 1 && (
        <div style={{ fontSize: 10, color: 'var(--red)' }}>{actor.name} cannot afford one share. Skip to continue.</div>
      )}
    </div>
  );
}

function AuctionPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const a = s.auction!;
  const stock = STOCK_BY_CODE[a.code];
  const actor = s.players[a.actor];
  const min = minNextBid(s);
  const [bid, setBid] = useState(min);
  useEffect(() => { setBid(min); }, [min, a.code, a.highBid]);
  const canAfford = actor.cash >= min;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(212,165,53,0.10)',
      border: '1px solid rgba(212,165,53,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--gold)' }}>⚖ BANK AUCTION</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: stock?.color ?? 'var(--text)', marginLeft: 2 }}>{a.code}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{a.poolLeft} share{a.poolLeft === 1 ? '' : 's'} left</span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
        {a.highBidder === null
          ? <>Opening bid on {stock?.name ?? a.code} is <span className="mono" style={{ color: 'var(--gold)', fontWeight: 800 }}>${a.startPrice.toLocaleString()}</span> — {moveSize(MOVE_BP.cardStep)} below market.</>
          : <>High bid <span className="mono" style={{ color: 'var(--gold)', fontWeight: 800 }}>${a.highBid.toLocaleString()}</span> by <strong style={{ color: s.players[a.highBidder].color }}>{s.players[a.highBidder].name}</strong>.</>}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 6,
        background: `${actor.color}14`, border: `1px solid ${actor.color}55`,
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 35%, ${actor.color}, ${actor.color}88)`,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: actor.color }}>{actor.name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>to bid or pass</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>${actor.cash.toLocaleString()}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <input
          type="number"
          className="mono"
          min={min}
          step={100}
          value={bid}
          onChange={(e) => setBid(Math.max(min, Number(e.target.value) || min))}
          style={{ width: 96, fontSize: 12, padding: '6px 8px', borderRadius: 6 }}
        />
        <button className="primary" style={{ fontSize: 12, padding: '6px 14px' }}
          disabled={!canAfford || bid < min}
          onClick={() => dispatch({ t: 'auctionBid', amount: bid })}>
          Bid ${bid.toLocaleString()}
        </button>
        <button style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => dispatch({ t: 'auctionPass' })}>
          Pass
        </button>
      </div>
      {!canAfford && (
        <div style={{ fontSize: 10, color: 'var(--red)' }}>{actor.name} can't meet ${min.toLocaleString()} — pass to continue.</div>
      )}
    </div>
  );
}

export function EtfPicker({ code, s, dispatch }: { code: string; s: GameState; dispatch: (a: Action) => void }) {
  const etf = ETF_BY_CODE[code];
  if (!etf) return null;
  const p = s.players[s.cur];
  const ownedHere = p.etfShares[code] ?? 0;
  // What this one share adds per Market Open, from the same function the game
  // pays with — fund distribution plus any diversification-tier step.
  const incomeNow = projectedEtfIncome(p.etfShares);
  const incomeAfter = projectedEtfIncome({ ...p.etfShares, [code]: ownedHere + 1 });
  const addsPerLap = incomeAfter - incomeNow;
  const canAfford = p.cash >= ETF_PRICE;
  // Landing on a fund someone else controls charges a fee AND still offers the
  // share — but the fee is settled first, matching the engine's buyEtf guard.
  const feeFirst = !!s.landingNotice || !!s.insolvency;
  const distinctOwned = distinctEtfFunds(p.etfShares);
  const bonusNow = etfDiversificationBonus(p.etfShares);
  const nextTier = [2, 3, 4].find((n) => n > distinctOwned);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 7,
      background: 'rgba(96,165,250,0.05)',
      border: `1px solid ${etf.color}44`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, color: etf.color }}>{etf.glyph}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: etf.color }}>{etf.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            ${ETF_PRICE.toLocaleString()} · you own {ownedHere} share{ownedHere !== 1 ? 's' : ''} of this fund
            {' · '}{addsPerLap > 0
              ? <>this share adds <strong>+${addsPerLap.toLocaleString()}</strong> per Market Open</>
              : <>this fund already pays its maximum (3+ shares)</>}
          </div>
        </div>
      </div>

      {/* Safe-haven note — what makes ETFs different from stocks */}
      <div style={{
        fontSize: 10, color: 'var(--muted)', lineHeight: 1.5,
        padding: '5px 8px', borderRadius: 5,
        background: 'rgba(74,48,25,0.05)', border: '1px solid rgba(74,48,25,0.08)',
      }}>
        🔒 Fixed price, never crashes · can't be sold or force-sold — a safe, illiquid income asset.
      </div>

      {/* Diversification bonus progress — different funds, not more shares */}
      <div style={{ fontSize: 10, color: bonusNow > 0 ? 'var(--green)' : 'var(--muted)', lineHeight: 1.5 }}>
        {`Different funds held: ${distinctOwned}/${ETF_DEFS.length}`}
        {bonusNow > 0 && ` · earning +$${bonusNow.toLocaleString()}/lap diversification bonus`}
        {nextTier != null && ` · ${nextTier} funds pays +$${ETF_DIVERSIFICATION_BONUS_BY_FUNDS[nextTier].toLocaleString()}/lap`}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={{ fontSize: 12, padding: '5px 14px', color: etf.color, borderColor: `${etf.color}66` }}
          disabled={!canAfford || feeFirst}
          onClick={() => dispatch({ t: 'buyEtf', code })}>
          {feeFirst ? 'Settle the landing fee first'
            : canAfford ? `Buy 1 Share — $${ETF_PRICE.toLocaleString()}` : 'Not enough cash'}
        </button>
        <button style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => dispatch({ t: 'skipEtf' })}>Skip</button>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { moveSize } from '../../utils/formatMoney';
