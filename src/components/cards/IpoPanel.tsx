import type { CSSProperties, ReactNode } from 'react';
import { IPO_BY_CODE, IPO_PRESENTATION, LADDER, SECTORS } from '../../data';
import type { IpoDef } from '../../data';
import { useDispatch, useGameState } from '../../store';

interface IpoCardProps {
  def: IpoDef;
  price: number;
  supply: number;
  stepDiff: number;
  children?: ReactNode;
}

function money(value: number) {
  return `$${value.toLocaleString()}`;
}

function IpoCard({ def, price, supply, stepDiff, children }: IpoCardProps) {
  const presentation = IPO_PRESENTATION[def.code];
  const sector = SECTORS[def.sector];
  const moveClass = stepDiff > 0 ? 'up' : stepDiff < 0 ? 'down' : 'flat';
  const moveLabel = stepDiff > 0 ? `↑ ${stepDiff} step${stepDiff === 1 ? '' : 's'}`
    : stepDiff < 0 ? `↓ ${Math.abs(stepDiff)} step${stepDiff === -1 ? '' : 's'}`
      : 'Opening price';

  return (
    <article className="ipo-card holo-card" style={{ '--ipo-color': def.color } as CSSProperties}
      aria-label={`${def.code} ${def.name} IPO card`}>
      <div className="holo-card__sheen" />
      <div className="holo-card__grain" />
      <header className="ipo-card__banner">
        <span>THE EXCHANGE · IPO</span>
        <span className="ipo-card__status">NEW LISTING</span>
      </header>

      <div className="ipo-card__identity">
        <div>
          <div className="ipo-card__ticker">{def.code}</div>
          <div className="ipo-card__name">{def.name}</div>
          <div className="ipo-card__meta">{sector.name} · {presentation.volatilityLabel}</div>
        </div>
        <div className="ipo-card__mark" aria-hidden="true">{presentation.icon}</div>
      </div>

      <div className="ipo-card__chart" aria-hidden="true">
        <svg viewBox="0 0 220 54" role="presentation">
          <defs>
            <linearGradient id={`ipo-fill-${def.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={def.color} stopOpacity=".42" />
              <stop offset="1" stopColor={def.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="ipo-card__chart-grid" d="M0 13.5H220M0 27H220M0 40.5H220" />
          <path fill={`url(#ipo-fill-${def.code})`} d="M0 49L0 42L24 39L43 43L68 30L91 34L116 25L138 29L162 17L183 20L220 4V54H0Z" />
          <path className="ipo-card__chart-line" style={{ stroke: def.color }} d="M0 42L24 39L43 43L68 30L91 34L116 25L138 29L162 17L183 20L220 4" />
        </svg>
        <span className="ipo-card__chart-label">PUBLIC OFFERING</span>
      </div>

      <div className="ipo-card__quote">
        <div>
          <span className="ipo-card__eyebrow">LIVE IPO PRICE</span>
          <strong>{money(price)}</strong>
          <span className={`ipo-card__move ${moveClass}`}>{moveLabel}</span>
        </div>
        <div className="ipo-card__supply">
          <strong>{supply}</strong>
          <span>SHARE{supply === 1 ? '' : 'S'} AVAILABLE</span>
        </div>
      </div>

      <div className="ipo-card__facts">
        <div><span>DIVIDEND</span><strong>{money(def.div)} / SHARE</strong></div>
        <div><span>PROFILE</span><strong>{presentation.opportunityTitle}</strong></div>
      </div>

      <div className="ipo-card__opportunity">
        <strong>{presentation.opportunityTitle}</strong>
        <span>{presentation.opportunityText}</span>
      </div>

      <div className="ipo-card__limit">BUY UP TO 2 SHARES THIS LANDING</div>
      {children ? <div className="ipo-card__actions">{children}</div> : null}
      <footer className="ipo-card__footer">
        <span>{presentation.flavor}</span>
        <b>{presentation.volatilityLabel}</b>
      </footer>
    </article>
  );
}

export default function IpoPanel() {
  const s = useGameState();
  const dispatch = useDispatch();
  if (!s.ipoChoice && !s.ipoListPick && !s.ipoBuy) return null;

  const listed = s.ipos.filter((ipo) => ipo.revealed && ipo.supply > 0);

  return (
    <section className="ipo-market" aria-label="IPO market">
      <div className="ipo-market__heading">
        <span>IPO MARKET</span>
        <small>Only the player who landed here may buy</small>
      </div>

      {s.ipoListPick && (
        <div className="ipo-market__list">
          {listed.map((ip) => {
            const def = IPO_BY_CODE[ip.code];
            const price = LADDER[ip.step];
            return (
              <IpoCard key={ip.code} def={def} price={price} supply={ip.supply} stepDiff={ip.step - def.startStep}>
                <button className="ipo-card__primary" onClick={() => dispatch({ t: 'pickKnownIpo', code: ip.code })}>
                  Select {ip.code}
                </button>
              </IpoCard>
            );
          })}
          <button className="ipo-market__skip" onClick={() => dispatch({ t: 'skipIpo' })}>Skip IPO</button>
        </div>
      )}

      {s.ipoBuy ? (() => {
        const offer = s.ipoBuy;
        const def = IPO_BY_CODE[offer.code];
        const ipo = s.ipos.find((entry) => entry.code === offer.code);
        const actor = s.players[offer.actor];
        const supply = ipo?.supply ?? 0;
        const atMax = offer.bought >= offer.max;
        const supplyOut = supply <= 0;
        const cantAfford = actor.cash < offer.price;
        const disabled = atMax || supplyOut || cantAfford;
        return (
          <div className="ipo-market__offer">
            <div className="ipo-market__buyer" style={{ '--player-color': actor.color } as CSSProperties}>
              <span />
              <strong>{actor.name}</strong>
              <small>ONLY BUYER · {offer.bought}/{offer.max} PURCHASED</small>
            </div>
            <IpoCard def={def} price={offer.price} supply={supply} stepDiff={(ipo?.step ?? def.startStep) - def.startStep}>
              <button className="ipo-card__primary" disabled={disabled} onClick={() => dispatch({ t: 'ipoBuyShare' })}>
                Buy 1 Share · {money(offer.price)}
              </button>
              <button className="ipo-card__done" onClick={() => dispatch({ t: 'ipoBuyDone' })}>Done</button>
              {!atMax && (cantAfford || supplyOut) ? (
                <div className="ipo-card__warning">
                  {supplyOut ? 'No shares remain.' : `${actor.name} needs ${money(offer.price - actor.cash)} more.`}
                </div>
              ) : null}
            </IpoCard>
          </div>
        );
      })() : null}

      {s.ipoChoice && !s.ipoListPick && !s.ipoBuy ? (
        <button className="ipo-market__skip" onClick={() => dispatch({ t: 'skipIpo' })}>Skip IPO</button>
      ) : null}
    </section>
  );
}
