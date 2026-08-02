import type { Card } from './types';
import { MARKET_EVENT_ADDITIONS } from './afterHoursDeck';

const mk = (title: string, story: string, effect: string, eff: Card['eff']): Card =>
  ({ deck: 'ME', title, story, effect, eff });

const CORE_ME_CARDS: Card[] = [
  mk('Tech Earnings High',    'AI and cloud demand beat forecasts across the sector.',      'All Technology stocks move UP 1 step.',                                   { k: 'sector', sec: 'tech',     d: 1  }),
  mk('Tech Earnings Low',     'Customers slow software and cloud spending.',                'All Technology stocks move DOWN 1 step.',                                 { k: 'sector', sec: 'tech',     d: -1 }),
  mk('Finance Rally',         'Banks report stronger lending income.',                      'All Finance stocks move UP 1 step.',                                      { k: 'sector', sec: 'finance',  d: 1  }),
  mk('Energy Crash',          'Fuel prices soften while costs stay high.',                  'All Energy stocks move DOWN 1 step.',                                     { k: 'sector', sec: 'energy',   d: -1 }),
  mk('Healthcare Beat',       'Medical demand stays steady and margins improve.',           'All Healthcare stocks move UP 1 step.',                                   { k: 'sector', sec: 'health',   d: 1  }),
  mk('Consumer Slump',        'Households cut back on nonessential spending.',              'All Consumer stocks move DOWN 1 step.',                                   { k: 'sector', sec: 'consumer', d: -1 }),
  mk('Bull Run',              'Investors rush back in after strong economic news.',         'Every stock moves UP 1 step.',                                            { k: 'all', d: 1              }),
  mk('Market Pullback',       'Investors take profits after a long run-up.',               'Every stock moves DOWN 1 step. (Bear Market)',                            { k: 'all', d: -1, crash: true }),
  mk('Earnings Beat',         'One company crushes its sales and profit targets.',         'Choose a company — it moves UP 2 steps.',                                 { k: 'pick', d: 2,  label: 'Choose a company to move UP 2 steps'   }),
  mk('Earnings Miss',         'One company badly misses expectations.',                    'Choose a company — it moves DOWN 2 steps.',                               { k: 'pick', d: -2, label: 'Choose a company to move DOWN 2 steps' }),
  mk('Short Squeeze',         'Traders betting against the cheapest stock scramble.',      'The lowest-priced company moves UP 2 steps.',                             { k: 'lowest',  d: 2  }),
  mk('Bad Press',             'Negative headlines hit the market leader.',                  'The highest-priced company moves DOWN 1 step.',                           { k: 'highest', d: -1 }),
  mk('Safety Rally',          'Investors move into stable names amid uncertainty.',         'All Low-Risk stocks move UP 1 step.',                                     { k: 'risk', risk: 'Low',  d: 1  }),
  mk('Speculation Surge',     'Traders pile into risky names chasing upside.',             'All High-Risk stocks move UP 1 step.',                                    { k: 'risk', risk: 'High', d: 1  }),
  mk('Speculation Selloff',   'Fear drives investors out of risky names.',                  'All High-Risk stocks move DOWN 1 step.',                                  { k: 'risk', risk: 'High', d: -1 }),
  mk('Flash Crash',           'Selling hits fast before buyers respond.',                   'Every stock moves DOWN 2 steps. (Market Crash)',                          { k: 'all', d: -2, crash: true }),
  mk('Melt-Up Rally',         'Momentum buyers chase the whole market higher.',            'Every stock moves UP 2 steps.',                                           { k: 'all', d: 2              }),
  mk('Market Close',          'The closing bell rings across the exchange.',                'The game ends now — unless a player holds Extended Hours.',               { k: 'close'                  }),
];

export const ME_CARDS: Card[] = [...CORE_ME_CARDS, ...MARKET_EVENT_ADDITIONS];
export const CIRCUIT_BREAKER_INDEX = ME_CARDS.findIndex((card) => card.eff.k === 'circuitBreaker');
