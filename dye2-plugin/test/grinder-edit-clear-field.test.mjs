/**
 * Regression check for issue #9 (inkee08): clearing the Burrs field on an existing
 * grinder and saving reverted to the old value instead of clearing it.
 *
 * Root cause: PUT /api/v1/grinders/:id merges by key presence (see rea_restapi.yml
 * and reaprime's grinders_handler.dart `_updateGrinder`, which spreads
 * {...existing.toJson(), ...json}) — an omitted key preserves the current value,
 * only an explicit `null` clears a nullable field. grinders.ts's submitForm() only
 * ever set a key when the form value was truthy, so an emptied field was dropped
 * from the request body and the old value survived the "save".
 *
 * Run: npm test   (node --experimental-strip-types, so the .ts import works)
 */
import assert from 'node:assert/strict';
import { buildGrinderBodyScript } from '../src/utils/grinder-form.ts';

const { buildGrinderBody } = new Function(buildGrinderBodyScript + '\nreturn { buildGrinderBody };')();

// --- editing an existing grinder (isEdit = true): emptied fields must clear ---

let body = buildGrinderBody({ model: 'P64', burrs: '', settingType: 'numeric' }, true);
assert.equal(body.burrs, null, 'clearing burrs on an edit sends explicit null, not an omitted key');

body = buildGrinderBody({ model: 'P64', burrs: 'MP', settingType: 'numeric' }, true);
assert.equal(body.burrs, 'MP', 'a non-empty burrs value is still sent as-is');

body = buildGrinderBody({ model: 'P64', burrType: '', notes: '', settingType: 'numeric' }, true);
assert.equal(body.burrType, null, 'clearing burrType on an edit sends explicit null');
assert.equal(body.notes, null, 'clearing notes on an edit sends explicit null');

// feedRate has no top-level slot on the grinder record -- it rides in `extras`, which the
// host replaces wholesale on PUT (reaprime's grinders_handler.dart `_updateGrinder` does a
// shallow {...existing.toJson(), ...json} merge). So the caller must pass the grinder's
// current extras through, or an unrelated key there (e.g. a Beanconqueror `bcUuid`) is wiped.

body = buildGrinderBody({ model: 'P64', feedRate: '', settingType: 'numeric' }, true, { bcUuid: 'abc' });
assert.deepEqual(body.extras, { bcUuid: 'abc', feedRate: null, settingMin: null, settingMax: null, settingDefault: null, rpmMin: null, rpmMax: null, rpmDefault: null }, 'clearing feedRate on an edit sends explicit null, preserving other extras keys; blank range fields clear the same way');

body = buildGrinderBody({ model: 'P64', feedRate: 'FF/MF/SF', settingType: 'numeric' }, true, { bcUuid: 'abc' });
assert.deepEqual(body.extras, { bcUuid: 'abc', feedRate: 'FF/MF/SF', settingMin: null, settingMax: null, settingDefault: null, rpmMin: null, rpmMax: null, rpmDefault: null }, 'a non-empty feedRate value is sent as-is, preserving other extras keys');

body = buildGrinderBody({ model: 'P64', settingType: 'numeric' }, true);
assert.deepEqual(body.extras, { feedRate: null, settingMin: null, settingMax: null, settingDefault: null, rpmMin: null, rpmMax: null, rpmDefault: null }, 'an edit with no feedRate and no prior extras still clears it explicitly');

body = buildGrinderBody({ model: 'P64', burrSize: '', rpmSmallStep: '', rpmBigStep: '', settingType: 'numeric' }, true);
assert.equal(body.burrSize, null, 'clearing a numeric field on an edit sends explicit null');
assert.equal(body.rpmSmallStep, null, 'clearing rpmSmallStep on an edit sends explicit null');
assert.equal(body.rpmBigStep, null, 'clearing rpmBigStep on an edit sends explicit null');

body = buildGrinderBody({ model: 'P64', settingType: 'numeric', settingSmallStep: '', settingBigStep: '' }, true);
assert.equal(body.settingSmallStep, null, 'clearing settingSmallStep on an edit sends explicit null');
assert.equal(body.settingBigStep, null, 'clearing settingBigStep on an edit sends explicit null');

body = buildGrinderBody({ model: 'Encore', settingType: 'preset', settingValues: '' }, true);
assert.equal(body.settingValues, null, 'clearing settingValues on an edit sends explicit null');

// --- creating a new grinder (isEdit = false): there's nothing to preserve, so ---
// --- empty optional fields are simply left out of the body, as before.       ---

body = buildGrinderBody({ model: 'Niche Zero', burrs: '', burrType: '', feedRate: '', notes: '', settingType: 'numeric' }, false);
assert.ok(!('burrs' in body), 'creating with an empty burrs field omits the key entirely');
assert.ok(!('burrType' in body), 'creating with an empty burrType field omits the key entirely');
assert.ok(!('extras' in body), 'creating with an empty feedRate field omits extras entirely');
assert.ok(!('notes' in body), 'creating with an empty notes field omits the key entirely');

body = buildGrinderBody({ model: 'Niche Zero', burrs: 'Stock 63mm', settingType: 'numeric' }, false);
assert.equal(body.burrs, 'Stock 63mm', 'creating with a filled-in burrs field sends it');

body = buildGrinderBody({ model: 'Niche Zero', feedRate: 'FF', settingType: 'numeric' }, false);
assert.deepEqual(body.extras, { feedRate: 'FF' }, 'creating with a filled-in feedRate field sends it under extras');

console.log('ok   grinders.ts: clearing a field on an existing grinder saves null, not the old value');

// --- range + defaults (extras), and what a manual grinder change writes ---------------

import { grinderLimitsScript } from '../src/utils/grinder-form.ts';
const { grinderLimits, clampToRange, grinderDefaultsPatch } =
  new Function(grinderLimitsScript + '\nreturn { grinderLimits, clampToRange, grinderDefaultsPatch };')();

// They ride in extras, alongside feedRate, and a blank field is null -- "declares none".
body = buildGrinderBody({ model: 'P64', settingType: 'numeric', settingMin: '0', settingMax: '50', settingDefault: '7.5', rpmMin: '300', rpmMax: '1400', rpmDefault: '900' }, true, { bcUuid: 'keep-me' });
assert.equal(body.extras.settingMin, 0, 'a min of 0 survives -- 0 is a real setting, not an absence');
assert.equal(body.extras.settingMax, 50);
assert.equal(body.extras.settingDefault, 7.5);
assert.equal(body.extras.rpmDefault, 900);
assert.equal(body.extras.bcUuid, 'keep-me', 'other extras keys ride along, as feedRate already required');

body = buildGrinderBody({ model: 'P64', settingType: 'numeric', settingMin: '', settingDefault: 'abc' }, true);
assert.equal(body.extras.settingMin, null, 'an emptied range field clears to null, never 0');
assert.equal(body.extras.settingDefault, null, 'junk is not a number');

// A preset grinder's positions are named, so a numeric range over them means nothing.
body = buildGrinderBody({ model: 'HG-1', settingType: 'preset', settingValues: 'Fine, Medium', settingMin: '1', settingMax: '9', settingDefault: '5', rpmMin: '300' }, true);
assert.equal(body.extras.settingMin, null, 'a preset grinder stores no setting range');
assert.equal(body.extras.settingDefault, null);
assert.equal(body.extras.rpmMin, 300, 'rpm is independent of the setting type');

// grinderLimits: only finite numbers count, everything else is "declares none".
let l = grinderLimits({ extras: { settingMin: 0, settingMax: '50', rpmDefault: 900, rpmMin: null } });
assert.equal(l.settingMin, 0);
assert.equal(l.settingMax, null, 'a string is not a declared bound');
assert.equal(l.rpmDefault, 900);
assert.equal(grinderLimits(null).settingDefault, null, 'no grinder declares nothing');
assert.equal(grinderLimits({}).rpmMax, null);

// clamping
assert.equal(clampToRange(5, 10, 20), 10);
assert.equal(clampToRange(25, 10, 20), 20);
assert.equal(clampToRange(15, 10, 20), 15);
assert.equal(clampToRange(5, null, null), 5, 'no bounds, no change');
assert.equal(clampToRange(5, null, 20), 5, 'a max alone does not impose a floor');
assert.equal(clampToRange('15 clicks', 0, 10), '15 clicks', 'free text is returned as typed, never coerced');
assert.equal(clampToRange('7.5', 0, 50), 7.5, 'a numeric string is a number');

// grinderDefaultsPatch: what a MANUAL grinder change carries over.
assert.deepEqual(grinderDefaultsPatch({ extras: { settingDefault: 7.5, rpmDefault: 900 } }),
  { grinderSetting: 7.5, rpm: 900 });
assert.deepEqual(grinderDefaultsPatch({ extras: { settingDefault: 7.5 } }), { grinderSetting: 7.5 },
  'a grinder declaring only one default writes only that one');
assert.deepEqual(grinderDefaultsPatch({ extras: {} }), {},
  'a grinder declaring no defaults and no range leaves the live values alone');

// Bounds but no default: the middle of the range is the opening guess, which still beats
// carrying the previous grinder's number over.
assert.deepEqual(grinderDefaultsPatch({ extras: { settingMin: 0, settingMax: 50 } }),
  { grinderSetting: 25 }, 'no setting default: the midpoint');
assert.deepEqual(grinderDefaultsPatch({ extras: { rpmMin: 300, rpmMax: 1400 } }),
  { rpm: 850 }, 'no rpm default: the midpoint');
assert.deepEqual(grinderDefaultsPatch({ extras: { settingMin: 0, settingMax: 50, settingDefault: 7.5 } }),
  { grinderSetting: 7.5 }, 'a declared default always wins over the midpoint');
assert.deepEqual(grinderDefaultsPatch({ extras: { settingMin: 0, settingMax: 50, rpmMin: 300, rpmMax: 1400, rpmDefault: 900 } }),
  { grinderSetting: 25, rpm: 900 }, 'each value falls back on its own');
// One open end is not a range: there is no middle of it.
assert.deepEqual(grinderDefaultsPatch({ extras: { settingMin: 0 } }), {});
assert.deepEqual(grinderDefaultsPatch({ extras: { settingMax: 50 } }), {});
// Snapped to the grinder's own step, measured from min, so the opening value is reachable.
assert.deepEqual(grinderDefaultsPatch({ settingSmallStep: 1, extras: { settingMin: 1, settingMax: 10 } }),
  { grinderSetting: 6 }, 'a whole-number grinder opens on a whole number, not 5.5');
assert.deepEqual(grinderDefaultsPatch({ settingSmallStep: 0.5, extras: { settingMin: 0, settingMax: 9 } }),
  { grinderSetting: 4.5 });
assert.deepEqual(grinderDefaultsPatch({ rpmSmallStep: 50, extras: { rpmMin: 300, rpmMax: 1400 } }),
  { rpm: 850 });
assert.deepEqual(grinderDefaultsPatch({ settingSmallStep: 3, extras: { settingMin: 0, settingMax: 4 } }),
  { grinderSetting: 3 }, 'a snap that would overshoot is clamped back into the range');
assert.deepEqual(grinderDefaultsPatch(null), {});
assert.deepEqual(grinderDefaultsPatch({ extras: { settingDefault: 99, settingMin: 0, settingMax: 50 } }),
  { grinderSetting: 50 }, 'a default outside its own range is clamped, not written as typed');
assert.deepEqual(grinderDefaultsPatch({ extras: { settingDefault: 0, settingMin: 0, settingMax: 50 } }),
  { grinderSetting: 0 }, 'a default of 0 is a real default, not an absence');

console.log('ok   grinder range, defaults and clamping');
