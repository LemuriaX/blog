// Fixed basket and per-share earnings; dividends, taxes and rebalancing excluded.
export function valuationScenario(
  entryPe: number,
  exitPe: number,
  growthPercent: number,
  years: number,
) {
  if (
    ![entryPe, exitPe, growthPercent, years].every(Number.isFinite) ||
    entryPe <= 0 ||
    exitPe <= 0 ||
    growthPercent <= -100 ||
    years <= 0
  ) {
    throw new RangeError(
      'Scenario needs positive PEs and years, and growth above -100%.',
    );
  }
  const multiple = ((1 + growthPercent / 100) ** years * exitPe) / entryPe;
  return {
    total: (multiple - 1) * 100,
    annualized: (multiple ** (1 / years) - 1) * 100,
    breakEvenGrowth: ((entryPe / exitPe) ** (1 / years) - 1) * 100,
  };
}
