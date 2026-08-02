import type { Card } from './types';

const mk = (
  title: string, story: string, effect: string, eff: Card['eff'],
  stance: NonNullable<Card['signal']>['stance'], insight: string,
): Card => ({ deck: 'FED', title, story, effect, eff, signal: { stance, insight } });

export const FED_CARDS: Card[] = [
  mk('Rate Hike', 'The Fed raises rates to fight inflation.', 'Finance UP 1 step · Real Estate DOWN 1 step.', { k: 'multi', m: [{ sec: 'finance', d: 1 }, { sec: 'realestate', d: -1 }] }, 'hawkish', 'Banks gain a lending tailwind while property companies face higher borrowing costs.'),
  mk('Rate Cut', 'The Fed lowers rates to support spending.', 'Real Estate UP 1 step · High-Risk UP 1 step.', { k: 'multi', m: [{ sec: 'realestate', d: 1 }, { risk: 'High', d: 1 }] }, 'dovish', 'Cheaper borrowing supports property demand and encourages investors to take more risk.'),
  mk('Rate Hold', 'The Fed waits for more data.', 'No price movement this turn.', { k: 'none' }, 'neutral', 'No immediate price change; previous market trends remain in place.'),
  mk('Inflation Warning', 'The Fed signals policy may stay tight.', 'Consumer DOWN 1 step · High-Risk DOWN 1 step.', { k: 'multi', m: [{ sec: 'consumer', d: -1 }, { risk: 'High', d: -1 }] }, 'hawkish', 'Persistent inflation pressures consumer spending and speculative companies.'),
  mk('Soft Landing Hopes', 'Investors believe inflation is cooling without recession.', 'All Medium-Risk stocks move UP 1 step.', { k: 'risk', risk: 'Med', d: 1 }, 'dovish', 'Confidence improves in balanced companies that offer growth without the highest risk.'),
  mk('Tight Money', 'Credit conditions get stricter.', 'All High-Risk stocks move DOWN 1 step.', { k: 'risk', risk: 'High', d: -1 }, 'hawkish', 'Harder financing creates a headwind for companies that depend on growth and risk appetite.'),
  mk('Easy Money', 'Borrowing conditions improve.', 'All High-Risk stocks move UP 1 step.', { k: 'risk', risk: 'High', d: 1 }, 'dovish', 'Easier financing gives high-risk growth companies a market tailwind.'),
  mk('Mortgage Pressure', 'Higher borrowing costs hit property demand.', 'Real Estate DOWN 1 step · Finance UP 1 step.', { k: 'multi', m: [{ sec: 'realestate', d: -1 }, { sec: 'finance', d: 1 }] }, 'mixed', 'Property demand weakens while lenders can benefit from higher rates.'),
  mk('Bank Margin Boost', 'Lending income improves faster than funding costs.', 'All Finance stocks move UP 1 step.', { k: 'sector', sec: 'finance', d: 1 }, 'hawkish', 'Finance companies receive a direct earnings tailwind from stronger lending margins.'),
  mk('Credit Stress', 'Investors worry debt is harder to repay.', 'Finance DOWN 1 step · Consumer DOWN 1 step.', { k: 'multi', m: [{ sec: 'finance', d: -1 }, { sec: 'consumer', d: -1 }] }, 'hawkish', 'Repayment concerns hurt lenders and reduce consumers’ ability to spend.'),
  mk('Bond Yields Rise', 'Safer income investments get more attractive.', 'All High-Risk stocks move DOWN 1 step.', { k: 'risk', risk: 'High', d: -1 }, 'hawkish', 'Safer yields compete with speculative stocks and reduce demand for high-risk companies.'),
  mk('Risk-On Rally', 'Investors expect future cuts and chase growth.', 'Technology UP 1 step · Consumer UP 1 step.', { k: 'multi', m: [{ sec: 'tech', d: 1 }, { sec: 'consumer', d: 1 }] }, 'dovish', 'Expected rate relief increases demand for growth and consumer companies.'),
];
