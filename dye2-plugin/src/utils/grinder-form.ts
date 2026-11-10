/**
 * Pure request-body builder for the grinder add/edit form.
 *
 * Exported as a browser-side script string (same pattern as dev-api.ts / shot-paging.ts):
 * grinders.ts inlines it as a <script> block ahead of its own page script, and
 * test/grinder-edit-clear-field.test.mjs evals it directly — it has no local imports, so
 * (unlike a page module) Node can load it straight under --experimental-strip-types.
 *
 * PUT /api/v1/grinders/:id merges by key presence (rea_restapi.yml; reaprime's
 * grinders_handler.dart `_updateGrinder` spreads {...existing.toJson(), ...json}): an
 * omitted key preserves the current value, and only an explicit `null` clears a nullable
 * field. So on an edit, a field the user emptied must be sent as null, not left out, or
 * the old value silently survives the "save" (issue #9 — clearing Burrs reverted to the
 * old burr name). Creating a grinder has no old value to preserve, so empty fields are
 * simply left out of that request instead.
 *
 * `feedRate` here is a free-text note on the grinder record itself (e.g. "manual
 * FF/MF/SF" or "feeder RPM 0-3000") — a capability description, not a value. The
 * live per-shot feed rate is a separate field: `context.extras.feedRate` on the
 * workflow (see recorded-shot.ts / workflow-record.ts).
 *
 * The grinder record has no top-level slot for it — confirmed live against
 * localhost:8080: a `feedRate` key alongside `model`/`burrs` is silently dropped.
 * The only place custom data survives is `extras` (already used for `bcUuid` on
 * Beanconqueror imports), but `_updateGrinder`'s merge is a shallow
 * `{...existing.toJson(), ...json}` — sending `extras` replaces it wholesale, not
 * per-key, so a feedRate-only extras body wipes `bcUuid`. `buildGrinderBody` takes
 * the grinder's current `extras` and spreads it under the new one so other keys ride
 * along; the caller (grinders.ts) must pass the grinder being edited's `extras`.
 */
export const buildGrinderBodyScript = `
function buildGrinderBody(fields, isEdit, existingExtras) {
  const body = { model: fields.model || '' };
  ['burrs','burrType','notes'].forEach(k => { const v = fields[k]; if (v) body[k] = v; else if (isEdit) body[k] = null; });
  ['burrSize','rpmSmallStep','rpmBigStep'].forEach(k => { const v = fields[k]; if (v !== '' && v != null) body[k] = parseFloat(v); else if (isEdit) body[k] = null; });
  const st = fields.settingType || 'numeric';
  body.settingType = st;
  if (st === 'numeric') {
    ['settingSmallStep','settingBigStep'].forEach(k => { const v = fields[k]; if (v !== '' && v != null) body[k] = parseFloat(v); else if (isEdit) body[k] = null; });
  } else {
    const sv = fields.settingValues;
    if (sv) body.settingValues = sv.split(',').map(s => s.trim()).filter(Boolean);
    else if (isEdit) body.settingValues = null;
  }
  // Range and defaults live in extras for the same reason feedRate does: the grinder record
  // has no top-level slot for them. They are DYE2's own, and they are plain numbers -- a
  // blank field is null, which means "this grinder declares none", not zero.
  const ranged = ['settingMin','settingMax','settingDefault','rpmMin','rpmMax','rpmDefault'];
  const given = k => { const v = fields[k]; return v !== '' && v != null && !isNaN(parseFloat(v)); };
  const fr = fields.feedRate;
  if (fr || isEdit || ranged.some(given)) {
    body.extras = { ...(existingExtras || {}) };
    body.extras.feedRate = fr || null;
    // Same isEdit rule as every field above: on an edit a blank clears to an explicit null,
    // on a create it is simply absent rather than six nulls on a brand-new record.
    ranged.forEach(k => {
      if (given(k)) body.extras[k] = parseFloat(fields[k]);
      else if (isEdit) body.extras[k] = null;
    });
    // A preset grinder's positions are named: a numeric range over them is meaningless.
    if (st !== 'numeric') {
      ['settingMin','settingMax','settingDefault'].forEach(k => {
        if (isEdit) body.extras[k] = null; else delete body.extras[k];
      });
    }
  }
  return body;
}
`;

/**
 * The grinder's declared range and defaults, and the two things DYE2 does with them.
 *
 * They live in `extras` (see buildGrinderBody above): the grinder record has no top-level
 * slot, and extras is the documented place for custom data. A missing or non-numeric value
 * is null -- "this grinder declares none" -- never 0, which is a legitimate setting.
 *
 * grinderDefaultsPatch is what a MANUAL grinder change writes: picking a different grinder
 * invalidates the dial position, because a 7.5 on the Niche is not a 7.5 on the DF64. A
 * recipe apply never goes through here -- the recipe's own numbers win, and a recipe naming
 * no grind leaves it cleared rather than borrowing the grinder's default.
 */
export const grinderLimitsScript = `
function grinderLimits(g) {
  const e = (g && g.extras) || {};
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  return {
    settingMin: num(e.settingMin), settingMax: num(e.settingMax), settingDefault: num(e.settingDefault),
    rpmMin: num(e.rpmMin), rpmMax: num(e.rpmMax), rpmDefault: num(e.rpmDefault),
  };
}

// parseFloat, deliberately NOT used: a grind setting is free text on the host
// (WorkflowContext.grinderSetting is a String?), and parseFloat reads "15 clicks" as 15 and
// "1.1.0" as 1.1. Anything that is not plainly a number comes back exactly as it was typed.
function clampToRange(value, min, max) {
  const v = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() !== '' && isFinite(Number(value)) ? Number(value) : NaN);
  if (!isFinite(v)) return value;
  if (min != null && v < min) return min;
  if (max != null && v > max) return max;
  return v;
}

// The midpoint of a declared range, for a grinder that bounds a value but names no default:
// knowing where a grinder starts and stops is already saying the middle is a fair opening
// guess, so it beats carrying the previous grinder's number over. Needs BOTH bounds -- the
// middle of a range with one open end is not a number.
//
// Snapped to the grinder's own small step when it declares one, measured from min so it lands
// on that grinder's lattice: a grinder stepping in whole numbers from 1 to 10 opens at 6, not
// at an unreachable 5.5.
function midOfRange(min, max, step) {
  if (min == null || max == null) return null;
  let mid = (min + max) / 2;
  if (typeof step === 'number' && isFinite(step) && step > 0) {
    mid = min + Math.round((mid - min) / step) * step;
  }
  return clampToRange(Math.round(mid * 1000) / 1000, min, max);
}

function grinderDefaultsPatch(g) {
  const l = grinderLimits(g);
  const out = {};
  const setting = l.settingDefault != null
    ? clampToRange(l.settingDefault, l.settingMin, l.settingMax)
    : midOfRange(l.settingMin, l.settingMax, g && g.settingSmallStep);
  if (setting != null) out.grinderSetting = setting;
  const rpm = l.rpmDefault != null
    ? clampToRange(l.rpmDefault, l.rpmMin, l.rpmMax)
    : midOfRange(l.rpmMin, l.rpmMax, g && g.rpmSmallStep);
  if (rpm != null) out.rpm = rpm;
  return out;
}
`;
