export const ENGINE_CONFIG = {
  comfort: {
    strongOptionThreshold: 3,
    maximum: 5,
  },
  holdScore: {
    weights: {
      scarcity: 0.4,
      comfort: 0.3,
      flexibility: 0.2,
      gamesRemaining: 0.1,
    },
    recommendation: {
      spendAtOrBelow: 35,
      holdAtOrAbove: 65,
    },
    maximum: 100,
  },
} as const;
