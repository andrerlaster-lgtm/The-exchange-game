// Engine state + action types. State is a plain serializable object; the reducer
// produces new state via Immer. No DOM, no React here.

import type { Card, DeckId, Effect, SectorId } from '../data/types';
import type { PriceMoveSource } from '../data/priceModel';

export type Phase = 'setup' | 'orderRoll' | 'play' | 'over';
export type TurnPhase = 'preRoll' | 'acted';
export type LogKind = 'g' | 'r' | 'y' | 'b' | 'n';
export type TradeKind = 'buy' | 'sell' | 'ipo' | 'short' | 'settle' | 'margin' | 'repay' | 'penalty' | 'dividend' | 'p2p' | 'payout';
export type MarketStance = 'bullish' | 'balanced' | 'bearish';
export type MarketConditionId = 'sectorSpotlight' | 'dividendWindfall' | 'etfInflows' | 'creditTightening' | 'weakDemandBargains' | 'riskOff' | 'tollHike';

/** A temporary rule personal to one player (`owner`) — it begins when THEY
    reach Market Open and belongs to them alone; every other player may be
    running their own independent MarketCondition at the same time (see
    GameState.marketConditions, one slot per player, not a single shared
    field). It expires after `remaining` more of the owner's own turns
    (durationUnit 'turns') or the owner's own Market Open passes
    (durationUnit 'rounds'), whichever the condition uses — see
    CONDITION_DURATION in marketConditions.ts. */
export interface MarketCondition {
  id: MarketConditionId;
  title: string;
  detail: string;
  icon: string;
  color: string;
  owner: number;
  lap: number;
  sector?: string;
  durationUnit: 'turns' | 'rounds';
  remaining: number;
}

export interface TradeEntry {
  kind: TradeKind;
  text: string;
  amount: number;   // positive = cash in, negative = cash out
  player: string;
  t: number;        // lap number
}

export interface Player {
  name: string;
  color: string;
  piece: string;                     // piece key (see PIECES in data/pieces.ts)
  cash: number;
  pos: number;                       // board space 1..36
  hasCompletedLap: boolean;          // first-lap grace: landing payments start after passing Start
  shares: Record<string, number>;    // code -> qty (regular + IPO)
  stockCostBasis: Record<string, number>; // code -> total cost basis of shares still held
  realizedStockGain: number;         // cumulative realized gain/loss from sold shares and settled shorts
  etfShares: Record<string, number>; // ETF code -> qty held
  salaryCollected: number;           // base Market Open salary only; excluded from Gain/Loss Mode
  dividendCuts: Record<string, number>; // one-time 50% next-dividend penalties by holding code
  margin: number;                    // total outstanding margin dollars
  bankLoanPrincipal: number;         // cash borrowed from the bank against holdings (2026-09-20)
  bankLoanInterest: number;          // accrued interest on it, at the live Bank Rate
  feeDebtPrincipal: number;          // unpaid Audit Notice / Portfolio Tax charges still outstanding
  feeDebtInterest: number;           // unpaid turn-by-turn interest on those charges
  marketStance: MarketStance;        // latest qualifying market position, resolved by Bull/Bear Run
  prevRank: number | null;           // rank at end of previous turn (null = first turn)
  companyShares: number;             // founder shares retained in their own company (Companies Mode)
  companyHoldings: Record<number, number>; // public shares held in other player companies
  companyLoanPrincipal: number;      // one emergency loan principal (Companies Mode)
  companyLoanInterest: number;       // accrued 5% emergency-loan interest (Companies Mode)
  lapTrades: TradeEntry[];           // this player's trade activity since their last Market Open report
}

/** Every line item paid or deducted by a single payMarketOpen() pass, so the
    report panel can show one compact breakdown instead of players having to
    reconstruct it from the activity log. Zero-value fields are still present
    (the panel decides what's worth a line), except conditionTitle/
    diversificationTier, which are null when nothing of that kind applied. */
export interface MarketOpenIncome {
  salary: number;
  landedExactly: boolean;
  dividends: number;
  controllingCodes: string[];
  etfPayout: number;
  etfDiversificationBonus: number;
  conditionDividend: number;
  conditionEtf: number;
  conditionTitle: string | null;
  diversificationBonus: number;
  diversificationTier: 'diversified' | 'broad' | null;
  recoveryBonus: number;
  developmentBonus: number;          // flat Market Open bonus from companies this player has upgraded
  total: number;
  marginPaid: number;
  marginShortfall: number;
  marginBalanceAfter: number;
}

/** Small recap shown where the Market Open Trading Window used to appear:
    what the player bought/sold since their last lap, how their current
    holdings are doing, and the full income breakdown from this pass. */
export interface MarketOpenReport {
  player: string;
  trades: TradeEntry[];
  holdings: { code: string; name: string; qty: number; unrealized: number; returnPct: number }[];
  income: MarketOpenIncome;
}

export interface CompanyLoanOffer {
  player: number;
  amount: number;
}

export interface IpoState {
  code: string;
  startPrice: number;
  price: number;      // current live price in dollars
  milestonesPaid: number; // how many IPO_MILESTONES have paid out (one-time each)
  growthFunding: Record<number, number>; // player -> growth spending since the last milestone, repaid when the next one is reached
  supply: number;     // shares remaining
  revealed: boolean;
}

/** The most recent price change that actually moved a code, for the board's
    "last move" readout. Recorded in applyPriceMove, so every source is covered. */
export interface LastPriceMove {
  pct: number;              // realized percentage, after the $25 grid and floor
  source: PriceMoveSource;
  lap: number;              // round it happened in
}

/** Per-regular-company development record (2026-09-19 upgrades). `fundedBy`
    and `totalInvested` survive until control loss so the right player is
    refunded even if Payout Claim ownership moves first. */
export interface CompanyDevelopment {
  level: 0 | 1 | 2 | 3;
  shieldActive: boolean;
  fundedBy: number | null;
  totalInvested: number;   // upgrade spending only — shields are not refunded
}

export interface Short {
  owner: number;       // player index
  ownerName: string;
  pcolor: string;
  code: string;
  entryPrice: number;
}

export interface TradeContext {
  scope: 'stock' | 'free';   // stock-space (one code) vs free-trading (any stock)
  code?: string;              // for scope === 'stock'
  actionsLeft: number;        // decrements on each buy/sell; 0 = exhausted
}

export interface IpoBuyContext {
  code: string;
  max: number;
  bought: number;
  price: number;
  actor: number;   // player who landed on the IPO space; always the current player
}

/** Sold-back shares offered only to the player who landed on that company. */
export interface OutstandingBuyContext {
  code: string;
  actor: number;
  price: number;      // current per-share market price, locked for this landing
  available: number;  // shares available when the landing offer opened
  bought: number;
}

export interface PickContext {
  bp: number;   // basis-point move applied to the chosen target
  label: string;
  codes?: string[];   // optional restrict to these codes (UI hint)
  source?: 'card' | 'investor';
  // The Market Event card that opened this pick (source: 'card' only) —
  // captured here, not read back off the mutable s.card, so a later forced
  // draw (e.g. a ceiling-crossing trade queuing another 'ME' draw) can't
  // silently misattribute this pick's eventual signal to a different card.
  card?: Card;
}

/** Investor Day decision before the player chooses the price boost/cash option
    or previews the next Market Event through Insider Information. */
export interface InvestorDayPrompt {
  eligibleCodes: string[];
  // A company the player controls that could take a half-price level, or null
  // when upgrades are off, none is controlled, or the gate is not met.
  upgradeCode: string | null;
}

/** A negative market effect paused before its price movement so the holder can
    play or retain the single Circuit Breaker card. `targetCode` is set once a
    single company is already locked in — for a 'pick' card once the drawing
    player has chosen, or for an automatic 'lowest'/'highest' card once fair
    seeded tie-breaking has already selected it — so Circuit Breaker options
    are exactly that one code, never a stale predicted set. Omitted for
    batch effects (sector/all/risk/multi/regime), whose eligible codes are
    computed fresh from the effect itself. */
export interface CircuitBreakerPrompt {
  player: number;
  effect: Effect;
  targetCode?: string;
  // The Market Event card this prompt paused, captured at prompt-creation
  // time rather than read back off the mutable s.card — see PickContext.card.
  // Undefined for the pre-existing board-space Bull/Bear Run pause, which is
  // not a Card and records its own signal before this pause ever begins.
  card?: Card;
}

export interface LogEntry {
  text: string;
  kind: LogKind;
  t: number;          // lap number
}

/** `regime` is a Bull Run / Bear Run resolution — market-wide risk-tier price
    moves plus stance cash for every player, triggered by rolling on the
    combined Market Swing space (see actionResolver.ts's 'regime'/'rollRegime'
    cases). It is deliberately its own kind, not `market`: it is the one
    signal the persistent Market Condition display does NOT cover (that
    display tracks the Market Meter, a separate mechanic), so it must stay in
    the curated Important Events feed. The meter's own ambient signals stay
    `market` and stay out of that feed, because the display does cover those. */
export type MarketSignalKind = 'fed' | 'market' | 'regime' | 'soldout' | 'claim' | 'weakDemand' | 'strongDemand' | 'ipo' | 'close' | 'milestone';

export interface MarketSignalImpact {
  code: string;
  pct: number;   // realized (or, for a forecast, intended) percentage price move
}

/** Curated, persistent market-moving information. Routine turns and trades stay in Log. */
export interface MarketSignal {
  id: number;
  kind: MarketSignalKind;
  title: string;
  summary: string;
  lap: number;
  stance?: 'hawkish' | 'dovish' | 'neutral' | 'mixed';
  insight?: string;
  impacts: MarketSignalImpact[];
  playerIndex?: number;
  milestone?: number;
}

/** Taxes & Fees panel entry kinds. */
export type FeeEventKind = 'marginCall' | 'income' | 'audit' | 'tax' | 'payout' | 'debt';

/** One Taxes & Fees event: a margin call, Market Open income, Audit Notice,
    Portfolio Tax, or a forced-sale-settled Payout Claim shortfall. */
export interface FeeEventEntry {
  kind: FeeEventKind;
  player: string;
  color: string;
  lap: number;
  amount: number;   // signed: positive for income, negative otherwise
}

/** Active margin call awaiting forced-sell resolution by the current player. */
export interface MarginCall {
  player: number;   // player index who owes the call
  owed: number;     // remaining dollars that must be paid down on margin
}

/** What kind of required payment triggered an Insolvency (Phase 8). */
export type InsolvencyReason = 'payout';

/** Active forced-sale resolution for a Sold-Out Payout Claim owed to another
    player. Audit and Tax shortfalls use Outstanding Fees instead. */
export interface Insolvency {
  player: number;              // player index who owes the payment
  owed: number;                // remaining dollars still needed
  reason: InsolvencyReason;
  payTo: number | null;        // player index to receive the payment; null = paid to the bank
  label: string;                // short human label for UI/log text, e.g. "Portfolio Tax"
}

/** A cardless financial landing result that must be acknowledged so the
    active player cannot miss cash deducted by Audit, Tax, or Payout Claim. */
export interface LandingNotice {
  kind: 'audit' | 'tax' | 'payout' | 'fund';
  title: string;
  player: string;
  amount: number;               // total charge for the landing
  paidFromCash: number;         // amount deducted immediately
  remaining: number;            // unresolved amount subject to forced sale / waiver
  detail: string;               // human-readable rule explanation
  canDefer: boolean;            // Audit/Tax may be paid now or carried as score-reducing debt
  payTo?: number | null;        // fund owner who receives a payment, when applicable
}

/** Active Cyberattack card choice: price hit on one holding or a portfolio fee. */
export interface CyberattackPrompt {
  player: number;
  fee: number;
  codes: string[];
}

export interface OpeningBellPrompt {
  player: number;
  code: string;
  price: number;
}

export interface RegulatoryInvestigationPrompt {
  player: number;
  fee: number;
  codes: string[];
}

/** A negotiated player-to-player loan, created when a landing player can't
    fully cover a Payout Claim in cash and chooses to defer the shortfall
    instead of force-selling stock. The creditor picks the per-turn rate. */
export interface PlayerDebt {
  id: number;
  debtor: number;     // player index who owes
  creditor: number;   // player index who is owed
  code: string;        // originating stock, for context/log
  principal: number;
  interest: number;
  rate: number;         // percent per turn, fixed when the loan was made: Bank Rate + the creditor's rolled premium
}

/** Presented to the debtor immediately after a Payout Claim shortfall: force-
    sell stock (existing behavior) or negotiate a loan with the creditor. */
export interface PayoutShortfallChoice {
  player: number;       // debtor
  creditor: number;
  code: string;
  owed: number;          // remaining shortfall after the cash portion is paid
  label: string;
  canForceSell: boolean; // false when the debtor has no regular stock left to sell
}

/** Presented to the creditor after the debtor chooses to negotiate a loan:
    roll the premium over the Bank Rate that creates the PlayerDebt record. */
export interface LoanRatePrompt {
  debtor: number;
  creditor: number;
  code: string;
  amount: number;
  label: string;
}

/** Most recent card draw / IPO reveal — seq is unique per draw so views can
    animate exactly once per event. */
export interface DrawEvent {
  deck: string;     // 'ME' | 'FED' | 'IPO'
  title: string;    // drawn card title or launched IPO name
  seq: number;      // monotonically increasing per draw
}

/** One regular stock's Sold-Out / Payout-Claim record. Created on the buy that
    first exhausts supply; never removed (Sold-Out is permanent). */
export interface SoldOutInfo {
  code: string;
  claimHolder: number | null; // player index of the sole top owner; null = Contested (tie) / nobody
}

/** Active Bank Auction of one stock's pooled shares, held at Market Open.
    Ascending, turn-order bidding: each active player may raise or pass; the last
    remaining bidder wins one share. Payout Claim is frozen until the stock's
    auction fully closes (rulebook §10). */
export interface Auction {
  code: string;
  poolLeft: number;          // shares from the bank pool still to be auctioned
  startPrice: number;        // minimum first bid — one step below market
  highBid: number;           // current high bid in dollars; 0 = no bid yet
  highBidder: number | null; // player index of the current high bidder
  actor: number;             // player index whose turn it is to bid or pass
  active: number[];          // player indices still competing for the current lot
}

/**
 * A negotiated player-to-player trade offer. Never involves ETFs, never moves
 * the market ladder or the bank's supply pool — shares and cash transfer
 * directly between the two named players. The paying side (whoever isn't
 * giving up `code`/`qty`) settles with cash (`price`), shares of a second
 * company (`counterCode`/`counterQty`), or both at once.
 */
export interface P2POffer {
  id: number;
  from: number;                 // proposing player index
  to: number;                   // counterparty player index
  code: string;                 // regular stock, IPO, or ETF code
  qty: number;                  // shares changing hands
  direction: 'sell' | 'buy';    // from the proposer's perspective
  price: number;                // cash the paying side hands over (can be 0)
  counterCode?: string;         // shares the paying side hands over instead of/alongside cash
  counterQty?: number;
}

export interface GameOptions {
  startCash: number;          // starting cash per player
  scoringMode: 'netWorth' | 'gainLoss';
  margin: boolean;            // margin trading allowed
  shorts: boolean;            // short selling allowed
  ipos: boolean;              // IPO spaces active
  closeMode: 'card' | 'rounds';
  closeRounds: number;        // rounds if closeMode === 'rounds' (ignored otherwise)
  roundMarket: boolean;       // the once-per-round market resolution (2026-09-19 round-end market rules)
  companiesMode: boolean;     // optional player-owned company market
  companyUpgrades: boolean;   // Company Development (Levels I-III + Market Protection) — standard rule, on by default
  bankLoans: boolean;         // borrowing from the bank, and lending player to player, at the Bank Rate
  bankAuction: boolean;       // alternate resale mode: pooled shares go to a turn-order
                               // Market Open auction instead of the standard-mode Outstanding
                               // Shares offer (buy-on-landing) — off by default
}

export const DEFAULT_OPTIONS: GameOptions = {
  startCash: 35_000,
  scoringMode: 'netWorth',
  margin: false, // advanced-mode toggle — off by default in standard mode (rulebook §21)
  shorts: false, // Short Sell is off / removed from standard game flow (rulebook §21)
  ipos: true,
  closeMode: 'card',
  closeRounds: 5,
  roundMarket: true, // core rule: the market moves once per completed round, never off a dice roll
  companiesMode: false,
  bankAuction: false, // standard mode uses Outstanding Shares (rulebook §11); this is the variant
  // Standard rule as of 2026-09-19, like IPOs: on unless a table turns it
  // off. It was off by default while the percentage market was played on its
  // own and the upgrade economics were being tuned.
  companyUpgrades: true,
  bankLoans: true,
};

/**
 * Pre-game "roll for order" ceremony. `rolls[i]` is player i's (2d6) roll
 * for the round currently in progress, null until they've rolled. `pending`
 * holds the players still due to roll this round, front-first; when it
 * empties, ties (equal values shared by 2+ players) are detected and those
 * players' rolls are reset and requeued into `pending` for another round.
 * Once a round empties with no ties, `pending` stays empty and the ceremony
 * is ready to finish.
 */
export interface OrderRollState {
  rolls: (number | null)[];
  pending: number[];
}

export interface GameState {
  phase: Phase;
  numPlayers: number;
  names: string[];
  pieces: string[];                    // selected piece key per player slot
  players: Player[];
  orderRoll: OrderRollState | null;    // active only while phase === 'orderRoll'
  cur: number;                         // current player index
  turnPhase: TurnPhase;
  dice: [number | null, number | null];
  rolling: boolean;
  bonusRollPending: boolean;           // current landing came from doubles and earns one more roll
  bonusRollUsed: boolean;              // current player already used the turn's one allowed bonus roll
  prices: Record<string, number>;      // regular stock code -> live share price in dollars
  supply: Record<string, number>;      // regular stock code -> shares remaining
  skips: Record<string, number>;       // code -> weak-demand marker count (0-3), untouched companies only
  demand: Record<string, number>;      // code -> strong-demand marker count (0-3), sold-out companies only
  soldOut: Record<string, SoldOutInfo>; // presence of key ⇔ stock is permanently sold out
  bankPool: Record<string, number>;    // outstanding sold-back shares, purchasable only by landing on that stock
  bankSoldThisTurn: Record<string, number>; // regular shares sold to the bank by the current player this turn
  auction: Auction | null;             // legacy inactive auction state retained for old-session compatibility
  auctionQueue: string[];              // legacy inactive queue retained for old-session compatibility
  marketOpenReport: MarketOpenReport | null; // recap shown after a player completes a lap; clears on their next turn
  marketConditions: (MarketCondition | null)[]; // per-player slot, indexed like players — personal, never shared
  lap: number;
  log: LogEntry[];
  marketSignals: MarketSignal[];
  marketSignalSeq: number;
  portfolioMilestones: Record<number, number>; // highest $100k net-worth milestone reached per player
  tradeLog: TradeEntry[];
  trade: TradeContext | null;
  pendingDraws: DeckId[];              // ordered queue of forced draws, resolved one at a time
  card: Card | null;                   // most recently drawn card (display)
  cardPreviewMode: 'insider' | null;   // card is only a peek; it remains on top of the ME deck
  pick: PickContext | null;
  investorDay: InvestorDayPrompt | null;
  shortPick: boolean;
  ipos: IpoState[];
  ipoChoice: boolean;
  ipoListPick: boolean;
  ipoBuy: IpoBuyContext | null;
  outstandingBuy: OutstandingBuyContext | null;
  decks: Record<DeckId, number[]>;     // shuffled index queues
  discard: Record<DeckId, number[]>;
  shorts: Short[];
  closing: boolean;
  closeDrawer: number | null;
  extendedHoursAvailable: boolean; // an Extended Hours card was drawn and hasn't been consumed yet
  extendedRoundsLeft: number;      // rounds still owed before Market Close actually ends the game
  circuitBreakerHolder: number | null; // player holding the single Circuit Breaker card outside its deck
  circuitBreakerPrompt: CircuitBreakerPrompt | null; // pending play/pass response to a negative market effect
  testMode: boolean;
  opts: GameOptions;
  etfPick: string | null;   // ETF code player landed on, awaiting buy/skip
  marginCall: MarginCall | null; // active forced-sell margin call, if any
  insolvency: Insolvency | null; // active Payout Claim forced-sale resolution, if any
  landingNotice: LandingNotice | null; // visible acknowledgement for cardless financial landing results
  cyberattackPrompt: CyberattackPrompt | null;
  openingBellPrompt: OpeningBellPrompt | null;
  regulatoryInvestigationPrompt: RegulatoryInvestigationPrompt | null;
  payoutShortfallChoice: PayoutShortfallChoice | null; // debtor choice: force-sell vs. negotiate a loan
  loanRatePrompt: LoanRatePrompt | null;               // creditor's pending loan-premium roll
  lastMove: Record<string, LastPriceMove>;          // code -> the most recent real price change (board tiles)
  development: Record<string, CompanyDevelopment>;    // regular stock code -> upgrade level, shield, funder
  upgradedThisTurn: boolean;
  ipoGrowthThisTurn: boolean;                        // one IPO growth investment per player turn
  ipoBoughtThisTurn: string[];                       // IPO codes the current player bought shares of this turn
  ipoSharesAtTurnStart: Record<number, Record<string, number>>; // player -> IPO code -> shares held when this turn began (milestone eligibility)                          // one permanent upgrade per player turn (survives doubles re-rolls)
  rateDecisionPrompt: { player: number } | null;    // pending d6 roll on the Rate Decision space (board 28)
  regimeRollPrompt: { player: number } | null;         // pending d6 roll on the combined Market Swing space to decide Bull vs. Bear
  playerDebts: PlayerDebt[];                            // active negotiated Payout Claim loans
  playerDebtSeq: number;                                // id source for playerDebts
  feeLog: FeeEventEntry[];           // Taxes & Fees panel: margin calls, income, audit notices (most recent first)
  lastDraw: DrawEvent | null;        // most recent card draw / IPO reveal (for draw animations)
  p2pOffers: P2POffer[];             // pending player-to-player trade offers
  p2pSeq: number;                    // monotonically increasing id source for p2pOffers
  // Result of the last completed round's market resolution — the visible
  // Bull/Bear marker. Null until the first round ends.
  marketRound: {
    direction: 'bull' | 'bear' | 'flat';
    bloc: string | null;            // the market bloc the sector die picked
    sectors: SectorId[];            // the sectors in it that moved
    bp: number;
    sectorTotal: number;            // the round's first-dice total
    moveAvg: number | null;         // the round's second-die average
    lap: number;
  } | null;
  // Running tally of this round's movement rolls: the first die feeds the
  // sector, the second the move. Read once when the round closes, then reset.
  roundDice: { aSum: number; bSum: number; rolls: number };
  bankRateBp: number;                // Bank Rate in bp per turn (data/rates.ts); Fed cards move it, loans price off it
  companyMarketOpen: boolean;         // opens after the first lap in Companies Mode
  marketHeat: number;                 // doubles-based shared Market Heat meter (0-3)
  marketHaltUntilLap: number | null; // trading is paused until this lap
  companyLoanOffer: CompanyLoanOffer | null;
}

// Actions the reducer accepts. Kept explicit for testability.
export type Action =
  | { t: 'setNum'; n: number }
  | { t: 'setName'; i: number; name: string }
  | { t: 'setPiece'; i: number; piece: string }
  | { t: 'setOpt'; opt: Partial<GameOptions> }
  | { t: 'startGame' }
  | { t: 'rollForOrder' }
  | { t: 'finishOrderRoll' }
  | { t: 'newGame' }
  | { t: 'toggleTest' }
  | { t: 'roll' }                      // rolls dice + resolves move + landing
  | { t: 'buy'; code: string }             // all-or-nothing: buys out the whole 11-share company
  | { t: 'sell'; code: string; qty?: number }
  | { t: 'buyCompanyShare'; owner: number }
  | { t: 'sellCompanyShare'; owner: number }
  | { t: 'takeCompanyLoan' }
  | { t: 'repayCompanyLoan' }
  | { t: 'skipStock'; code: string }
  | { t: 'takeMargin' }
  | { t: 'takeBankLoan'; amount: number }
  | { t: 'payBankLoan'; mode: 'installment' | 'full' }
  | { t: 'requestPlayerLoan'; from: number; to: number; amount: number }
  | { t: 'declinePlayerLoan' }
  | { t: 'repayMargin' }
  | { t: 'marginSell'; code: string }
  | { t: 'payMarginCall' }
  | { t: 'forcedSell'; code: string }
  | { t: 'payInsolvency' }
  | { t: 'ackLandingNotice' }
  | { t: 'payLandingFee' }
  | { t: 'deferLandingFee' }
  | { t: 'chooseCyberattackStock'; code: string }
  | { t: 'payCyberattackFee' }
  | { t: 'buyOpeningBell' }
  | { t: 'passOpeningBell' }
  | { t: 'chooseRegulatoryInvestigationStock'; code: string }
  | { t: 'payRegulatoryInvestigation' }
  | { t: 'choosePayoutPayCash' }
  | { t: 'choosePayoutForceSell' }
  | { t: 'choosePayoutLoan' }
  | { t: 'rollLoanRate' }
  | { t: 'rollRegime' }
  | { t: 'rollRateDecision' }
  | { t: 'upgradeCompany'; code: string }
  | { t: 'buyMarketProtection'; code: string }
  | { t: 'investIpoGrowth'; code: string; size: 'standard' | 'major' }
  | { t: 'dismissMarketOpenReport' }
  | { t: 'payPlayerDebt'; debtId: number; mode: 'installment' | 'full' }
  | { t: 'payFeeDebt'; mode: 'installment' | 'full' }
  | { t: 'doShort'; code: string }
  | { t: 'skipShort' }
  | { t: 'pickKnownIpo'; code: string }
  | { t: 'ipoBuyShare' }
  | { t: 'ipoBuyDone' }
  | { t: 'buyOutstandingShares'; qty: number }
  | { t: 'outstandingBuyDone' }
  | { t: 'skipIpo' }
  | { t: 'draw'; deck: DeckId }
  | { t: 'chooseInvestorGrowth' }
  | { t: 'chooseInvestorTip' }
  | { t: 'chooseInvestorUpgrade' }
  | { t: 'pickTarget'; code: string }
  | { t: 'skipPick' }
  | { t: 'playCircuitBreaker'; code: string }
  | { t: 'passCircuitBreaker' }
  | { t: 'callClose' }
  | { t: 'buyEtf'; code: string }
  | { t: 'skipEtf' }
  | { t: 'proposeP2POffer'; from: number; to: number; code: string; qty: number; direction: 'sell' | 'buy'; price: number; counterCode?: string; counterQty?: number }
  | { t: 'acceptP2POffer'; id: number }
  | { t: 'declineP2POffer'; id: number }
  | { t: 'cancelP2POffer'; id: number }
  | { t: 'auctionBid'; amount: number }
  | { t: 'auctionPass' }
  | { t: 'endTurn' };
