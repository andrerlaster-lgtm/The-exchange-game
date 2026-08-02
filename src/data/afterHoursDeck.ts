import type { Card } from './types';

const mk = (title: string, story: string, effect: string, eff: Card['eff']): Card =>
  ({ deck: 'AH', title, story, effect, eff });

export const AH_CARDS: Card[] = [
  mk('Insider Tip',       'A whisper reaches you before the market reacts.',            'Peek at the market — no price change.',                          { k: 'none' }),
  mk('Late Earnings Beat','A company reports strong results after the bell.',           'Choose a company — it moves UP 2 steps.',                        { k: 'pick', d: 2,  label: 'Choose a company to move UP 2 steps'   }),
  mk('Late Earnings Miss','A company reports weak results after the bell.',             'Choose a company — it moves DOWN 2 steps.',                      { k: 'pick', d: -2, label: 'Choose a company to move DOWN 2 steps' }),
  mk('Margin Call',       'The desk demands cash from borrowers.',                      'Every player with margin pays $500 now.',                        { k: 'margin', amt: 500 }),
  { deck: 'AH', title: 'Extended Hours', story: 'Trading stays open past the bell.',
    effect: 'Banks a 1-round Market Close extension — everyone gets one more turn once it triggers.',
    eff: { k: 'extend' } },
  mk('Thin Liquidity',    'Few buyers and sellers are active.',                         'No price movement this turn.',                                   { k: 'none' }),
  mk('Price Whipsaw',     'Small orders swing one stock around.',                       'Choose a company — it moves DOWN 1 step.',                       { k: 'pick', d: -1, label: 'Choose a company to move DOWN 1 step' }),
  mk('Forced Cover',      'Short sellers rush to buy back the cheapest name.',          'The lowest-priced company moves UP 1 step.',                     { k: 'lowest', d: 1 }),
  mk('No Fill',           'Your order sits open with no taker.',                        'Nothing happens. End your turn.',                                { k: 'none' }),
  mk('Late Tape Leak',    'A headline hits before most investors notice.',              'Peek at the market — no price change.',                          { k: 'none' }),
  mk('Wide Spread',       'The gap between buyers and sellers widens.',                 'No price movement this turn.',                                   { k: 'none' }),
  mk('Cash Cushion',      'Holding cash gives you flexibility.',                        'Collect $1,000.',                                                { k: 'cash', amt: 1000 }),
];
