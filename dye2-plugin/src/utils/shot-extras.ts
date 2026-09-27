/**
 * A recorded shot's basket and grinder RPM, as a browser-side script string (no local imports,
 * so test/shot-extras.test.mjs can eval it directly).
 *
 * Neither has a schema field. Before the shot, the dashboard writes them into the live
 * workflow's context.extras, and Decaid saves that workflow onto the shot. Edit Shot writes
 * later changes into annotations.extras. So a value edited after the shot wins, and the
 * shot's own workflow.context.extras is the fallback (legacy grinderData.rpm last). Basket id
 * and name are taken as a pair from one source, never mixed.
 */
export const shotExtrasScript = `
function shotExtras(shot) {
  const wf = (shot && shot.workflow) || {};
  const cx = (wf.context && wf.context.extras) || {};
  const gd = wf.grinderData || {};
  const ax = (shot && shot.annotations && shot.annotations.extras) || {};
  const basket = ax.basketId != null || ax.basketName != null ? ax : cx;
  const rpm = ax.rpm != null ? ax.rpm : cx.rpm != null ? cx.rpm : gd.rpm;
  return {
    basketId:   basket.basketId   != null ? basket.basketId   : null,
    basketName: basket.basketName != null ? basket.basketName : null,
    rpm:        rpm != null ? rpm : null,
  };
}
`;
