import type { Card, Effect, Risk, SectorId } from './types';
import { moveSize } from '../utils/formatMoney';
import { rateShockMoves } from './rates';

const mk = (
  title: string, story: string, effect: string, eff: Card['eff'],
  stance: NonNullable<Card['signal']>['stance'], insight: string,
): Card => ({ deck: 'FED', title, story, effect, eff, signal: { stance, insight } });

const SECTOR_LABEL: Partial<Record<SectorId, string>> = { finance: 'Finance', realestate: 'Real Estate' };
const RISK_LABEL: Record<Risk, string> = { Low: 'Low-Risk', Med: 'Medium-Risk', High: 'High-Risk' };
const upDown = (bp: number) => (bp > 0 ? 'UP' : 'DOWN');

/** A card that changes the Bank Rate. Its price effect is the rate shock that
    change causes, and its text is written from that effect so the two can
    never disagree. */
const rateCard = (
  title: string, story: string, rateBp: number,
  stance: NonNullable<Card['signal']>['stance'], insight: string,
): Card => {
  const moves = rateShockMoves(rateBp);
  const eff: Effect = { k: 'multi', m: moves };
  const parts = [
    `Bank Rate ${upDown(rateBp)} ${moveSize(rateBp)}`,
    ...moves.map((m) => `${m.sec ? SECTOR_LABEL[m.sec] : RISK_LABEL[m.risk!]} ${upDown(m.bp)} ${moveSize(m.bp)}`),
  ];
  return { ...mk(title, story, `${parts.join(' · ')}.`, eff, stance, insight), rateBp };
};

export const FED_CARDS: Card[] = [
  rateCard('Rate Hike', 'The Fed raises rates to fight inflation.', 50, 'hawkish', 'Banks earn more on loans, while property and high-risk growth companies face higher borrowing costs. Every loan in the game now costs more.'),
  rateCard('Rate Cut', 'The Fed lowers rates to support spending.', -50, 'dovish', 'Cheaper borrowing supports property demand and encourages risk-taking, while bank lending margins shrink. Every loan in the game now costs less.'),
  mk('Rate Hold', 'The Fed waits for more data.', 'No price movement this turn.', { k: 'none' }, 'neutral', 'No immediate price change; previous market trends remain in place.'),
  mk('Inflation Warning', 'The Fed signals policy may stay tight.', 'Consumer DOWN 5% (500 bp) · High-Risk DOWN 5% (500 bp).', { k: 'multi', m: [{ sec: 'consumer', bp: -500 }, { risk: 'High', bp: -500 }] }, 'hawkish', 'Persistent inflation pressures consumer spending and speculative companies.'),
  mk('Soft Landing Hopes', 'Investors believe inflation is cooling without recession.', 'All Medium-Risk stocks move UP 5% (500 bp).', { k: 'risk', risk: 'Med', bp: 500 }, 'dovish', 'Confidence improves in balanced companies that offer growth without the highest risk.'),
  rateCard('Tight Money', 'Credit conditions get stricter.', 25, 'hawkish', 'A smaller rate rise: harder financing weighs on property and high-risk growth companies, and loans cost a little more.'),
  rateCard('Easy Money', 'Borrowing conditions improve.', -25, 'dovish', 'A smaller rate cut: easier financing helps property and high-risk growth companies, and loans cost a little less.'),
  mk('Mortgage Pressure', 'Higher borrowing costs hit housing demand and household budgets.', 'Real Estate DOWN 5% (500 bp) · Consumer DOWN 5% (500 bp).', { k: 'multi', m: [{ sec: 'realestate', bp: -500 }, { sec: 'consumer', bp: -500 }] }, 'hawkish', 'Costlier mortgages weaken property demand and leave households with less money to spend.'),
  mk('Bank Margin Boost', 'Lending income improves faster than funding costs.', 'All Finance stocks move UP 5% (500 bp).', { k: 'sector', sec: 'finance', bp: 500 }, 'hawkish', 'Finance companies receive a direct earnings tailwind from stronger lending margins.'),
  mk('Credit Stress', 'Investors worry debt is harder to repay.', 'Finance DOWN 5% (500 bp) · Consumer DOWN 5% (500 bp).', { k: 'multi', m: [{ sec: 'finance', bp: -500 }, { sec: 'consumer', bp: -500 }] }, 'hawkish', 'Repayment concerns hurt lenders and reduce consumers’ ability to spend.'),
  mk('Bond Yields Rise', 'Safer income investments get more attractive.', 'Low-Risk stocks UP 5% (500 bp) · High-Risk stocks DOWN 5% (500 bp).', { k: 'multi', m: [{ risk: 'Low', bp: 500 }, { risk: 'High', bp: -500 }] }, 'hawkish', 'Investors rotate toward dependable income and away from speculative companies.'),
  mk('Cut Hopes Rally', 'Investors expect future cuts and chase growth.', 'Technology UP 5% (500 bp) · Consumer UP 5% (500 bp).', { k: 'multi', m: [{ sec: 'tech', bp: 500 }, { sec: 'consumer', bp: 500 }] }, 'dovish', 'Expected rate relief increases demand for growth and consumer companies.'),
];
