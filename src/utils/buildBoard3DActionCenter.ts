import {
  ETF_BY_CODE, ETF_PRICE, IPO_BY_CODE, LADDER, MARGIN_DEFAULT_PENALTY,
  MARGIN_INCREMENT, MARGIN_MAX, REGULAR_SUPPLY, STOCK_BY_CODE, STOCKS, isIpoCode, stockOpportunityFor,
} from '../data';
import type { GameState } from '../engine';
import {
  bankSellLimit, bankSellRemaining, blocked, canMarketSell, circuitBreakerOptions, getRankedPlayers,
  fedSignalForStock, holdingGainLoss, importantMarketSignals, marketGain, marketStanceMeta,
  playerSignalExposure, priceOf, sellBackPrice, stockGainLoss,
} from '../engine';
import type { ActionCenter3D, ActionPanel3D, Board3DAction } from './sync3dBoard';

function money(value: number): string {
  return `$${value.toLocaleString()}`;
}

function codeName(code: string): string {
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
    rows: importantMarketSignals(s).slice(0, 5).map((signal) => ({
      key: `signal-${signal.id}`,
      title: signal.title,
      detail: signal.summary,
      value: `Lap ${signal.lap}`,
      color: signal.kind === 'fed' ? stanceColor : undefined,
    })),
  };

  if (!gameActive) {
    const scoreLabel = s.opts.scoringMode === 'gainLoss' ? 'Market Gain' : 'Net Worth';
    required.push({
      id: 'game-over', title: 'Market Closed · Final Standings', accent: '#d4a535', urgent: true,
      description: getRankedPlayers(s).map((entry) => `#${entry.rank + 1} ${entry.name} — ${scoreLabel} ${money(entry.score)}`).join(' · '),
      buttons: [button('Set Up a New Game', { t: 'newGame' }, 'gold')],
    });
  }

  if (s.marketOpenWindow) {
    required.push({
      id: 'market-open', title: 'Market Open — Trading Window', accent: '#3ed598', urgent: true,
      description: 'Private trades and the pooled-share auction are open. Close the window when everyone is finished.',
      buttons: [button(s.auction ? 'Resolve Auction First' : 'Close Trading Window →', { t: 'closeMarketOpenWindow' }, 'primary', !!s.auction)],
    });
  }

  if (s.auction) {
    const a = s.auction;
    const actor = s.players[a.actor];
    const minBid = a.highBidder === null ? a.startPrice : a.highBid + 1;
    required.push({
      id: 'auction', title: `Bank Auction · ${a.code}`, accent: '#f0b429', urgent: true,
      description: `${actor.name} must bid or pass. ${a.poolLeft} share${a.poolLeft === 1 ? '' : 's'} remain${a.highBidder === null ? `; opening bid ${money(a.startPrice)}` : `; high bid ${money(a.highBid)} by ${s.players[a.highBidder].name}`}.`,
      numberAction: { label: `Bid · ${actor.name} has ${money(actor.cash)}`, min: minBid, max: actor.cash, step: 100, value: minBid, action: 'auctionBid' },
      buttons: [button('Pass', { t: 'auctionPass' })],
    });
  }

  if (s.marginCall && s.marginCall.player === s.cur) {
    const mc = s.marginCall;
    const rows = Object.entries(current.shares).filter(([, qty]) => qty > 0).map(([code, qty]) => ({
      key: code, title: `${code} · ${codeName(code)}`, detail: `Own ${qty}`,
      value: money(isIpoCode(code) ? priceOf(s, code) : sellBackPrice(s, code)),
      buttons: [button('Sell 1', { t: 'marginSell', code }, 'danger')],
    }));
    required.push({
      id: 'margin-call', title: 'Margin Call', accent: '#ef4444', urgent: true,
      description: `Raise ${money(mc.owed)}, then pay the call plus the ${money(MARGIN_DEFAULT_PENALTY)} penalty. Cash: ${money(current.cash)}.`,
      rows,
      buttons: [button(
        current.cash >= mc.owed ? `Pay Call · ${money(mc.owed + MARGIN_DEFAULT_PENALTY)}` : `Need ${money(mc.owed - Math.max(current.cash, 0))} More`,
        { t: 'payMarginCall' }, 'danger', current.cash < mc.owed,
      )],
    });
  }

  if (s.insolvency) {
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

  if (s.pick) {
    const codes = s.pick.codes ?? STOCKS.map((stock) => stock.code);
    required.push({
      id: 'pick-target', title: s.pick.source === 'investor' ? 'Investor Day' : 'Choose Card Target',
      accent: s.pick.source === 'investor' ? '#c4b5fd' : '#ef4444', urgent: true,
      description: s.pick.label,
      rows: codes.map((code) => ({
        key: code, title: `${code} · ${codeName(code)}`, value: s.pick!.d === 0 ? undefined : money(priceOf(s, code)),
        buttons: [button('Choose', { t: 'pickTarget', code }, 'primary')],
      })),
      buttons: s.pick.source === 'investor' ? undefined : [button('Skip', { t: 'skipPick' })],
    });
  }

  if (s.ipoListPick) {
    required.push({
      id: 'ipo-list', title: 'IPO Market', accent: '#4ade80', urgent: true,
      description: 'Select a listed IPO to buy up to two shares.',
      rows: s.ipos.filter((ipo) => ipo.revealed && ipo.supply > 0).map((ipo) => ({
        key: ipo.code, title: `${ipo.code} · ${IPO_BY_CODE[ipo.code]?.name ?? ipo.code}`,
        detail: `${ipo.supply} available`, value: money(LADDER[ipo.step]),
        buttons: [button('Select', { t: 'pickKnownIpo', code: ipo.code }, 'primary')],
      })),
      buttons: [button('Skip IPO', { t: 'skipIpo' })],
    });
  } else if (s.ipoBuy) {
    const ipo = s.ipos.find((entry) => entry.code === s.ipoBuy!.code);
    const actor = s.players[s.ipoBuy.actor];
    const disabled = s.ipoBuy.bought >= s.ipoBuy.max || (ipo?.supply ?? 0) <= 0 || actor.cash < s.ipoBuy.price;
    required.push({
      id: 'ipo-buy', title: `IPO · ${s.ipoBuy.code}`, accent: '#4ade80', urgent: true,
      description: `${actor.name} is the only buyer. ${s.ipoBuy.bought}/${s.ipoBuy.max} bought at ${money(s.ipoBuy.price)} each; ${(ipo?.supply ?? 0)} remain.`,
      buttons: [button('Buy 1 Share', { t: 'ipoBuyShare' }, 'primary', disabled), button('Done', { t: 'ipoBuyDone' })],
    });
  } else if (s.ipoChoice) {
    required.push({ id: 'ipo-choice', title: 'IPO Market', accent: '#4ade80', urgent: true, buttons: [button('Skip IPO', { t: 'skipIpo' })] });
  }

  if (s.etfPick) {
    const etf = ETF_BY_CODE[s.etfPick];
    if (etf) required.push({
      id: 'etf', title: `${etf.glyph} ${etf.name}`, accent: etf.color, urgent: true,
      description: `${money(ETF_PRICE)} fixed price. ETFs never crash and cannot be sold or force-sold.`,
      buttons: [
        button(`Buy 1 · ${money(ETF_PRICE)}`, { t: 'buyEtf', code: etf.code }, 'primary', current.cash < ETF_PRICE),
        button('Skip', { t: 'skipEtf' }),
      ],
    });
  }

  if (s.shortPick) {
    required.push({
      id: 'short', title: 'Choose Short Position', accent: '#ef4444', urgent: true,
      rows: STOCKS.map((stock) => ({ key: stock.code, title: `${stock.code} · ${stock.name}`, value: money(priceOf(s, stock.code)), buttons: [button('Short', { t: 'doShort', code: stock.code }, 'danger')] })),
      buttons: [button('Skip', { t: 'skipShort' })],
    });
  }

  if (s.trade && s.trade.actionsLeft > 0 && !s.auction && s.pendingDraws.length === 0) {
    const stocks = s.trade.scope === 'stock' && s.trade.code ? [STOCK_BY_CODE[s.trade.code]] : STOCKS;
    required.push({
      id: 'trade-step', title: s.trade.scope === 'stock' ? 'Stock Space' : `Free Trading Day · ${s.trade.actionsLeft} Actions Left`,
      accent: s.trade.scope === 'stock' ? '#d4a535' : '#3ed598',
      description: s.trade.scope === 'stock' ? 'Review the price, dividend, and Fed signal before you decide.' : 'Buy an untouched company or sell owned shares within the half-holding limit per action.',
      rows: stocks.filter(Boolean).map((stock) => {
        const owned = current.shares[stock.code] ?? 0;
        const untouched = (s.supply[stock.code] ?? 0) === REGULAR_SUPPLY;
        const actions = s.trade?.scope === 'stock'
          ? [button(`Buy Company · ${money(stock.buyout)}`, { t: 'buy', code: stock.code }, 'primary', !untouched || current.cash < stock.buyout)]
          : [
              button(`Buy · ${money(stock.buyout)}`, { t: 'buy', code: stock.code }, 'primary', !untouched || current.cash < stock.buyout),
              button(`Sell 1 · ${money(sellBackPrice(s, stock.code))}`, { t: 'sell', code: stock.code }, 'danger', bankSellRemaining(s, stock.code) <= 0),
            ];
        const fed = fedSignalForStock(s, stock.code);
        const opportunity = stockOpportunityFor(stock);
        const leadBenefit = opportunity.dividendPerLap > 0
          ? `Dividend ${money(opportunity.dividendPerLap)}/lap`
          : `Bull Run +${opportunity.bullMove} steps`;
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
      return {
        key: code,
        title: `${code} · ${codeName(code)}`,
        detail: ipo
          ? `IPO · Own ${qty} · Basis ${money(gl.costBasis)} · Unrealized G/L ${money(gl.unrealized)} (${gl.returnPct.toFixed(1)}%)`
          : `Own ${qty} · Basis ${money(gl.costBasis)} · G/L ${money(gl.unrealized)} (${gl.returnPct.toFixed(1)}%) · ${remaining} of ${limit} bank-sale shares left · ${fedSignalForStock(s, code).label}`,
        value: ipo ? `Market ${money(priceOf(s, code))}` : `Sell at ${money(sellBackPrice(s, code))}`,
        buttons: ipo ? undefined : Array.from({ length: limit }, (_, index) => {
          const amount = index + 1;
          return button(`Sell ${amount}`, { t: 'sell', code, qty: amount }, 'danger', !sellable || amount > remaining);
        }),
      };
    });
  const repayAmount = Math.min(MARGIN_INCREMENT, current.margin);
  const marginLocked = !!(s.marginCall?.player === s.cur || s.insolvency?.player === s.cur);
  const purchaseOpen = gameActive && (!!s.trade || s.ipoListPick || !!s.ipoBuy);
  const stockGl = stockGainLoss(s, current);
  const gameGain = marketGain(s, current);
  const portfolio: ActionPanel3D = {
    id: 'portfolio', title: `${currentStance.glyph} ${current.name} · ${currentStance.label} Portfolio`, accent: currentStance.color,
    description: `Cash ${money(current.cash)} · Market Gain ${money(gameGain)} · Stock G/L ${money(stockGl.total)} (unrealized ${money(stockGl.unrealized)}, realized ${money(stockGl.realized)}) · Salary excluded ${money(current.salaryCollected)} · Margin ${money(current.margin)}`,
    rows: holdings,
    buttons: [
      button(`Take Margin +${money(MARGIN_INCREMENT)}`, { t: 'takeMargin' }, 'gold', !s.opts.margin || !purchaseOpen || current.margin + MARGIN_INCREMENT > MARGIN_MAX || !!s.auction),
      button(`Repay Margin ${money(repayAmount || MARGIN_INCREMENT)}`, { t: 'repayMargin' }, 'neutral', !gameActive || current.margin <= 0 || current.cash < repayAmount || marginLocked),
    ],
  };

  const tradePlayers = (gameActive ? s.players : []).map((player, index) => ({
    index, name: player.name, color: player.color, cash: player.cash,
    holdings: Object.entries(player.shares).filter(([, qty]) => qty > 0).map(([code, qty]) => ({ code, name: codeName(code), qty })),
  }));
  const offers = (gameActive ? s.p2pOffers : []).map((offer) => {
    const from = s.players[offer.from];
    const to = s.players[offer.to];
    const buyer = offer.direction === 'sell' ? to : from;
    const seller = offer.direction === 'sell' ? from : to;
    const canAfford = buyer.cash >= offer.price;
    const hasShares = (seller.shares[offer.code] ?? 0) >= offer.qty;
    return {
      id: offer.id,
      summary: `${from.name} offers to ${offer.direction} ${offer.qty}× ${offer.code} ${offer.direction === 'sell' ? 'to' : 'from'} ${to.name} for ${money(offer.price)}`,
      warning: !canAfford ? `${buyer.name} cannot afford the offer.` : !hasShares ? `${seller.name} no longer owns enough shares.` : undefined,
      canAccept: canAfford && hasShares,
    };
  });

  return {
    required,
    marketIntel,
    portfolio,
    tradeDesk: { players: tradePlayers, offers },
    canCallClose: gameActive && !s.closing,
    status: !gameActive ? 'Game over' : s.turnPhase === 'preRoll' ? 'Ready to roll' : blocked(s) ? 'Action required' : s.trade ? 'Landing choice or end turn' : 'Optional actions or end turn',
  };
}
