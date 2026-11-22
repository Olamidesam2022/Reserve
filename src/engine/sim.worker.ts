import { simulate } from './simulate';
import type { Plan } from './types';
import { ENGINE_CONFIG } from './config';

self.onmessage = (event: MessageEvent<{ plan?: Plan; plans?: Plan[]; iterations?: number }>) => {
  const plans = event.data.plans ?? (event.data.plan ? [event.data.plan] : []);
  plans.forEach((plan, planIndex) => {
    const result = simulate(
      plan,
      event.data.iterations ?? ENGINE_CONFIG.simulation.iterations,
      (done, total, scoreDistribution) => {
        self.postMessage({
          type: 'progress',
          planId: plan.id,
          planIndex,
          planCount: plans.length,
          done,
          total,
          scoreDistribution,
        });
      },
    );
    self.postMessage({ type: 'result', planId: plan.id, planIndex, result });
  });
  self.postMessage({ type: 'complete' });
};
