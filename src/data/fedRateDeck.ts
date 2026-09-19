import type { Card } from './types';

const mk = (
  title: string, story: string, effect: string, eff: Card['eff'],
  stance: NonNullable<Card['signal']>['stance'], insight: string,
): Card => ({ deck: 'FED', title, story, effect, eff, signal: { stance, insight } });

export const FED_CARDS: Card[] = [
  mk('Rate Hike', 'The Fed raises rates to fight inflation.', 'Finance UP 1 step · Real Estate DOWN 1 step.', { k: 'multi', m: [{ sec: 'finance', bp: 500 }, { sec: 'realestate', bp: -500 }] }, 'hawkish', 'Banks gain a lending tailwind while property companies face higher borrowing costs.'),
  mk('Rate Cut', 'The Fed lowers rates to support spending.', 'Real Estate UP 1 step · High-Risk UP 1 step.', { k: 'multi', m: [{ sec: 'realestate', bp: 500 }, { risk: 'High', bp: 500 }] }, 'dovish', 'Cheaper borrowing supports property demand and encourages investors to take more risk.'),
  mk('Rate Hold', 'The Fed waits for more data.', 'No price movement this turn.', { k: 'none' }, 'neutral', 'No immediate price change; previous market trends remain in place.'),
  mk('Inflation Warning', 'The Fed signals policy may stay tight.', 'Consumer DOWN 1 step · High-Risk DOWN 1 step.', { k: 'multi', m: [{ sec: 'consumer', bp: -500 }, { risk: 'High', bp: -500 }] }, 'hawkish', 'Persistent inflation pressures consumer spending and speculative companies.'),
  mk('Soft Landing Hopes', 'Investors believe inflation is cooling without recession.', 'All Medium-Risk stocks move UP 1 step.', { k: 'risk', risk: 'Med', bp: 500 }, 'dovish', 'Confidence improves in balanced companies that offer growth without the highest risk.'),
  mk('Tight Money', 'Credit conditions get stricter.', 'All High-Risk stocks move DOWN 1 step.', { k: 'risk', risk: 'High', bp: -500 }, 'hawkish', 'Harder financing creates a headwind for companies that depend on growth and risk appetite.'),
  mk('Easy Money', 'Borrowing conditions improve.', 'All High-Risk stocks move UP 1 step.', { k: 'risk', risk: 'High', bp: 500 }, 'dovish', 'Easier financing gives high-risk growth companies a market tailwind.'),
  mk('Mortgage Pressure', 'Higher borrowing costs hit housing demand and household budgets.', 'Real Estate DOWN 1 step · Consumer DOWN 1 step.', { k: 'multi', m: [{ sec: 'realestate', bp: -500 }, { sec: 'consumer', bp: -500 }] }, 'hawkish', 'Costlier mortgages weaken property demand and leave households with less money to spend.'),
  mk('Bank Margin Boost', 'Lending income improves faster than funding costs.', 'All Finance stocks move UP 1 step.', { k: 'sector', sec: 'finance', bp: 500 }, 'hawkish', 'Finance companies receive a direct earnings tailwind from stronger lending margins.'),
  mk('Credit Stress', 'Investors worry debt is harder to repay.', 'Finance DOWN 1 step · Consumer DOWN 1 step.', { k: 'multi', m: [{ sec: 'finance', bp: -500 }, { sec: 'consumer', bp: -500 }] }, 'hawkish', 'Repayment concerns hurt lenders and reduce consumers’ ability to spend.'),
  mk('Bond Yields Rise', 'Safer income investments get more attractive.', 'Low-Risk stocks UP 1 step · High-Risk stocks DOWN 1 step.', { k: 'multi', m: [{ risk: 'Low', bp: 500 }, { risk: 'High', bp: -500 }] }, 'hawkish', 'Investors rotate toward dependable income and away from speculative companies.'),
  mk('Cut Hopes Rally', 'Investors expect future cuts and chase growth.', 'Technology UP 1 step · Consumer UP 1 step.', { k: 'multi', m: [{ sec: 'tech', bp: 500 }, { sec: 'consumer', bp: 500 }] }, 'dovish', 'Expected rate relief increases demand for growth and consumer companies.'),
];
