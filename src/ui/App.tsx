import { useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useStore } from '../store';
import { champions } from '../data/seed';
import { CsvPoolSource, ManualPoolSource } from '../data/poolSource';
import { burnScore, exhaustion, lockState, validate } from '../engine';
import { ROLES, type Role } from '../engine/types';
import { ENGINE_CONFIG } from '../engine/config';
import { BoardCell, Review, Slot, Tile } from './components/Primitives';
import {
  Brief,
  EnemyBoard,
  ExhaustionPanel,
  Hero,
  LiveBans,
  LockLedger,
  OpponentPanel,
  PlanCompare,
  PoolList,
  SeriesBoard,
  Toolbar,
} from './components/Sections';
import { useCountUp } from './hooks/useCountUp';
import { useDataDragon } from './hooks/useDataDragon';
import { useSimulation } from './hooks/useSimulation';
export default function App() {
  const {
    plans,
    active,
    game,
    setGame,
    setActive,
    assign,
    live,
    toggleLive,
    record,
    recordBan,
    actual,
    actualBans,
    importPools,
  } = useStore();
  const plan = plans[active];
  const [tab, setTab] = useState<'board' | 'review'>('board');
  const { version: dataVersion, names: dragonNames } = useDataDragon();
  const simulation = useSimulation(plans, plan.id, game, () =>
    setNotice('Simulator could not start. Reload and try again.'),
  );
  const { progress, result, compareResults } = simulation;
  const countUp = useCountUp(result ? result.seriesWinChance * 100 : undefined);
  const [pulseChampion, setPulseChampion] = useState('');
  const [cascadeFrom, setCascadeFrom] = useState(0);
  const [shakeExhaustion, setShakeExhaustion] = useState(false);
  const [draggingChampion, setDraggingChampion] = useState('');
  const [dragTilt, setDragTilt] = useState(0);
  const dragMotion = useRef({ deltaX: 0, time: 0 });
  const motionTimers = useRef<number[]>([]);
  const reduceMotion = useReducedMotion() ?? false;
  const [notice, setNotice] = useState('');
  const [brief, setBrief] = useState(false);
  const [baitForChampion, setBaitForChampion] = useState('');
  const [baitCounterId, setBaitCounterId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [manualText, setManualText] = useState('');
  const warn = useMemo(() => validate(plan).filter((w) => w.gameIndex === game), [plan, game]);
  const lock = lockState(plan.series, game);
  const own = plan.series.teams[0],
    enemy = plan.series.teams[1];
  const exhaustionRows = exhaustion(own, plan.series, plan, game);
  const current = plan.intendedPicks[game] ?? [];
  const available = own.players
    .flatMap((p) =>
      Object.entries(p.comfort)
        .filter(([id]) => !lock.has(id))
        .map(([id, comfort]) => ({ id, comfort, role: p.role })),
    )
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
  function clearMotionTimers() {
    motionTimers.current.forEach((timer) => window.clearTimeout(timer));
    motionTimers.current = [];
  }
  function scheduleMotion(callback: () => void, delay: number) {
    motionTimers.current.push(window.setTimeout(callback, delay));
  }
  function dragStart(event: DragStartEvent) {
    clearMotionTimers();
    setPulseChampion('');
    setCascadeFrom(0);
    setShakeExhaustion(false);
    setDraggingChampion(String(event.active.id));
    setDragTilt(0);
    dragMotion.current = { deltaX: 0, time: performance.now() };
  }
  function dragMove(event: DragMoveEvent) {
    const time = performance.now();
    const elapsed = Math.max(1, time - dragMotion.current.time);
    const velocity = (event.delta.x - dragMotion.current.deltaX) / elapsed;
    dragMotion.current = { deltaX: event.delta.x, time };
    if (!reduceMotion) setDragTilt(Math.max(-4, Math.min(4, velocity * 10)));
  }
  function dragEnd(e: DragEndEvent) {
    clearMotionTimers();
    setShakeExhaustion(false);
    setDraggingChampion('');
    setDragTilt(0);
    const dest = String(e.over?.id ?? '').split(':');
    if (dest.length < 2) return;
    const id = String(e.active.id),
      team = dest[0],
      role = dest[1] as Role,
      targetGame = Number(dest[2] ?? game);
    if (lockState(plan.series, targetGame).has(id)) {
      setNotice(
        `${champions[id]?.name ?? id} was picked earlier and is locked for Game ${targetGame}.`,
      );
      return;
    }
    setGame(targetGame);
    assign(team, role, id);
    setPulseChampion('');
    scheduleMotion(() => setPulseChampion(id), 0);
    if (targetGame === 1) {
      scheduleMotion(() => setCascadeFrom(1), 390);
      scheduleMotion(() => setCascadeFrom(0), 650);
    }
    scheduleMotion(() => setShakeExhaustion(true), targetGame === 1 ? 670 : 390);
    scheduleMotion(() => setShakeExhaustion(false), targetGame === 1 ? 870 : 590);
    setNotice(`${champions[id]?.name ?? id} committed to Game ${targetGame}.`);
    window.setTimeout(() => setNotice(''), 2400);
  }
  function importCsvText(text: string) {
    const pools = new CsvPoolSource().parse(text);
    importPools(own.id, pools);
    setNotice(`Imported ${pools.length} player pools.`);
  }
  function importManualText(text: string) {
    try {
      const pools = new ManualPoolSource().parse(text);
      importPools(own.id, pools);
      setNotice(`Loaded ${pools.length} manual player pools.`);
    } catch {
      setNotice('Manual pools need valid JSON: an array of playerId, role and comfort objects.');
    }
  }
  function importCsv(file?: File) {
    if (!file) return;
    file.text().then(importCsvText);
  }
  const champName = (id: string) => dragonNames[id] ?? champions[id]?.name ?? id;
  return (
    <MotionConfig reducedMotion="user">
      <main className="app min-h-screen">
        <header className="topbar">
          <img className="brand" src="/logo.svg" alt="Reserve" />
          <div className="top-meta">
            <span>FEARLESS DRAFT / SERIES OPS</span>
            <b>
              DATA DRAGON {dataVersion} <i>●</i> LOCAL SESSION
            </b>
          </div>
          <button className={`live-toggle ${live ? 'active' : ''}`} onClick={toggleLive}>
            {live ? '● LIVE MODE' : '○ LIVE MODE'}
          </button>
        </header>
        <Hero>
          <div>
            <div className="eyebrow">
              SERIES RESOURCE MAP <span>● BO5 / FEARLESS</span>
            </div>
            <h1>
              Plan the series,
              <br />
              <em>not just the draft.</em>
            </h1>
            <p>Every pick spends an option. Keep the right ones in reserve.</p>
          </div>
          <div className="hero-readout">
            <div className="eyebrow">SERIES WIN CHANCE</div>
            <strong>{result ? `${countUp}%` : '—'}</strong>
            <span>
              {plans.length} PLAN{plans.length === 1 ? '' : 'S'} ·{' '}
              {ENGINE_CONFIG.simulation.iterations.toLocaleString()} RUNS EACH
            </span>
            <button className="run-btn" onClick={simulation.run}>
              SIMULATE SERIES ↗
            </button>
          </div>
        </Hero>
        <Toolbar>
          <div className="tabs">
            <button className={tab === 'board' ? 'selected' : ''} onClick={() => setTab('board')}>
              01 / SERIES BOARD
            </button>
            <button className={tab === 'review' ? 'selected' : ''} onClick={() => setTab('review')}>
              02 / POST-SERIES REVIEW
            </button>
          </div>
          <div className="toolbar-right">
            <label className="import-label">
              UPLOAD CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => importCsv(e.target.files?.[0])}
              />
            </label>
            <details className="pool-paste">
              <summary>PASTE / MANUAL</summary>
              <div>
                <label>
                  CSV
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="playerId,role,championId,championName,comfort,isFlex"
                  />
                </label>
                <button onClick={() => importCsvText(csvText)}>IMPORT CSV TEXT</button>
                <label>
                  MANUAL POOLS · JSON
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder='[{"playerId":"mid-1","role":"Mid","comfort":{"Ahri":5}}]'
                  />
                </label>
                <button onClick={() => importManualText(manualText)}>LOAD MANUAL POOLS</button>
              </div>
            </details>
            <button onClick={() => setBrief(true)}>PRINT SERIES BRIEF ↗</button>
          </div>
        </Toolbar>
        {tab === 'board' ? (
          <DndContext onDragStart={dragStart} onDragMove={dragMove} onDragEnd={dragEnd}>
            <LayoutGroup id="reserve-series-board">
              <div className="cockpit">
                <SeriesBoard>
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">01 / SERIES BOARD</div>
                      <h2>
                        Draft allocation{' '}
                        <span>
                          — {own.name} / {enemy.name}
                        </span>
                      </h2>
                    </div>
                    <div className="game-select">
                      {plan.series.games.map((g) => (
                        <button
                          key={g.index}
                          className={game === g.index ? 'on' : ''}
                          onClick={() => setGame(g.index)}
                        >
                          G{g.index}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="board-wrap">
                    <div className="board-head">
                      <span>ROLE</span>
                      {plan.series.games.map((g) => (
                        <button
                          key={g.index}
                          className={g.index === game ? 'col-active' : ''}
                          onClick={() => setGame(g.index)}
                        >
                          GAME 0{g.index}
                        </button>
                      ))}
                    </div>
                    {ROLES.map((role) => (
                      <div className="board-row" key={role}>
                        <div className="role-tag">
                          {role}
                          <small>
                            {own.players
                              .find((p) => p.role === role)
                              ?.playerId.split('-')[1]
                              .toUpperCase()}
                          </small>
                        </div>
                        {plan.series.games.map((g) => {
                          const pick = plan.intendedPicks[g.index]?.find(
                            (p) => p.teamId === own.id && p.role === role,
                          );
                          const locked =
                            !!pick && lockState(plan.series, g.index).has(pick.championId);
                          return (
                            <BoardCell
                              key={g.index}
                              team={own.id}
                              role={role}
                              game={g.index}
                              pick={pick?.championId}
                              bait={pick?.bait?.counterChampionId}
                              locked={locked}
                              current={g.index === game}
                              cascade={cascadeFrom > 0 && g.index > cascadeFrom}
                              pulse={pulseChampion === pick?.championId}
                              onSelect={() => setGame(g.index)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="board-foot">
                    <span>
                      <i className="dot amber" /> HELD IN RESERVE
                    </span>
                    <span>
                      <i className="dot grey" /> SPENT / LOCKED
                    </span>
                    <span className="mono">
                      {current.filter((p) => p.teamId === own.id).length} / 5 PICKS PLANNED
                    </span>
                  </div>
                </SeriesBoard>
                <aside className="right-rail">
                  <OpponentPanel>
                    <div className="eyebrow">02 / OPPONENT READ</div>
                    <div className="enemy-title">
                      {enemy.name}
                      <span>BLUE SIDE</span>
                    </div>
                    <div className="opponent-picks">
                      {ROLES.map((r) => (
                        <span key={r}>
                          {r.slice(0, 1)}
                          <b>
                            {champName(
                              plan.intendedPicks[game]?.find(
                                (p) => p.teamId === enemy.id && p.role === r,
                              )?.championId ?? '—',
                            )}
                          </b>
                        </span>
                      ))}
                    </div>
                    <div className="eyebrow">LIVE ENEMY ROLE AT RISK</div>
                    <div className="risk-role">
                      {exhaustion(enemy, plan.series, plan, game)[0].role}
                      <strong>
                        {exhaustion(enemy, plan.series, plan, game)[0].remaining}
                        <small> OPTIONS</small>
                      </strong>
                    </div>
                  </OpponentPanel>
                  <ExhaustionPanel>
                    <div className="eyebrow">03 / YOUR OPTION DEPTH</div>
                    <h3>Exhaustion forecast</h3>
                    {exhaustionRows.map((r, i) => (
                      <div
                        className={`meter-row ${r.remaining <= 2 ? 'critical' : ''} ${shakeExhaustion ? 'shake' : ''}`}
                        key={r.role}
                      >
                        <div>
                          <span>{r.role}</span>
                          <small>{r.remaining} STRONG LEFT</small>
                        </div>
                        <div className="meter">
                          <i style={{ width: `${Math.min(100, (r.remaining / 5) * 100)}%` }} />
                        </div>
                        <b>{String(i + 1).padStart(2, '0')}</b>
                      </div>
                    ))}
                    <p className="forecast">
                      FIRST TO RUN DRY <strong>{exhaustionRows[0]?.role}</strong>
                    </p>
                  </ExhaustionPanel>
                </aside>
              </div>
              <div className="lower-grid">
                <section className="panel editor">
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">04 / PICK RESERVE</div>
                      <h2>Available comfort pool</h2>
                    </div>
                    <span className="mono">DRAG TO ROLE SLOT</span>
                  </div>
                  <PoolList>
                    {available
                      .filter((v) => v.comfort >= 2)
                      .map((v) => {
                        const score = burnScore(plan, v.id, game, own.id, v.role);
                        const counterOptions = Object.entries(
                          enemy.players
                            .filter((player) => player.role === v.role)
                            .reduce<Record<string, number>>((options, player) => {
                              for (const [id, comfort] of Object.entries(player.comfort))
                                options[id] = Math.max(options[id] ?? 0, comfort);
                              return options;
                            }, {}),
                        ).filter(
                          ([id, comfort]) =>
                            comfort >= ENGINE_CONFIG.comfort.strongOptionThreshold &&
                            !lock.has(id) &&
                            id !== v.id,
                        );
                        return (
                          <div className="pool-item" key={v.id}>
                            <Tile id={v.id} locked={false} reserved={v.comfort >= 4} />
                            <div>
                              <b>{champName(v.id)}</b>
                              <small>
                                {v.role} / COMFORT {v.comfort}
                              </small>
                            </div>
                            <span
                              title={score.reasons.join(' · ')}
                              className={`pool-score recommendation ${score.recommendation.toLowerCase()}`}
                            >
                              {score.holdValue}
                              <small>{score.recommendation}</small>
                            </span>
                            <button
                              aria-label={`Mark ${champName(v.id)} as bait`}
                              className="bait-button"
                              aria-expanded={baitForChampion === v.id}
                              onClick={() => {
                                setBaitForChampion((current) => (current === v.id ? '' : v.id));
                                setBaitCounterId('');
                              }}
                            >
                              {baitForChampion === v.id ? 'CANCEL' : 'BAIT'}
                            </button>
                            {baitForChampion === v.id && (
                              <div className="bait-controls">
                                <label>
                                  EXPECT {v.role.toUpperCase()} COUNTER
                                  <select
                                    value={baitCounterId}
                                    onChange={(event) =>
                                      setBaitCounterId(event.currentTarget.value)
                                    }
                                  >
                                    <option value="">SELECT STRONG COUNTER</option>
                                    {counterOptions.map(([id]) => (
                                      <option value={id} key={id}>
                                        {champName(id)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  className="bait-confirm"
                                  disabled={!baitCounterId}
                                  onClick={() => {
                                    assign(own.id, v.role, v.id, baitCounterId);
                                    setNotice(
                                      `${champName(v.id)} planned as bait for ${champName(baitCounterId)}.`,
                                    );
                                    setBaitForChampion('');
                                    setBaitCounterId('');
                                  }}
                                >
                                  CONFIRM PICK
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </PoolList>
                  <label className="warnings">
                    <span>LIVE ENGINE WARNINGS</span>
                    {warn.length ? (
                      <ul>
                        {warn.map((w, i) => (
                          <li key={i}>⚠ {w.message}</li>
                        ))}
                      </ul>
                    ) : (
                      <b>✓ No structural risks in Game {game}</b>
                    )}
                  </label>
                </section>
                <LockLedger>
                  <div className="eyebrow">05 / LOCK STATE</div>
                  <h3>Series lock ledger</h3>
                  <div className="lock-count">
                    {lock.size.toString().padStart(2, '0')}
                    <span> CHAMPIONS SPENT BEFORE G{game}</span>
                  </div>
                  <div className="lock-list">
                    {[...lock].map((id) => (
                      <span key={id}>{champName(id)}</span>
                    ))}
                    {!lock.size && (
                      <span className="empty">No picks locked yet. First game is wide open.</span>
                    )}
                  </div>
                  <PlanCompare>
                    <div className="eyebrow">PLAN VARIANTS</div>
                    {plans.map((p, i) => (
                      <div
                        className={`plan-compare-row ${active === i ? 'plan-selected' : ''}`}
                        key={p.id}
                      >
                        <button
                          className={active === i ? 'plan-selected' : ''}
                          onClick={() => {
                            clearMotionTimers();
                            setPulseChampion('');
                            setCascadeFrom(0);
                            setShakeExhaustion(false);
                            setActive(i);
                            simulation.selectResult(p.id);
                          }}
                        >
                          PLAN {String.fromCharCode(65 + i)} <span>{p.name}</span>
                        </button>
                        <strong>
                          {compareResults[p.id]
                            ? Math.round(compareResults[p.id].seriesWinChance * 100)
                            : '—'}
                          <small>{compareResults[p.id] ? '% WIN' : ' WIN'}</small>
                        </strong>
                        <span className="risk-count">{validate(p).length} WARN</span>
                      </div>
                    ))}
                  </PlanCompare>
                  {result && (
                    <div className="distribution">
                      <div className="eyebrow">WIN PROBABILITY DISTRIBUTION</div>
                      <div className="score-bars">
                        {Object.entries(result.scoreDistribution).map(([score, probability]) => (
                          <div
                            className="score-bar"
                            key={score}
                            title={`${score}: ${Math.round(probability * 100)}%`}
                          >
                            <i style={{ height: `${Math.max(3, probability * 100)}%` }} />
                            <span>{score}</span>
                            <small>{Math.round(probability * 100)}%</small>
                          </div>
                        ))}
                      </div>
                      <div className="progress">SIMULATION {progress}% COMPLETE</div>
                    </div>
                  )}
                </LockLedger>
              </div>
              <EnemyBoard>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">06 / OPPONENT RESOURCE MAP</div>
                    <h2>
                      {enemy.name}
                      <span> / projected reserve</span>
                    </h2>
                  </div>
                  <span className="mono blue-tag">OPPOSING SIDE / STEEL BLUE</span>
                </div>
                <div className="enemy-picks">
                  {ROLES.map((role) => (
                    <div key={role}>
                      <span>{role}</span>
                      <Slot
                        team="red"
                        role={role}
                        id={
                          plan.intendedPicks[game]?.find(
                            (p) => p.teamId === enemy.id && p.role === role,
                          )?.championId
                        }
                        locked={false}
                        assign={assign}
                      />
                      {live && (
                        <select
                          className="record"
                          aria-label={`Record actual ${role} pick`}
                          value={actual[game]?.[`${enemy.id}:${role}`] ?? ''}
                          onChange={(e) => {
                            if (e.currentTarget.value)
                              record(enemy.id, role, e.currentTarget.value);
                          }}
                        >
                          <option value="">ACTUAL PICK</option>
                          {Object.keys(
                            enemy.players.find((p) => p.role === role)?.comfort ?? {},
                          ).map((id) => (
                            <option key={id} value={id}>
                              {champName(id)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
                {live && (
                  <div className="own-actual-row">
                    <b>OUR ACTUAL PICKS</b>
                    {ROLES.map((role) => (
                      <label key={role}>
                        {role}
                        <select
                          className="record"
                          aria-label={`Record our actual ${role} pick`}
                          value={actual[game]?.[`${own.id}:${role}`] ?? ''}
                          onChange={(e) => {
                            if (e.currentTarget.value) record(own.id, role, e.currentTarget.value);
                          }}
                        >
                          <option value="">SELECT PICK</option>
                          {Object.keys(own.players.find((p) => p.role === role)?.comfort ?? {}).map(
                            (id) => (
                              <option key={id} value={id}>
                                {champName(id)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </EnemyBoard>
              {live && (
                <LiveBans>
                  <div className="eyebrow">LIVE MODE / GAME BANS</div>
                  <label>
                    RECORD BAN{' '}
                    <select
                      className="record"
                      value=""
                      onChange={(e) => {
                        if (e.currentTarget.value) recordBan(e.currentTarget.value);
                      }}
                    >
                      <option value="">SELECT CHAMPION</option>
                      {Object.keys(champions)
                        .filter((id) => !(actualBans[game] ?? []).includes(id))
                        .map((id) => (
                          <option key={id} value={id}>
                            {champName(id)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div>
                    {(actualBans[game] ?? []).map((id) => (
                      <span key={id}>{champName(id)}</span>
                    ))}
                  </div>
                </LiveBans>
              )}
            </LayoutGroup>
            <DragOverlay dropAnimation={{ duration: 260, easing: 'cubic-bezier(.18,1.25,.32,1)' }}>
              {draggingChampion ? (
                <motion.div
                  className="drag-overlay-motion"
                  animate={{ rotate: reduceMotion ? 0 : dragTilt, scale: 1.06 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                >
                  <Tile id={draggingChampion} overlay />
                </motion.div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <Review plan={plan} actual={actual} champName={champName} />
        )}
        <footer>
          <img src="/logo-mark.svg" alt="" />
          <span>RESERVE / SERIES RESOURCE PLANNER</span>
          <span>NO BACKEND · LOCAL STORAGE ONLY</span>
        </footer>
        <AnimatePresence>
          {notice && (
            <motion.div
              className="inline-notice"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {notice}
            </motion.div>
          )}
        </AnimatePresence>
        {brief && (
          <div className="brief-overlay">
            <Brief>
              <button className="close" onClick={() => setBrief(false)}>
                CLOSE ×
              </button>
              <img src="/logo.svg" />
              <div className="eyebrow">SERIES BRIEF / {plan.series.format.toUpperCase()}</div>
              <h1>
                {own.name} <span>vs</span> {enemy.name}
              </h1>
              <p>Plan the series, not just the draft. · {new Date().toLocaleDateString()}</p>
              {plan.series.games.map((g) => (
                <div className="brief-game" key={g.index}>
                  <b>GAME 0{g.index}</b>
                  <span>
                    {(plan.intendedPicks[g.index] ?? [])
                      .map(
                        (p) =>
                          `${p.teamId === own.id ? 'N' : 'I'}:${champName(p.championId)} (${p.role})`,
                      )
                      .join(' · ') || 'No picks planned'}
                  </span>
                </div>
              ))}
              <button className="run-btn" onClick={() => window.print()}>
                PRINT / SAVE AS PDF ↗
              </button>
            </Brief>
          </div>
        )}
      </main>
    </MotionConfig>
  );
}
