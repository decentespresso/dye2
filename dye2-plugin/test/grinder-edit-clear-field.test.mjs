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

body = buildGrinderBody({ model: 'Niche Zero', burrs: '', burrType: '', notes: '', settingType: 'numeric' }, false);
assert.ok(!('burrs' in body), 'creating with an empty burrs field omits the key entirely');
assert.ok(!('burrType' in body), 'creating with an empty burrType field omits the key entirely');
assert.ok(!('notes' in body), 'creating with an empty notes field omits the key entirely');

body = buildGrinderBody({ model: 'Niche Zero', burrs: 'Stock 63mm', settingType: 'numeric' }, false);
assert.equal(body.burrs, 'Stock 63mm', 'creating with a filled-in burrs field sends it');

console.log('ok   grinders.ts: clearing a field on an existing grinder saves null, not the old value');
