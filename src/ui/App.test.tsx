// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedPlans } from '../data/seed';
import { useStore } from '../store';
import App from './App';

const dndHarness = vi.hoisted(() => ({
  onDragEnd: null as
    ((event: { active: { id: string }; over: { id: string } | null }) => void) | null,
}));

vi.mock('@dnd-kit/core', async () => {
  const React = await import('react');
  return {
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: ReactNode;
      onDragEnd: typeof dndHarness.onDragEnd;
    }) => {
      dndHarness.onDragEnd = onDragEnd;
      return React.createElement('div', null, children);
    },
    DragOverlay: ({ children }: { children: ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useDraggable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      isDragging: false,
    }),
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  };
});

beforeEach(() => {
  window.localStorage.clear();
  useStore.setState({
    plans: seedPlans,
    active: 0,
    game: 1,
    live: false,
    actual: {},
    actualBans: {},
  });
  dndHarness.onDragEnd = null;
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Data Dragon unavailable')));
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Reserve UI', () => {
  it('rejects a drop of a locked champion and shows a message', async () => {
    render(<App />);
    await act(async () => {
      dndHarness.onDragEnd?.({ active: { id: 'Ahri' }, over: { id: 'blue:Mid:2' } });
    });
    expect(
      await screen.findByText('Ahri was picked earlier and is locked for Game 2.'),
    ).toBeVisible();
  });

  it('shows a structural warning for an invalid role pool', () => {
    render(<App />);
    expect(screen.getAllByText(/Mid has 4 strong options left for 5 games/).length).toBeGreaterThan(
      0,
    );
  });

  it('updates the planned board pick when switching plans', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    render(<App />);
    expect(screen.getByLabelText('Game 1 Mid: Ahri')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /PLAN B/ }));
    expect(await screen.findByLabelText('Game 1 Mid: Taliyah')).toBeVisible();
  });
});
