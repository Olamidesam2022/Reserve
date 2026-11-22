import { simulate } from './simulate';
import type { Plan } from './types';

self.onmessage = (event: MessageEvent<{ plan?: Plan; plans?: Plan[]; iterations?: number }>) => {
  const plans = event.data.plans ?? (event.data.plan ? [event.data.plan] : []);
  plans.forEach((plan, planIndex) => {
    const result = simulate(plan, event.data.iterations ?? 1200, (done, total, distribution) => {
      self.postMessage({ type: 'progress', planId: plan.id, planIndex, planCount: plans.length, done, total, distribution });
    });
    self.postMessage({ type: 'result', planId: plan.id, planIndex, result });
  });
  self.postMessage({ type: 'complete' });
};
