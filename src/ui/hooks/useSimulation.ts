import { useCallback, useEffect, useRef, useState } from 'react';
import type { Plan } from '../../engine/types';
import type { SimulationResult } from '../../engine/simulate';

export function useSimulation(plans: Plan[], selectedPlanId: string, onError: () => void) {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [compareResults, setCompareResults] = useState<Record<string, SimulationResult>>({});
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = useCallback(() => {
    workerRef.current?.terminate();
    setProgress(0);
    setResult(null);
    setCompareResults({});
    const worker = new Worker(new URL('../../engine/sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    worker.postMessage({ plans });
    worker.onmessage = (event) => {
      if (event.data.type === 'progress') {
        setProgress(
          Math.round(
            ((event.data.planIndex + event.data.done / event.data.total) / event.data.planCount) *
              100,
          ),
        );
        setCompareResults((old) => ({
          ...old,
          [event.data.planId]: {
            chance: old[event.data.planId]?.chance ?? 0,
            distribution: event.data.distribution,
          },
        }));
        if (event.data.planId === selectedPlanId) {
          setResult((old) => ({ chance: old?.chance ?? 0, distribution: event.data.distribution }));
        }
      } else if (event.data.type === 'result') {
        setCompareResults((old) => ({ ...old, [event.data.planId]: event.data.result }));
        if (event.data.planId === selectedPlanId) setResult(event.data.result);
      } else if (event.data.type === 'complete') {
        worker.terminate();
        workerRef.current = null;
      }
    };
    worker.onerror = () => {
      onError();
      worker.terminate();
      workerRef.current = null;
    };
  }, [onError, plans, selectedPlanId]);

  const selectResult = useCallback(
    (planId: string) => {
      setResult((current) => compareResults[planId] ?? current);
    },
    [compareResults],
  );

  return { progress, result, compareResults, run, selectResult };
}
