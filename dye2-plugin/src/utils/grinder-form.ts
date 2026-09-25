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
 */
export const buildGrinderBodyScript = `
function buildGrinderBody(fields, isEdit) {
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
  return body;
}
`;
