/**
 * Values a recorded shot can carry in two places — set before the shot, or edited after it —
 * as a browser-side script string (no local imports, so test/recorded-shot.test.mjs can eval
 * it directly). Every page reading a recorded shot's basket, RPM or drinker note goes through
 * these, so the dashboard and Edit Shot never disagree.
 *
 * Before the shot, the dashboard writes into the live workflow's context.extras, and Decaid
 * saves that workflow onto the shot. Edit Shot writes later changes into annotations. So a
 * value edited after the shot wins, and the shot's own workflow.context.extras is the fallback.
 *
 * Basket and RPM have no schema field (annotations.extras; legacy grinderData.rpm last).
 * Basket id and name are taken as a pair from one source, never mixed.
 */
export const recordedShotScript = `
function shotBasketRpm(shot) {
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

// The shot's context.extras with the resolved basket and RPM folded in, for copying the shot
// back into the live workflow. undefined when the shot has nothing to copy.
function shotWorkflowExtras(shot) {
  const wf = (shot && shot.workflow) || {};
  const src = wf.context && wf.context.extras;
  const r = shotBasketRpm(shot);
  const hasBasket = r.basketId != null || r.basketName != null;
  if (!src && r.rpm == null && !hasBasket) return undefined;
  const out = { ...(src || {}) };
  if (r.rpm != null) out.rpm = r.rpm;
  if (hasBasket) { out.basketId = r.basketId; out.basketName = r.basketName; }
  return out;
}

// The drinker note (annotations.espressoNotes), falling back to a note attached before the
// shot (workflow.context.extras.note). Only a missing or null annotation falls back: an empty
// string is an intentional clear, not a missing note.
function shotNote(shot) {
  const ctx = (shot && shot.workflow && shot.workflow.context) || {};
  return (shot && shot.annotations && shot.annotations.espressoNotes) ?? (ctx.extras && ctx.extras.note) ?? '';
}

// The annotations.espressoNotes value to save from the note editor. An emptied editor saves
// '', never null or an omitted key: shotNote() falls back past null, so the pre-shot note
// would come back. (Grinder fields clear with null instead — a different resource.)
function noteToSave(text) {
  return (text || '').trim();
}
`;
