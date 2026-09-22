import {
  ETF_BY_CODE, ETF_PRICE, FEE_DEBT_INSTALLMENT, IPO_BY_CODE, IPO_PRESENTATION, MARGIN_DEFAULT_PENALTY,
  MARGIN_INCREMENT, MARGIN_MAX, REGULAR_SUPPLY, projectedEtfIncome, SECTORS, SHIELD_COST, STOCK_BY_CODE, STOCKS, UPGRADE_LEVELS,
  developmentRefund, isEtfCode, isIpoCode, stockOpportunityFor, IPO_GROWTH_INVESTMENTS,
} from '../data';
import type { GameState } from '../engine';
import {
  bankSellLimit, bankSellRemaining, blocked, canMarketSell, circuitBreakerOptions, companyBuyoutCost, getRankedPlayers,
  feeDebtBalance, fedSignalForStock, holdingGainLoss, importantMarketSignals, marketGain, marketStanceMeta,
  playerSignalExposure, priceOf, sellBackPrice, stockGainLoss, holdingsReturnPct, marketReturnPct,
  developmentOf, isController, shieldBlockReason, upgradeBlockReason,
  ipoGrowthAtRisk, ipoGrowthBlockReason, ipoPctFromLaunch, nextIpoMilestone, tradableHoldings, heldQty, playerLoanRateText, bankRateBp, marketRateBp, rateSpreadBp,
} from '../engine';
import type { ActionCenter3D, ActionPanel3D, Board3DAction, MarketCondition3D } from './sync3dBoard';
import { marketRegimeInfo } from './marketRegime';
import { moveSize, pct } from './formatMoney';

/** "+12.5% (+1,250 bp) from launch · next: Early Growth +25% pays $250/share". */
function ipoMilestoneText(s: GameState, code: string): string {
  const pctNow = ipoPctFromLaunch(s, code);
  const next = nextIpoMilestone(s, code);
  const from = `${pct(pctNow)} (${Math.round(pctNow * 100).toLocaleString()} bp) from launch`;
  const atRisk = ipoGrowthAtRisk(s, code, s.cur);
  const risk = atRisk > 0 && next ? ` · $${atRisk.toLocaleString()} growth funding repaid if it reaches +${next.pct}%` : '';
  return next ? `${from} · next: ${next.name} +${next.pct}% pays $${next.perShare.toLocaleString()}/share${risk}` : `${from} · all milestones reached`;
}

function money(value: number): string {
  return `$${value.toLocaleString()}`;
}

function codeName(code: string): string {
  if (isEtfCode(code)) return `${ETF_BY_CODE[code]?.name ?? code} (ETF)`;
  return isIpoCode(code) ? (IPO_BY_CODE[code]?.name ?? code) : (STOCK_BY_CODE[code]?.name ?? code);
}

function button(label: string, action: Board3DAction, tone: 'primary' | 'danger' | 'gold' | 'neutral' = 'neutral', disabled = false) {
  return { label, action, tone, disabled };
}

/** Build a presentation-only action model so the 3D page never reimplements game rules. */
export function buildActionCenter(s: GameState): ActionCenter3D {
  const current = s.players[s.cur];
  const currentStance = marketStanceMeta(current.marketStance);
  const required: ActionPanel3D[] = [];
  const gameActive = s.phase === 'play';
  const latestFed = s.marketSignals.find((signal) => signal.kind === 'fed');
  const stanceColor = latestFed?.stance === 'hawkish'
    ? '#ef4444'
    : latestFed?.stance === 'dovish'
      ? '#3ed598'
      : latestFed?.stance === 'mixed'
        ? '#f0b429'
        : '#9aa5b1';
  const marketIntel: ActionPanel3D = {
    id: 'market-intelligence',
    title: latestFed ? `Fed Watch · ${latestFed.title}` : 'Market Intelligence · Waiting on Fed',
    accent: stanceColor,
    description: latestFed
      ? `${(latestFed.stance ?? 'neutral').toUpperCase()} · ${latestFed.summary}${latestFed.insight ? ` What it means: ${latestFed.insight}` : ''} Your exposure: ${playerSignalExposure(s, latestFed)}`
      : 'Fed decisions and the major events worth acting on will stay here. Routine turns stay out of this feed.',
    rows: [{
      key: 'rates',
      title: `Bank Rate ${(bankRateBp(s) / 100).toFixed(2)}% · Market Rate ${(marketRateBp(s) / 100).toFixed(2)}%`,
      detail: `Spread ${rateSpreadBp(s) > 0 ? '+' : ''}${rateSpreadBp(s)} bp. Loans price off the Bank Rate; a positive spread tilts Neutral market moves up.`,
      value: 'RATES',
    }, ...importantMarketSignals(s).slice(0, 5).map((signal) => ({
      key: `signal-${signal.id}`,
      title: signal.title,
      detail: signal.summary,
      value: signal.kind === 'milestone' ? 'MILESTONE' : 'MAJOR',
      color: signal.kind === 'fed' ? stanceColor : undefined,
    }))],
  };

  if (!gameActive) {
    const scoreLabel = s.opts.scoringMode === 'gainLoss' ? 'Market Gain' : 'Net Worth';
    required.push({
      id: 'game-over', title: 'Market Closed · Final Standings', accent: '#d4a535', urgent: true,
      description: getRankedPlayers(s).map((entry) => `#${entry.rank + 1} ${entry.name} — ${scoreLabel} ${money(entry.score)}`).join(' · '),
      buttons: [button('Set Up a New Game', { t: 'newGame' }, 'gold')],
    });
  }

  if (s.landingNotice) {
    const notice = s.landingNotice;
    const canPayNow = current.cash >= notice.amount;
    required.push({
      id: `landing-notice-${notice.kind}`,
      title: `Landing Result · ${notice.title} · −${money(notice.amount)}`,
      accent: '#ef4444',
      urgent: true,
      description: notice.canDefer
        ? `${notice.player}: ${notice.detail} Pay now or carry the full charge as debt; debt adds 5% each turn and lowers final score.`
        : `${notice.player}: ${notice.detail} ${money(notice.paidFromCash)} taken from cash${notice.remaining > 0 ? `; ${money(notice.remaining)} still due.` : '; paid in full.'}`,
      buttons: notice.canDefer
        ? [
            button(canPayNow ? `Pay Now · ${money(notice.amount)}` : `Need ${money(notice.amount - current.cash)} More`, { t: 'payLandingFee' }, 'danger', !canPayNow),
            button('Carry as Debt', { t: 'deferLandingFee' }, 'gold'),
          ]
        : [button(notice.remaining > 0 ? 'Continue to Payment →' : 'Acknowledge', { t: 'ackLandingNotice' }, 'danger')],
    });
  }

  if (s.outstandingBuy && !s.landingNotice && !s.insolvency) {
    const offer = s.outstandingBuy;
    const actor = s.players[offer.actor];
    const available = s.bankPool[offer.code] || 0;
    const affordable = Math.min(available, Math.floor(actor.cash / offer.price));
    required.push({
      id: 'outstanding-shares', title: `Outstanding Shares · ${offer.code}`, accent: '#4da3ff', urgent: true,
      description: `${actor.name} landed here and is the only buyer. ${available} share${available === 1 ? '' : 's'} available at ${money(offer.price)} each; ${offer.bought} bought this landing. Purchases do not move the price.`,
      buttons: [
        button(`Buy 1 · ${money(offer.price)}`, { t: 'buyOutstandingShares', qty: 1 }, 'primary', affordable < 1),
        ...(affordable > 1
          ? [button(`Buy Max (${affordable}) · ${money(affordable * offer.price)}`, { t: 'buyOutstandingShares', qty: affordable }, 'primary')]
          : []),
        button(offer.bought > 0 ? 'Done' : 'Skip Shares', { t: 'outstandingBuyDone' }),
      ],
    });
  }

  if (s.marginCall && s.marginCall.player === s.cur) {
    const mc = s.marginCall;
    const rows = Object.entries(current.shares).filter(([, qty]) => qty > 0).map(([code, qty]) => ({
      key: code, title: `${code} · ${codeName(code)}`, detail: `Own ${qty}`,
      value: money(isIpoCode(code) ? priceOf(s, code) : sellBackPrice(s, code)),
      buttons: [button('Sell 1', { t: 'marginSell', code }, 'danger')],
    }));
    // Parity with MarginCallPanel: once nothing is left to sell the engine
    // settles the call from available cash and carries the rest as Outstanding
    // Fees, so the button must stay enabled — otherwise the turn can never end
    // (see payMarginCall).
    const nothingLeftToSell = rows.length === 0;
    const canPay = current.cash >= mc.owed || nothingLeftToSell;
    const carried = Math.max(0, mc.owed + MARGIN_DEFAULT_PENALTY - Math.max(current.cash, 0));
    required.push({
      id: 'margin-call', title: 'Margin Call', accent: '#ef4444', urgent: true,
      description: nothingLeftToSell && carried > 0
        ? `Nothing left to sell — settle with ${money(Math.max(current.cash, 0))} cash; ${money(carried)} moves to Outstanding Fees.`
        : `Raise ${money(mc.owed)}, then pay the call plus the ${money(MARGIN_DEFAULT_PENALTY)} penalty. Cash: ${money(current.cash)}.`,
      rows,
      buttons: [button(
        nothingLeftToSell && carried > 0
          ? `Settle · ${money(Math.max(current.cash, 0))} + ${money(carried)} debt`
          : canPay ? `Pay Call · ${money(mc.owed + MARGIN_DEFAULT_PENALTY)}` : `Need ${money(mc.owed - Math.max(current.cash, 0))} More`,
        { t: 'payMarginCall' }, 'danger', !canPay,
      )],
    });
  }

  if (s.payoutShortfallChoice && !s.landingNotice) {
    const choice = s.payoutShortfallChoice;
    const debtor = s.players[choice.player];
    const creditor = s.players[choice.creditor];
    const canPayCash = debtor.cash >= choice.owed;
    required.push({
      id: 'payout-shortfall-choice', title: choice.label, accent: '#f0b429', urgent: true,
      description: `${debtor.name} owes ${creditor.name} ${money(choice.owed)}. Pay it now, force-sell regular stock to cover it, or carry it as a loan from ${creditor.name} instead.`,
      buttons: [
        button(canPayCash ? `Pay Now · ${money(choice.owed)}` : `Need ${money(choice.owed - Math.max(debtor.cash, 0))} More`, { t: 'choosePayoutPayCash' }, 'primary', !canPayCash),
        ...(choice.canForceSell ? [button('Force-Sell Stock', { t: 'choosePayoutForceSell' }, 'danger')] : []),
        button(`Ask ${creditor.name} for a Loan`, { t: 'choosePayoutLoan' }, 'neutral'),
      ],
    });
  }

  if (s.loanRatePrompt) {
    const prompt = s.loanRatePrompt;
    const debtor = s.players[prompt.debtor];
    const creditor = s.players[prompt.creditor];
    required.push({
      id: 'loan-rate', title: `${creditor.name} — Roll for Loan Rate`, accent: '#4da3ff', urgent: true,
      description: `${debtor.name} is asking to borrow ${money(prompt.amount)} on their ${prompt.label}. ${playerLoanRateText(s, prompt.debtor)} Unpaid at game end counts against ${debtor.name}'s score and adds to yours.`,
      buttons: [
        button(prompt.code === '' ? 'Lend & Roll for Rate' : 'Roll for Rate', { t: 'rollLoanRate' }, 'primary'),
        ...(prompt.code === '' ? [button('Decline', { t: 'declinePlayerLoan' })] : []),
      ],
    });
  }

  if (s.rateDecisionPrompt) {
    const player = s.players[s.rateDecisionPrompt.player];
    required.push({
      id: 'rate-decision', title: `${player.name} — Roll for the Rate Decision`, accent: '#E8B44C', urgent: true,
      description: `${player.name} landed on Rate Decision. Roll a d6 — 1-2 cuts the Bank Rate 25 bp, 3-4 holds, 5-6 raises it 25 bp. A change moves Finance one way and Real Estate and High-Risk companies the other, and every loan reprices. The Bank Rate is ${bankRateBp(s) / 100}%.`,
      buttons: [button('Roll', { t: 'rollRateDecision' }, 'primary')],
    });
  }

  if (s.regimeRollPrompt) {
    const prompt = s.regimeRollPrompt;
    const player = s.players[prompt.player];
    required.push({
      id: 'regime-roll', title: `${player.name} — Roll for Bull or Bear`, accent: '#a78bfa', urgent: true,
      description: `${player.name} landed on Market Swing. Roll a d6 — 1-3 is a Bear Run, 4-6 is a Bull Run — and the entire market reacts.`,
      buttons: [button('Roll', { t: 'rollRegime' }, 'primary')],
    });
  }

  if (s.insolvency && !s.landingNotice) {
    const iv = s.insolvency;
    const player = s.players[iv.player];
    const rows = Object.entries(player.shares)
      .filter(([code, qty]) => !isIpoCode(code) && qty > 0)
      .map(([code, qty]) => ({
        key: code, title: `${code} · ${codeName(code)}`, detail: `Own ${qty}`, value: money(sellBackPrice(s, code)),
        buttons: [button('Sell 1', { t: 'forcedSell', code }, 'danger')],
      }));
    const canPay = player.cash >= iv.owed || rows.length === 0;
    required.push({
      id: 'insolvency', title: 'Insufficient Funds', accent: '#f0b429', urgent: true,
      description: `${player.name} owes ${money(iv.owed)} for ${iv.label}. Sell regular stock until covered; if none remains, the balance is waived.`,
      rows,
      buttons: [button(player.cash >= iv.owed ? `Pay ${money(iv.owed)}` : 'Pay Available Cash & Waive Rest', { t: 'payInsolvency' }, 'danger', !canPay)],
    });
  }

  if (s.pendingDraws.length > 0) {
    const deck = s.pendingDraws[0];
    const label = deck === 'ME' ? 'Market Event' : 'The Fed';
    required.push({
      id: 'draw', title: `Draw ${label}`, accent: deck === 'ME' ? '#ef4444' : '#d4a535', urgent: true,
      description: `${s.pendingDraws.length} required draw${s.pendingDraws.length === 1 ? '' : 's'} pending.`,
      buttons: [button('Draw Card', { t: 'draw', deck }, 'primary')],
    });
  }

  if (s.circuitBreakerPrompt) {
    const holder = s.players[s.circuitBreakerPrompt.player];
    required.push({
      id: 'circuit-breaker', title: 'Circuit Breaker Decision', accent: '#d4a535', urgent: true,
      description: `${holder.name} may protect one owned company from this entire price drop, or keep the card for later.`,
      rows: circuitBreakerOptions(s).map((code) => ({
        key: code, title: `${code} · ${codeName(code)}`, value: money(priceOf(s, code)),
        buttons: [button(`Protect ${code}`, { t: 'playCircuitBreaker', code }, 'gold')],
      })),
      buttons: [button('Keep Card for Later', { t: 'passCircuitBreaker' })],
    });
  }

  if (s.investorDay) {
    const eligible = s.investorDay.eligibleCodes.length;
    required.push({
      id: 'investor-day', title: 'Investor Day · Choose One', accent: '#c4b5fd', urgent: true,
      description: 'Grow an owned company, or preview the next Market Event without drawing or resolving it.',
      buttons: [
        button(eligible > 0 ? `Company Growth · ${eligible} Eligible` : 'Company Growth · Collect $500', { t: 'chooseInvestorGrowth' }, 'primary'),
        button('Insider Information · Preview Next Event', { t: 'chooseInvestorTip' }, 'gold'),
      ],
    });
  }

  if (s.pick && !s.circuitBreakerPrompt) {
    const codes = s.pick.codes ?? STOCKS.map((stock) => stock.code);
    required.push({
      id: 'pick-target', title: s.pick.source === 'investor' ? 'Investor Day' : 'Choose Card Target',
      accent: s.pick.source === 'investor' ? '#c4b5fd' : '#ef4444', urgent: true,
      description: s.pick.label,
      rows: codes.map((code) => ({
        key: code, title: `${code} · ${codeName(code)}`, value: s.pick!.bp === 0 ? undefined : money(priceOf(s, code)),
        buttons: [button('Choose', { t: 'pickTarget', code }, 'primary')],
      })),
    });
  }

  if (s.ipoListPick) {
    required.push({
      id: 'ipo-list', variant: 'ipo', title: 'THE EXCHANGE · IPO MARKET', accent: '#4ade80', urgent: true,
      description: `${current.name} is the only buyer. Select a live listing and buy its entire remaining offering this landing.`,
      rows: s.ipos.filter((ipo) => ipo.revealed && ipo.supply > 0).map((ipo) => {
        const def = IPO_BY_CODE[ipo.code];
        const presentation = IPO_PRESENTATION[ipo.code];
        const dividend = def.div > 0 ? `${money(def.div)}/share dividend` : 'No dividend';
        return {
          key: ipo.code,
          title: `${presentation.icon} ${ipo.code} · ${def.name}`,
          detail: `${SECTORS[def.sector].name} · ${presentation.volatilityLabel} · ${dividend} · ${ipo.supply} available · “${presentation.flavor}”`,
          value: money(ipo.price),
          color: def.color,
          buttons: [button(`Select ${ipo.code}`, { t: 'pickKnownIpo', code: ipo.code }, 'primary')],
        };
      }),
      buttons: [button('Skip IPO', { t: 'skipIpo' })],
    });
  } else if (s.ipoBuy) {
    const ipo = s.ipos.find((entry) => entry.code === s.ipoBuy!.code);
    const actor = s.players[s.ipoBuy.actor];
    const def = IPO_BY_CODE[s.ipoBuy.code];
    const presentation = IPO_PRESENTATION[s.ipoBuy.code];
    const remaining = Math.min(s.ipoBuy.max - s.ipoBuy.bought, ipo?.supply ?? 0);
    const totalCost = s.ipoBuy.price * remaining;
    const disabled = remaining <= 0 || actor.cash < totalCost;
    required.push({
      id: 'ipo-buy', variant: 'ipo', title: `${presentation.icon} ${s.ipoBuy.code} · ${def.name}`, accent: def.color, urgent: true,
      description: `${SECTORS[def.sector].name.toUpperCase()} · ${presentation.volatilityLabel}. ${actor.name} is the only buyer; ${remaining} shares remain in this first-come offering. ${presentation.flavor}`,
      rows: [
        { key: 'ipo-price', title: 'LIVE IPO PRICE', value: money(s.ipoBuy.price), detail: 'Price is locked for this landing.' },
        { key: 'ipo-dividend', title: `DIVIDEND · ${money(def.div)} / SHARE`, detail: presentation.opportunityText, color: def.color },
        { key: 'ipo-profile', title: presentation.opportunityTitle, detail: `BUY ENTIRE ${remaining}-SHARE OFFERING` },
      ],
      buttons: [button(`Buy Entire Offering · ${money(totalCost)}`, { t: 'ipoBuyShare' }, 'primary', disabled), button('Done', { t: 'ipoBuyDone' })],
    });
  } else if (s.ipoChoice) {
    required.push({ id: 'ipo-choice', variant: 'ipo', title: 'THE EXCHANGE · IPO MARKET', accent: '#4ade80', urgent: true, buttons: [button('Skip IPO', { t: 'skipIpo' })] });
  }

  if (s.etfPick) {
    const etf = ETF_BY_CODE[s.etfPick];
    if (etf) required.push({
      id: 'etf', title: `${etf.glyph} ${etf.name}`, accent: etf.color, urgent: true,
      description: `${money(ETF_PRICE)} fixed price. ETFs never crash and cannot be sold or force-sold. This share adds ${money(projectedEtfIncome({ ...current.etfShares, [etf.code]: (current.etfShares[etf.code] ?? 0) + 1 }) - projectedEtfIncome(current.etfShares))} per Market Open.`,
      buttons: [
        button(`Buy 1 · ${money(ETF_PRICE)}`, { t: 'buyEtf', code: etf.code }, 'primary', current.cash < ETF_PRICE),
        button('Skip', { t: 'skipEtf' }),
      ],
    });
  }


  if (s.trade && s.trade.actionsLeft > 0 && s.pendingDraws.length === 0) {
    const stocks = s.trade.scope === 'stock' && s.trade.code ? [STOCK_BY_CODE[s.trade.code]] : STOCKS;
    required.push({
      id: 'trade-step', title: s.trade.scope === 'stock' ? 'Stock Space' : `Free Trading Day · ${s.trade.actionsLeft} Actions Left`,
      accent: s.trade.scope === 'stock' ? '#d4a535' : '#3ed598',
      description: s.trade.scope === 'stock' ? 'Review the price, dividend, and Fed signal before you decide.' : 'Buy an untouched company or sell owned shares within the half-holding limit per action.',
      rows: stocks.filter(Boolean).map((stock) => {
        const owned = current.shares[stock.code] ?? 0;
        const untouched = (s.supply[stock.code] ?? 0) === REGULAR_SUPPLY;
        const buyoutCost = companyBuyoutCost(s, stock.code);
        const actions = s.trade?.scope === 'stock'
          ? [button(`Buy Company · ${money(buyoutCost)}`, { t: 'buy', code: stock.code }, 'primary', !untouched || current.cash < buyoutCost)]
          : [
              button(`Buy · ${money(buyoutCost)}`, { t: 'buy', code: stock.code }, 'primary', !untouched || current.cash < buyoutCost),
              button(`Sell 1 · ${money(sellBackPrice(s, stock.code))}`, { t: 'sell', code: stock.code }, 'danger', bankSellRemaining(s, stock.code) <= 0),
            ];
        const fed = fedSignalForStock(s, stock.code);
        const opportunity = stockOpportunityFor(stock);
        const leadBenefit = opportunity.dividendPerLap > 0
          ? `Dividend ${money(opportunity.dividendPerLap)}/lap`
          // bullMove is basis points since the percentage redesign; this used to
          // print it as a step count ("Bull Run +2000 steps").
          : `Bull Run +${moveSize(opportunity.bullMove)}`;
        return {
          key: stock.code,
          title: `${stock.code} · ${stock.name}`,
          detail: `Own ${owned} · ${opportunity.title} · ${leadBenefit} · Landing ${money(opportunity.landingPayout)} · ${fed.label}`,
          value: money(priceOf(s, stock.code)),
          buttons: actions,
        };
      }),
      buttons: s.trade.scope === 'stock' && s.trade.code ? [button('Skip Company', { t: 'skipStock', code: s.trade.code })] : undefined,
    });
  }

  const sellable = gameActive && canMarketSell(s);
  const holdings = Object.entries(current.shares)
    .filter(([, qty]) => qty > 0)
    .map(([code, qty]) => {
      const ipo = isIpoCode(code);
      const limit = bankSellLimit(s, code);
      const remaining = bankSellRemaining(s, code);
      const gl = holdingGainLoss(s, current, code);
      // Company development (parity with the 2D Company Development panel):
      // only for regular companies this player controls.
      const controls = s.opts.companyUpgrades && !ipo && gameActive && isController(s, s.cur, code);
      const dev = developmentOf(s, code);
      const devLevel = dev.level === 0 ? null : UPGRADE_LEVELS[dev.level - 1];
      const nextLevel = UPGRADE_LEVELS[dev.level] ?? null;
      const upBlock = controls ? upgradeBlockReason(s, code) : null;
      const shBlock = controls ? shieldBlockReason(s, code) : null;
      const devDetail = controls
        ? ` · ${devLevel ? `Level ${devLevel.numeral} (+${money(devLevel.claimBonus)} claim, +${money(devLevel.marketOpenBonus)} Market Open, declines cut ${devLevel.downsidePct}%)` : 'Base level'}${dev.shieldActive ? ' · 🛡️ shield' : ''}${dev.totalInvested > 0 ? ` · ${money(developmentRefund(dev.totalInvested))} refund if control is lost` : ''}${upBlock && nextLevel ? ` · Upgrade: ${upBlock}` : ''}${shBlock && !dev.shieldActive ? ` · Shield: ${shBlock}` : ''}`
        : '';
      const sellButtons = ipo ? [] : Array.from({ length: limit }, (_, index) => {
        const amount = index + 1;
        return button(`Sell ${amount}`, { t: 'sell', code, qty: amount }, 'danger', !sellable || amount > remaining);
      });
      const devButtons = controls ? [
        ...(nextLevel ? [button(`Upgrade ${nextLevel.numeral} · ${money(nextLevel.cost)}`, { t: 'upgradeCompany', code }, 'gold', !!upBlock)] : []),
        button(`Shield · ${money(SHIELD_COST)}`, { t: 'buyMarketProtection', code }, 'neutral', !!shBlock),
      ] : [];
      return {
        key: code,
        title: `${code}${devLevel ? ` ${devLevel.numeral}` : ''}${dev.shieldActive ? ' 🛡️' : ''} · ${codeName(code)}`,
        detail: ipo
          ? `IPO · Own ${qty} · Basis ${money(gl.costBasis)} · Unrealized G/L ${money(gl.unrealized)} (${gl.returnPct.toFixed(1)}%) · ${ipoMilestoneText(s, code)}${ipoGrowthBlockReason(s, code, 'standard') && gameActive ? ` · Growth: ${ipoGrowthBlockReason(s, code, 'standard')}` : ''}`
          : `Own ${qty} · Basis ${money(gl.costBasis)} · G/L ${money(gl.unrealized)} (${gl.returnPct.toFixed(1)}%) · ${remaining} of ${limit} bank-sale shares left · ${fedSignalForStock(s, code).label}${devDetail}`,
        value: ipo ? `Market ${money(priceOf(s, code))}` : `Sell at ${money(sellBackPrice(s, code))}`,
        buttons: ipo
          ? (gameActive ? (['standard', 'major'] as const).map((size) => button(
            `${IPO_GROWTH_INVESTMENTS[size].label.replace(' Investment', '')} · ${money(IPO_GROWTH_INVESTMENTS[size].cost)}`,
            { t: 'investIpoGrowth', code, size }, 'gold', !!ipoGrowthBlockReason(s, code, size),
          )) : undefined)
          : [...sellButtons, ...devButtons],
      };
    });
  const repayAmount = Math.min(MARGIN_INCREMENT, current.margin);
  const marginLocked = !!(s.marginCall?.player === s.cur || s.insolvency?.player === s.cur);
  const purchaseOpen = gameActive && (!!s.trade || s.ipoListPick || !!s.ipoBuy || !!s.outstandingBuy);
  const stockGl = stockGainLoss(s, current);
  const gameGain = marketGain(s, current);
  const feeDebt = feeDebtBalance(current);
  const feeInstallment = Math.min(FEE_DEBT_INSTALLMENT, feeDebt);
  const portfolio: ActionPanel3D = {
    id: 'portfolio', title: `${currentStance.glyph} ${current.name} · ${currentStance.label} Portfolio`, accent: currentStance.color,
    description: `Cash ${money(current.cash)} · Market Gain ${money(gameGain)} (${pct(marketReturnPct(s, current))}) · Stock G/L ${money(stockGl.total)} (unrealized ${money(stockGl.unrealized)}, realized ${money(stockGl.realized)}) · Holdings Return ${pct(holdingsReturnPct(s, current))} · Salary excluded ${money(current.salaryCollected)} · Margin ${money(current.margin)} · Outstanding Fees ${money(feeDebt)} (principal ${money(current.feeDebtPrincipal)}, interest ${money(current.feeDebtInterest)})`,
    rows: holdings,
    buttons: [
      button(`Take Margin +${money(MARGIN_INCREMENT)}`, { t: 'takeMargin' }, 'gold', !s.opts.margin || !purchaseOpen || current.margin + MARGIN_INCREMENT > MARGIN_MAX),
      button(`Repay Margin ${money(repayAmount || MARGIN_INCREMENT)}`, { t: 'repayMargin' }, 'neutral', !gameActive || current.margin <= 0 || current.cash < repayAmount || marginLocked),
      button(`Pay Fees ${money(feeInstallment || FEE_DEBT_INSTALLMENT)}`, { t: 'payFeeDebt', mode: 'installment' }, 'danger', !gameActive || feeDebt <= 0 || current.cash < feeInstallment || !!s.landingNotice),
      button('Pay Fees in Full', { t: 'payFeeDebt', mode: 'full' }, 'danger', !gameActive || feeDebt <= 0 || current.cash < feeDebt || !!s.landingNotice),
    ],
  };

  const tradePlayers = (gameActive ? s.players : []).map((player, index) => ({
    index, name: player.name, color: player.color, cash: player.cash,
    // Stocks, IPOs, and ETFs — ETFs can't be sold to the bank but can be traded.
    holdings: tradableHoldings(player).map(({ code, qty }) => ({ code, name: codeName(code), qty })),
  }));
  const offers = (gameActive ? s.p2pOffers : []).map((offer) => {
    const from = s.players[offer.from];
    const to = s.players[offer.to];
    const buyer = offer.direction === 'sell' ? to : from;
    const seller = offer.direction === 'sell' ? from : to;
    const hasCounter = !!offer.counterCode && (offer.counterQty ?? 0) > 0;
    const canAfford = buyer.cash >= offer.price;
    const hasShares = heldQty(seller, offer.code) >= offer.qty;
    const hasCounterShares = !hasCounter || heldQty(buyer, offer.counterCode!) >= offer.counterQty!;
    const considerationParts: string[] = [];
    if (offer.price > 0) considerationParts.push(money(offer.price));
    if (hasCounter) considerationParts.push(`${offer.counterQty}× ${offer.counterCode}`);
    const considerationLabel = considerationParts.length > 0 ? considerationParts.join(' + ') : '$0';
    return {
      id: offer.id,
      summary: `${from.name} offers to ${offer.direction} ${offer.qty}× ${offer.code} ${offer.direction === 'sell' ? 'to' : 'from'} ${to.name} for ${considerationLabel}`,
      warning: !canAfford ? `${buyer.name} cannot afford the offer.` : !hasShares ? `${seller.name} no longer owns enough shares.` : !hasCounterShares ? `${buyer.name} no longer owns enough ${offer.counterCode}.` : undefined,
      canAccept: canAfford && hasShares && hasCounterShares,
    };
  });

  const regime = marketRegimeInfo(s.marketRound);
  const marketCondition: MarketCondition3D = {
    enabled: s.opts.roundMarket,
    zone: regime.zone,
    label: regime.label,
    detail: regime.detail,
    color: regime.color,
    glyph: regime.glyph,
    ariaLabel: regime.ariaLabel,
  };

  return {
    required,
    marketIntel,
    marketCondition,
    portfolio,
    tradeDesk: { players: tradePlayers, offers },
    canCallClose: gameActive && !s.closing,
    status: !gameActive ? 'Game over' : s.turnPhase === 'preRoll' ? 'Ready to roll' : blocked(s) ? 'Action required' : s.trade ? 'Landing choice or end turn' : 'Optional actions or end turn',
  };
}
