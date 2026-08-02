import type { Card } from './types';

const mk = (title: string, story: string, effect: string, eff: Card['eff']): Card =>
  ({ deck: 'FED', title, story, effect, eff });

export const FED_CARDS: Card[] = [
  mk('Rate Hike',           'The Fed raises rates to fight inflation.',                    'Finance UP 1 step · Real Estate DOWN 1 step.',          { k: 'multi', m: [{ sec: 'finance', d: 1 }, { sec: 'realestate', d: -1 }] }),
  mk('Rate Cut',            'The Fed lowers rates to support spending.',                  'Real Estate UP 1 step · High-Risk UP 1 step.',          { k: 'multi', m: [{ sec: 'realestate', d: 1 }, { risk: 'High', d: 1 }] }),
  mk('Rate Hold',           'The Fed waits for more data.',                               'No price movement this turn.',                           { k: 'none' }),
  mk('Inflation Warning',   'The Fed signals policy may stay tight.',                     'Consumer DOWN 1 step · High-Risk DOWN 1 step.',         { k: 'multi', m: [{ sec: 'consumer', d: -1 }, { risk: 'High', d: -1 }] }),
  mk('Soft Landing Hopes',  'Investors believe inflation is cooling without recession.',  'All Medium-Risk stocks move UP 1 step.',                 { k: 'risk', risk: 'Med', d: 1 }),
  mk('Tight Money',         'Credit conditions get stricter.',                            'All High-Risk stocks move DOWN 1 step.',                 { k: 'risk', risk: 'High', d: -1 }),
  mk('Easy Money',          'Borrowing conditions improve.',                              'All High-Risk stocks move UP 1 step.',                   { k: 'risk', risk: 'High', d: 1 }),
  mk('Mortgage Pressure',   'Higher borrowing costs hit property demand.',                'Real Estate DOWN 1 step · Finance UP 1 step.',          { k: 'multi', m: [{ sec: 'realestate', d: -1 }, { sec: 'finance', d: 1 }] }),
  mk('Bank Margin Boost',   'Lending income improves faster than funding costs.',         'All Finance stocks move UP 1 step.',                     { k: 'sector', sec: 'finance', d: 1 }),
  mk('Credit Stress',       'Investors worry debt is harder to repay.',                   'Finance DOWN 1 step · Consumer DOWN 1 step.',           { k: 'multi', m: [{ sec: 'finance', d: -1 }, { sec: 'consumer', d: -1 }] }),
  mk('Bond Yields Rise',    'Safer income investments get more attractive.',              'All High-Risk stocks move DOWN 1 step.',                 { k: 'risk', risk: 'High', d: -1 }),
  mk('Risk-On Rally',       'Investors expect future cuts and chase growth.',             'Technology UP 1 step · Consumer UP 1 step.',            { k: 'multi', m: [{ sec: 'tech', d: 1 }, { sec: 'consumer', d: 1 }] }),
];
