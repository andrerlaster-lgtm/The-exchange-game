import { describe, expect, it } from 'vitest';
import { buildSessionDebrief, debriefShareText, recordMarketSignal } from '../engine';
import { patch, started } from './helpers';

describe('Session Debrief', () => {
  it('builds the closing summary from live game state and corrected debt rules', () => {
    const s = patch(started(3), (draft) => {
      draft.lap = 4;
      draft.players[0].cash = 34_000;
      draft.players[1].feeDebtPrincipal = 3_000;
      draft.players[1].feeDebtInterest = 200;
      draft.soldOut.CCAI = { code: 'CCAI', claimHolder: 0 };
      draft.soldOut.SAFE = { code: 'SAFE', claimHolder: 2 };
      draft.marketSignals.push({
        id: 1,
        kind: 'market',
        title: 'Bull Run',
        summary: 'Risk woke up optimistic.',
        lap: 3,
        impacts: [{ code: 'CCAI', d: 2 }],
      });
    });

    const summary = buildSessionDebrief(s).summary;

    expect(summary.lapsReached).toBe(4);
    expect(summary.companiesCornered).toBe(2);
    expect(summary.companiesUntouched).toBe(20);
    expect(summary.outstandingFees).toBe(3_200);
    expect(summary.interestStillOwed).toBe(200);
    expect(summary.biggestSwingPlayer).toBe('Morgan');
    expect(summary.marketEvents).toBe(1);
  });

  it('gives every player a funny, state-based post-mortem', () => {
    const s = patch(started(3), (draft) => {
      draft.players[0].shares.CCAI = 11;
      draft.players[0].stockCostBasis.CCAI = 10_000;
      draft.players[1].feeDebtPrincipal = 2_500;
      draft.players[2].shares.SAFE = 1;
      draft.players[2].shares.MEDI = 1;
      draft.players[2].shares.OILW = 1;
    });

    const cards = buildSessionDebrief(s).players;
    const concentrated = cards.find((card) => card.playerIdx === 0)!;
    const debtor = cards.find((card) => card.playerIdx === 1)!;
    const diversified = cards.find((card) => card.playerIdx === 2)!;

    expect(cards.every((card) => card.title.length > 0 && card.verdict.length > 0)).toBe(true);
    expect(concentrated.title).toBe('All Eggs, One Ticker');
    expect(debtor.title).toBe('Collections Has Your Number');
    expect(debtor.verdict).toContain('5% interest');
    expect(diversified.title).toBe('Diversified-ish');
  });

  it('keeps routine laps, purchases, and fees off The Tape and shows only major events', () => {
    const s = patch(started(2), (draft) => {
      draft.log = [
        { text: 'Morgan rolls 7 → space 8', kind: 'n', t: 1 },
        { text: 'Riley carries $3,000 of Portfolio Tax as Outstanding Fees debt.', kind: 'y', t: 2 },
        { text: 'Morgan buys the SafeMart Stores company for $5,000!', kind: 'g', t: 2 },
      ];
      recordMarketSignal(draft, {
        kind: 'claim',
        title: 'SAFE Taken Over',
        summary: 'Riley took control of SAFE from Morgan.',
        impacts: [],
      });
    });

    const tape = buildSessionDebrief(s).tape;

    expect(tape.some((entry) => entry.text.includes('rolls 7'))).toBe(false);
    expect(tape.some((entry) => entry.text.includes('Outstanding Fees'))).toBe(false);
    expect(tape.some((entry) => entry.text.includes('buys the SafeMart'))).toBe(false);
    expect(tape.some((entry) => entry.text.includes('SAFE Taken Over'))).toBe(true);
  });

  it('copies current rankings and debt without old mock values', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].feeDebtPrincipal = 3_000;
      draft.players[0].feeDebtInterest = 200;
    });

    const text = debriefShareText(s);

    expect(text).toContain('Outstanding Fees: $3,200');
    expect(text).not.toContain('$340');
    expect(text).not.toContain('$500 paid to bank');
  });
});
