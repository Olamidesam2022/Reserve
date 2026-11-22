import { useState } from 'react';
import { motion } from 'framer-motion';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { champions } from '../../data/seed';
import { currentDataDragonVersion } from '../hooks/useDataDragon';
import { ROLES, type Plan, type Role } from '../../engine/types';

export function Tile({
  id,
  locked = false,
  reserved = false,
  pulse = false,
  onClick,
  layoutId,
  overlay = false,
}: {
  id: string;
  locked?: boolean;
  reserved?: boolean;
  pulse?: boolean;
  onClick?: () => void;
  layoutId?: string;
  overlay?: boolean;
}) {
  const champ = champions[id];
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: locked || overlay,
  });
  const [failed, setFailed] = useState(false);
  return (
    <motion.button
      layout
      layoutId={layoutId}
      transition={{ layout: { type: 'spring', stiffness: 520, damping: 38, duration: 0.55 } }}
      ref={setNodeRef}
      {...(!overlay ? attributes : {})}
      {...(!overlay ? listeners : {})}
      onClick={onClick}
      className={`tile ${locked ? 'locked' : ''} ${reserved ? 'reserved' : ''} ${isDragging ? 'dragging' : ''} ${pulse ? 'lock-pulse' : ''} ${overlay ? 'drag-overlay' : ''}`}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px,${transform.y}px,0) scale(1.06)` }
          : undefined
      }
      aria-label={`${champ?.name ?? id}${locked ? ', locked' : ''}${reserved ? ', reserved' : ''}`}
    >
      <div className="tile-art">
        {champ && !failed ? (
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/${currentDataDragonVersion()}/img/champion/${id}.png`}
            onError={() => setFailed(true)}
            alt=""
          />
        ) : null}
        <span>{champ?.name ?? id}</span>
      </div>
      <b className="tile-state">{locked ? 'LOCKED' : reserved ? 'HELD' : 'PICK'}</b>
    </motion.button>
  );
}

export function Slot({
  team,
  role,
  id,
  locked,
  assign,
}: {
  team: string;
  role: Role;
  id?: string;
  locked: boolean;
  assign: (team: string, role: Role, championId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${team}:${role}` });
  return (
    <div
      ref={setNodeRef}
      className={`slot ${team === 'red' ? 'enemy' : ''} ${isOver ? 'over' : ''}`}
      onClick={() => id && assign(team, role, id)}
    >
      {id ? (
        <Tile id={id} locked={locked} reserved />
      ) : (
        <span className="slot-empty">DROP {role.toUpperCase()}</span>
      )}
    </div>
  );
}

export function BoardCell({
  team,
  role,
  game,
  pick,
  bait,
  locked,
  current,
  cascade,
  pulse,
  onSelect,
}: {
  team: string;
  role: Role;
  game: number;
  pick?: string;
  bait?: string;
  locked: boolean;
  current: boolean;
  cascade: boolean;
  pulse: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${team}:${role}:${game}` });
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`board-cell ${current ? 'active-cell' : ''} ${locked ? 'burned' : ''} ${pick ? 'has-pick' : ''} ${isOver ? 'over' : ''} ${cascade ? 'cascade' : ''}`}
      style={cascade ? { animationDelay: `${Math.max(0, game - 2) * 40}ms` } : undefined}
      aria-label={`Game ${game} ${role}: ${pick ?? 'empty'}`}
    >
      {pick ? (
        <>
          <Tile
            id={pick}
            locked={locked}
            reserved={!locked && game > 1}
            pulse={pulse}
            layoutId={`${team}:${pick}`}
          />
          {bait && <small className="bait">BAIT → {champions[bait]?.name ?? bait}</small>}
        </>
      ) : (
        <span>DROP PICK</span>
      )}
    </div>
  );
}

export function Review({
  plan,
  actual,
  champName,
}: {
  plan: Plan;
  actual: Record<number, Record<string, string>>;
  champName: (id: string) => string;
}) {
  return (
    <section className="panel review">
      <div className="eyebrow">07 / POST-SERIES REVIEW</div>
      <h2>Planned vs. actual</h2>
      <p>
        Recorded picks are compared with the series plan. Differences are flagged by game and role.
      </p>
      {plan.series.games.map((game) => (
        <div className="review-game" key={game.index}>
          <b>GAME 0{game.index}</b>
          {plan.series.teams.map((team) => (
            <div className="review-team" key={team.id}>
              <strong>{team.name}</strong>
              <div className="review-team-grid">
                {ROLES.map((role) => {
                  const planned = plan.intendedPicks[game.index]?.find(
                    (pick) => pick.teamId === team.id && pick.role === role,
                  )?.championId;
                  const played = actual[game.index]?.[`${team.id}:${role}`];
                  const differs = !!played && played !== planned;
                  return (
                    <div className={`review-pick ${differs ? 'changed' : ''}`} key={role}>
                      <small>{role}</small>
                      <span>PLAN · {planned ? champName(planned) : '—'}</span>
                      <span>ACTUAL · {played ? champName(played) : 'NOT RECORDED'}</span>
                      {differs && <em>PLAN BROKE</em>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
