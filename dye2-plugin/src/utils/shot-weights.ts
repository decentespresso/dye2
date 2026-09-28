/**
 * A recorded shot's dose in and drink out, as a browser-side script string (no local imports,
 * so test/shot-weights.test.mjs can eval it directly).
 *
 * Shot annotations are the canonical measured/entered values — the fields the edit-shot page
 * shows and saves. The last scale sample in measurements is only a fallback for shots without
 * an actual yield: it's taken before the final drips land, so it can read several grams low.
 */
export const shotWeightsScript = `
function shotWeights(shot) {
  const wf = shot.workflow || {};
  const ctx = wf.context || {};
  const doseData = wf.doseData || {};
  const ann = shot.annotations || {};
  const doseIn = ann.actualDoseWeight != null ? ann.actualDoseWeight
    : ctx.targetDoseWeight != null ? ctx.targetDoseWeight
    : (doseData.doseIn != null ? doseData.doseIn : null);
  let doseOut = ann.actualYield != null ? ann.actualYield : null;
  const measurements = shot.measurements || [];
  for (let mi = measurements.length - 1; doseOut == null && mi >= 0; mi--) {
    const sc = measurements[mi].scale;
    if (sc && sc.weight != null) doseOut = sc.weight;
  }
  return { doseIn, doseOut };
}
`;
