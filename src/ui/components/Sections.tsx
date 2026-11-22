import type { PropsWithChildren } from 'react';

type SectionProps = PropsWithChildren<{ className?: string }>;

function Frame({
  as: Tag = 'section',
  className,
  children,
}: SectionProps & { as?: 'section' | 'div' }) {
  return <Tag className={className}>{children}</Tag>;
}

export function Hero({ children }: PropsWithChildren) {
  return (
    <Frame as="section" className="hero">
      {children}
    </Frame>
  );
}
export function Toolbar({ children }: PropsWithChildren) {
  return (
    <Frame as="div" className="toolbar">
      {children}
    </Frame>
  );
}
export function SeriesBoard({ children }: PropsWithChildren) {
  return <Frame className="board panel">{children}</Frame>;
}
export function OpponentPanel({ children }: PropsWithChildren) {
  return <Frame className="panel opponent">{children}</Frame>;
}
export function ExhaustionPanel({ children }: PropsWithChildren) {
  return <Frame className="panel depletion">{children}</Frame>;
}
export function PoolList({ children }: PropsWithChildren) {
  return (
    <Frame as="div" className="pool-list">
      {children}
    </Frame>
  );
}
export function LockLedger({ children }: PropsWithChildren) {
  return <Frame className="panel analysis">{children}</Frame>;
}
export function PlanCompare({ children }: PropsWithChildren) {
  return (
    <Frame as="div" className="compare">
      {children}
    </Frame>
  );
}
export function EnemyBoard({ children }: PropsWithChildren) {
  return <Frame className="panel enemy-board">{children}</Frame>;
}
export function LiveBans({ children }: PropsWithChildren) {
  return <Frame className="panel live-bans">{children}</Frame>;
}
export function Brief({ children }: PropsWithChildren) {
  return (
    <Frame as="section" className="brief">
      {children}
    </Frame>
  );
}
