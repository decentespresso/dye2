/**
 * recipe-edit: tapping a profile fills the variables, and a profileSnapshot is only usable
 * with steps in it. Run: npm test
 *
 * Both live in page strings, so the real source text is evaluated against a fake document —
 * the same trick test/workflow-record.test.mjs uses for the Machine Settings helpers.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const fn = (src, sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf('\n}\n', i) + 2); };

// ── usableProfileSnapshot (dev-api.ts) ──────────────────────────────────────
{
  const api = read('../src/utils/dev-api.ts');
  const usable = new Function(fn(api, 'function usableProfileSnapshot(p)') + '; return usableProfileSnapshot;')();

  assert.equal(usable(null), false, 'no snapshot');
  assert.equal(usable({}), false, 'no steps key');
  assert.equal(usable({ id: 'profile:x', title: 'Adaptive v2', steps: [] }), false,
    'the shape older rows carry: steps captured as an empty array is not a snapshot');
  assert.equal(usable({ steps: 'nope' }), false, 'steps must be an array');
  assert.equal(usable({ steps: [{ temperature: 93 }] }), true, 'one real step is enough');
  console.log('ok   usableProfileSnapshot: an empty steps array is not a usable snapshot');
}

// Every place that decides whether to trust a snapshot goes through that one helper, so the
// empty-array hole cannot be reopened one call site at a time.
{
  for (const path of ['../src/utils/dev-api.ts', '../src/pages/dashboard.ts',
                      '../src/pages/recipe-edit.ts', '../src/pages/auto-fav-edit.ts']) {
    const src = read(path);
    const loose = src.match(/Array\.isArray\(\s*[\w.]*[Ss]napshot[\w.]*\.steps\s*\)/g) || [];
    assert.deepEqual(loose, [], `${path} tests a snapshot's steps without the helper`);
    assert.ok(/usableProfileSnapshot\(/.test(src), `${path} should use usableProfileSnapshot`);
  }
  console.log('ok   no page re-implements the snapshot test');
}

// ── fillFromProfile (recipe-edit.ts) ────────────────────────────────────────
{
  const page = read('../src/pages/recipe-edit.ts');
  const src = fn(page, 'function profileYieldOf(prof)')
    + fn(page, 'function profileBrewCOf(prof)')
    + fn(page, 'function fillFromProfile(record)');

  const makeDom = (seed) => {
    const els = {};
    const el = (id) => (els[id] = els[id] || { id, textContent: seed[id] ?? '—', dataset: {} });
    for (const id of Object.keys(seed)) el(id);
    const presets = {
      're-drink-presets':    [{ dataset: { preset: '1:2.3', kind: 'ratio', for: 're-drink', basis: 're-dose' } }],
      're-steam-presets':    [{ dataset: { preset: '0.8ml/s', for: 're-steam' } }],
      're-flush-presets':    [{ dataset: { preset: '5s', for: 're-flush' } }],
      're-hotwater-presets': [{ dataset: { preset: '75ml', for: 're-hotwater' } }],
    };
    return {
      els,
      applied: [],
      document: {
        getElementById: (id) => (id in els || id.endsWith('-value') || id.endsWith('-sub') ? el(id) : null),
        querySelector: (sel) => {
          const m = /^#([\w-]+) \.dye-preset$/.exec(sel);
          return m && presets[m[1]] ? presets[m[1]][0] : null;
        },
      },
    };
  };

  const run = (profile, { seed = {}, ratio = null, steamMode = 'flow', hwMode = 'vol' } = {}) => {
    const dom = makeDom({ 're-dose-value': '—', 're-drink-value': '—', 're-brew-c-value': '—', ...seed });
    // The ratio the recipe already holds lives on the drink value's dataset, as applyPreset leaves it.
    if (ratio != null) dom.document.getElementById('re-drink-value').dataset.ratio = String(ratio);
    const recipe = { id: 'r1', dashboardVariables: {} };
    const MODE_CFG = {
      're-steam-mode':    { valueId: 're-steam-value',    field: { time: 'steamTimeS', flow: 'steamFlowMls' },
                            presets: { time: ['29s', '15s'], flow: ['0.8ml/s', '1ml/s'] } },
      're-hotwater-mode': { valueId: 're-hotwater-value', field: { vol: 'hotWaterMl', temp: 'hotWaterTempC' },
                            presets: { vol: ['75ml', '120ml'], temp: ['80°c', '85°c'] } },
    };
    new Function('document', 'recipe', 'set', 'syncPresetActive', 'applyPreset', 'renderPairSub',
                 'activeMode', 'MODE_CFG', src + '; fillFromProfile(arguments[8]);')(
      dom.document, recipe,
      (id, v) => { dom.document.getElementById(id).textContent = v ?? '—'; },
      (prefix, v) => dom.applied.push(['preset-active', prefix, v]),
      (btn) => dom.applied.push(['preset', btn.dataset.for, btn.dataset.preset]),
      () => {},
      (cls) => (cls === 're-steam-mode' ? steamMode : hwMode),
      MODE_CFG, profile,
    );
    const text = (id) => dom.els[id] && dom.els[id].textContent;
    return { text, dom, recipe };
  };

  // target_weight is the yield, steps[0] is the brew temperature, the dose follows at the ratio.
  let r = run({ profile: { target_weight: 36, target_volume: 36, steps: [{ temperature: 93 }] } });
  assert.equal(r.text('re-drink-value'), '36g', 'drink is the profile target weight');
  assert.equal(r.text('re-brew-c-value'), '93°c', 'brew is the first step');
  assert.equal(r.text('re-dose-value'), '15.5g', 'dose is 36 / 2.3, on the stepper 0.5 step');
  assert.equal(r.text('re-drink-sub'), '(1:2.3)', 'and the ratio sub says which ratio was used');

  // A yield of 0 means "not set": fall through to target_volume rather than filling 0g.
  r = run({ profile: { target_weight: 0, target_volume: 32, steps: [{ temperature: 100 }] } });
  assert.equal(r.text('re-drink-value'), '32g', 'target_weight 0 falls through to target_volume');
  assert.equal(r.text('re-dose-value'), '14g', '32 / 2.3 rounded to the 0.5 step');

  // Neither set: leave the two weights alone instead of writing zeros over them.
  r = run({ profile: { target_weight: 0, target_volume: 0, steps: [{ temperature: 90 }] } },
          { seed: { 're-dose-value': '18g', 're-drink-value': '36g' } });
  assert.equal(r.text('re-drink-value'), '36g', 'no yield in the profile leaves the drink alone');
  assert.equal(r.text('re-dose-value'), '18g', 'and the dose with it');
  assert.equal(r.text('re-brew-c-value'), '90°c', 'the brew temperature still lands');

  // The ratio the recipe already holds wins over the first chip.
  r = run({ profile: { target_weight: 40, steps: [{ temperature: 88 }] } }, { ratio: 2 });
  assert.equal(r.text('re-drink-value'), '40g', 'drink still comes from the profile');
  assert.equal(r.text('re-dose-value'), '20g', 'dose is 40 / 2, the recipe\'s own ratio');
  assert.equal(r.text('re-drink-sub'), '(1:2)', 'and the sub names that ratio, not 2.3');

  // Out-of-range step temperatures are clamped to the brew stepper's own 60..100.
  r = run({ profile: { target_weight: 36, steps: [{ temperature: 120 }] } });
  assert.equal(r.text('re-brew-c-value'), '100°c', 'clamped to the stepper maximum');
  r = run({ profile: { target_weight: 36, steps: [{ temperature: 20 }] } });
  assert.equal(r.text('re-brew-c-value'), '60°c', 'and to its minimum');

  // A profile with no steps at all: nothing to read a brew temperature from.
  r = run({ profile: { target_weight: 36, steps: [] } });
  assert.equal(r.text('re-brew-c-value'), '—', 'no steps, no brew temperature');

  // Steam / Flush / Hot Water take the first preset of their strip, through applyPreset itself.
  r = run({ profile: { target_weight: 36, steps: [{ temperature: 93 }] } });
  assert.deepEqual(r.dom.applied.filter(a => a[0] === 'preset'),
    [['preset', 're-steam', '0.8ml/s'], ['preset', 're-flush', '5s'], ['preset', 're-hotwater', '75ml']],
    'one applyPreset per strip, each the first chip');

  // And the half each mode hides takes the first preset of the other mode, so the sub-line
  // under the value is not blank either.
  assert.equal(r.recipe.dashboardVariables.steamTimeS, 29, 'flow mode: the hidden time is filled');
  assert.equal(r.recipe.dashboardVariables.hotWaterTempC, 80, 'vol mode: the hidden temp is filled');
  r = run({ profile: { target_weight: 36, steps: [{ temperature: 93 }] } }, { steamMode: 'time', hwMode: 'temp' });
  assert.equal(r.recipe.dashboardVariables.steamFlowMls, 0.8, 'time mode: the hidden flow is filled');
  assert.equal(r.recipe.dashboardVariables.hotWaterMl, 75, 'temp mode: the hidden volume is filled');

  console.log('ok   fillFromProfile: yield, brew temp, derived dose, zero guard, first presets');
}

// ── favouriteToRecipePatch (recipe-edit.ts) ─────────────────────────────────
// "Read From > From Favourite" should land everything the record holds: the snapshot first, the
// ready-to-PUT workflow behind it (an auto favourite's snapshot leaves out fields its
// workflow.context still carries), and the captured profile's first step as the brew temperature.
{
  const page = read('../src/pages/recipe-edit.ts');
  const api = read('../src/utils/dev-api.ts');
  const src = fn(page, 'function profileYieldOf(prof)')
    + fn(page, 'function profileBrewCOf(prof)')
    + fn(page, 'function profileTitleOf(snapshot, wfProfile)')
    + fn(page, 'function profileIdByTitle(title)')
    + fn(page, 'function libraryProfileById(id)')
    + fn(page, 'function favouriteToRecipePatch(fav)');
  const usable = fn(api, 'function usableProfileSnapshot(p)');

  const profiles = [
    { id: 'profile:lib', profile: { title: 'Blooming Allongé', target_weight: 36, steps: [{ temperature: 94 }] } },
    { id: 'profile:named', profile: { title: 'Adaptive v2', target_weight: 0, target_volume: 44, steps: [{ temperature: 93 }, { temperature: 91 }] } },
  ];
  const beans = [{ id: 'bean:red', name: 'Red Brick' }];
  const build = (fav, recipeName = '') => new Function(
    'beans', 'profiles', 'recipe', 'profileLabel', 'fav',
    usable + src + '; return favouriteToRecipePatch(fav);',
  )(beans, profiles, { name: recipeName }, (p) => (p.profile && p.profile.title) || p.title, fav);

  const steps = [{ name: 'pre', temperature: 95 }, { name: 'brew', temperature: 93 }];
  const auto = {
    title: 'Red Brick', auto: true,
    snapshot: { coffeeName: 'Red Brick', coffeeRoaster: 'Has Bean', profileTitle: 'Blooming Allongé', dose: 28, drink: 80 },
    workflow: { context: { grinderSetting: '20.00', targetDoseWeight: 28, targetYield: 80, extras: { rpm: 19, basketId: 'b1', basketName: 'ims' }, grinderId: 'g1', grinderModel: 'Niche Zero', baristaName: 'Mark' },
                profile: { title: 'Blooming Allongé', steps } },
  };

  let p = build(auto);
  assert.equal(p.dashboardVariables.brewC, 95, 'brew temperature is the captured profile first step');
  assert.equal(p.dashboardVariables.ratio, 2.9, 'ratio is derived from dose and drink (80/28)');
  assert.equal(p.dashboardVariables.grind, 20, 'grind falls back to workflow.context.grinderSetting');
  assert.equal(p.dashboardVariables.rpm, 19, 'rpm falls back to context extras');
  assert.equal(p.dashboardVariables.basketId, 'b1', 'so does the basket');
  assert.equal(p.dashboardVariables.grinderModel, 'Niche Zero', 'and the grinder model');
  assert.equal(p.barista, 'Mark', 'barista falls back to context baristaName');
  assert.equal(p.beanId, 'bean:red', 'the bean is matched by coffee name so its chip highlights');
  // Decaid drops profile.id, so a recorded profile arrives with a title and steps only.
  assert.equal(p.profileId, 'profile:lib', 'the id is recovered by matching the title in the library');
  assert.equal(p.profileSnapshot.steps.length, 2, 'the recorded profile is kept as the snapshot');
  assert.equal(p.name, 'Red Brick', 'a blank recipe takes the favourite title');
  assert.equal(build(auto, 'My own name').name, 'My own name', 'a named one keeps its name');

  // The snapshot's own profileSnapshot is what the contract says to apply, so it wins.
  p = build({ ...auto, snapshot: { ...auto.snapshot, profileSnapshot: { title: 'Own', steps: [{ temperature: 88 }] } } });
  assert.equal(p.profileSnapshot.title, 'Own', 'snapshot.profileSnapshot wins over workflow.profile');
  assert.equal(p.dashboardVariables.brewC, 88, 'and the brew temperature comes from it');

  // An empty steps array is not a profile: no snapshot, and nothing to read a brew temp from.
  p = build({ ...auto, workflow: { ...auto.workflow, profile: { title: 'T', id: 'profile:x', steps: [] } } });
  assert.equal(p.profileSnapshot, null, 'an empty steps array is not a usable snapshot');
  assert.equal(p.dashboardVariables.brewC, undefined, 'and gives no brew temperature');
  assert.equal(p.profileId, 'profile:x', 'the id on the stub is still worth keeping');

  // A favourite carries no steam / flush / hot water at all (its workflow is { context, profile? }).
  for (const k of ['steamFlowMls', 'steamTimeS', 'flushS', 'hotWaterMl', 'hotWaterTempC']) {
    assert.ok(!(k in build(auto).dashboardVariables), `${k} is not invented from a favourite`);
  }

  // No dose or drink anywhere: no ratio rather than a divide-by-zero.
  p = build({ title: 'T', snapshot: {}, workflow: { context: {} } });
  assert.equal(p.dashboardVariables.ratio, undefined, 'no ratio without both weights');
  assert.equal(p.dashboardVariables.dose, undefined, 'and no dose');

  console.log('ok   favouriteToRecipePatch: snapshot, workflow fallbacks, brew temp, recovered profile id');
}

// ── withDefaultVariables (recipe-edit.ts) ───────────────────────────────────
// A favourite record is often partial, so a read fills what it does not carry from each field's
// own first preset — read off the chips, not a second copy of the numbers.
{
  const page = read('../src/pages/recipe-edit.ts');
  const src = fn(page, 'function withDefaultVariables(dv)');

  const chips = {
    're-dose-presets':     '20g',
    're-drink-presets':    '1:2.3',
    're-brew-c-presets':   '75°c',
    're-flush-presets':    '5s',
  };
  const MODE_CFG = {
    're-steam-mode':    { field: { time: 'steamTimeS', flow: 'steamFlowMls' },
                          presets: { time: ['29s', '15s'], flow: ['0.8ml/s', '1ml/s'] } },
    're-hotwater-mode': { field: { vol: 'hotWaterMl', temp: 'hotWaterTempC' },
                          presets: { vol: ['75ml', '120ml'], temp: ['80°c', '85°c'] } },
  };
  const defaults = (dv, { steamMode = 'flow', hwMode = 'vol' } = {}) => new Function(
    'document', 'MODE_CFG', 'activeMode', 'dv',
    src + '; return withDefaultVariables(dv);',
  )({ querySelector: (sel) => { const m = /^#([\w-]+) \.dye-preset$/.exec(sel);
        return m && chips[m[1]] ? { dataset: { preset: chips[m[1]] } } : null; } },
    MODE_CFG, (cls) => (cls === 're-steam-mode' ? steamMode : hwMode), dv);

  let d = defaults({});
  assert.equal(d.dose, 20, 'dose takes the first dose chip');
  assert.equal(d.drink, 46, 'the drink strip holds ratios, so its default is 20g at 1:2.3');
  assert.equal(d.ratio, 2.3, 'and the ratio is recorded with it');
  assert.equal(d.brewC, 75, 'brew temperature takes its first chip');
  assert.equal(d.flushS, 5, 'flush too');
  assert.deepEqual([d.steamFlowMls, d.steamTimeS], [0.8, 29], 'both halves of the steam pair');
  assert.deepEqual([d.hotWaterMl, d.hotWaterTempC], [75, 80], 'and of the hot water pair');
  // Filling both halves would otherwise move the tile, since renderRecipe infers the mode from
  // whichever half is held.
  assert.deepEqual([d.steamMode, d.hotWaterMode], ['flow', 'vol'], 'the modes on screen are pinned');
  d = defaults({}, { steamMode: 'time', hwMode: 'temp' });
  assert.deepEqual([d.steamMode, d.hotWaterMode], ['time', 'temp'], 'whichever they are');

  // Grind and RPM have no strip, so there is no default to take.
  assert.ok(!('grind' in defaults({})) && !('rpm' in defaults({})), 'grind and rpm stay blank');

  // What the record did carry is never overwritten.
  d = defaults({ dose: 28, drink: 80, brewC: 95, flushS: 17, steamFlowMls: 16, hotWaterMl: 15 });
  assert.deepEqual(
    [d.dose, d.drink, d.brewC, d.flushS, d.steamFlowMls, d.hotWaterMl],
    [28, 80, 95, 17, 16, 15], 'values from the record survive');
  assert.equal(d.ratio, 2.9, 'a missing ratio is still derived from the pair that is there');
  assert.equal(d.steamTimeS, 29, 'and the half the record lacks is still defaulted');

  // A dose with no drink: the ratio chip is applied against that dose, not the default dose.
  d = defaults({ dose: 10 });
  assert.equal(d.drink, 23, '10g at 1:2.3');

  console.log('ok   withDefaultVariables: first preset per field, record values untouched');
}

// ── fattenFavouriteProfile (dev-api.ts) ─────────────────────────────────────
// The writer side of the same rule: a favourite must never be stored with a profile in name
// only. Decaid drops profile.id, so a snapshot taken off the live workflow has no id to resolve
// later; a thin { id, title } would deep-merge into whatever profile is loaded on apply instead
// of replacing it, and KV rows outlive the library anyway.
{
  const api = read('../src/utils/dev-api.ts');
  const src = fn(api, 'function usableProfileSnapshot(p)')
    + fn(api, 'async function fattenFavouriteProfile(fav)');

  const full = (title, temp) => ({ title, target_weight: 36, steps: [{ name: 's', temperature: temp }] });
  const library = [
    { id: 'profile:a', profile: full('Adaptive v2', 93) },
    { id: 'profile:dup', profile: full('Adaptive v2', 93) },      // titles are not unique
    { id: 'profile:stub', profile: { title: 'Stubbed', steps: [] } },
    { id: 'profile:other', profile: full('D-Flow / default', 88) },
  ];
  const fatten = async (fav, { resolvesById = null, profiles = library, throws = false } = {}) => {
    const calls = { byId: [], listed: 0 };
    const run = new Function('usableProfileSnapshot_unused', 'resolveFullProfileById', 'getProfiles', 'console', 'fav',
      src + '; return fattenFavouriteProfile(fav);');
    await run(null,
      async (id) => { calls.byId.push(id); return resolvesById; },
      async () => { calls.listed += 1; if (throws) throw new Error('offline'); return profiles; },
      { warn: () => {} }, fav);
    return { fav, calls };
  };

  // Already whole: nothing is resolved, nothing is touched.
  let kept = { snapshot: { profileId: 'profile:a', profileTitle: 'Adaptive v2', profileSnapshot: full('Adaptive v2', 93) } };
  let r = await fatten(kept);
  assert.deepEqual([r.calls.byId.length, r.calls.listed], [0, 0], 'a whole snapshot resolves nothing');

  // An id that resolves fills the snapshot from the library record.
  r = await fatten({ snapshot: { profileId: 'profile:a', profileTitle: 'Adaptive v2', profileSnapshot: null } },
                   { resolvesById: full('Adaptive v2', 93) });
  assert.equal(r.fav.snapshot.profileSnapshot.steps.length, 1, 'the resolved record becomes the snapshot');
  assert.deepEqual(r.calls.byId, ['profile:a'], 'resolved by id');
  assert.equal(r.calls.listed, 0, 'and the title lookup is not needed');

  // The real case on this tablet: a title and nothing else. The id is backfilled.
  r = await fatten({ snapshot: { profileId: null, profileTitle: 'Adaptive v2', profileSnapshot: null } });
  assert.equal(r.fav.snapshot.profileSnapshot.steps[0].temperature, 93, 'resolved by title');
  assert.equal(r.fav.snapshot.profileId, 'profile:a', 'and the missing id is filled from the match');
  assert.deepEqual(r.calls.byId, [], 'with no id there is nothing to resolve by id');

  // An id that no longer resolves still falls through to the title.
  r = await fatten({ snapshot: { profileId: 'profile:gone', profileTitle: 'D-Flow / default', profileSnapshot: null } },
                   { resolvesById: null });
  assert.equal(r.fav.snapshot.profileSnapshot.steps[0].temperature, 88, 'the title rescues a dead id');
  assert.equal(r.fav.snapshot.profileId, 'profile:gone', 'but an id the caller gave is never overwritten');

  // A library row with no steps is not a profile, so it is not stored.
  r = await fatten({ snapshot: { profileId: null, profileTitle: 'Stubbed', profileSnapshot: null } });
  assert.equal(r.fav.snapshot.profileSnapshot, null, 'an empty-steps library row is not used');
  assert.equal(r.fav.snapshot.profileId, null, 'and no id is invented from it');

  // Nothing matches, and a failed fetch: leave the row alone rather than throw mid-write.
  r = await fatten({ snapshot: { profileId: null, profileTitle: 'Never Heard Of It', profileSnapshot: null } });
  assert.equal(r.fav.snapshot.profileSnapshot, null, 'an unknown title leaves the snapshot null');
  r = await fatten({ snapshot: { profileId: null, profileTitle: 'Adaptive v2', profileSnapshot: null } }, { throws: true });
  assert.equal(r.fav.snapshot.profileSnapshot, null, 'a failed profile fetch does not break the write');

  // A favourite with no snapshot at all is not a crash.
  await fatten({});
  await fatten({ snapshot: null });

  console.log('ok   fattenFavouriteProfile: by id, by title, id backfill, stubs and failures');
}

// ── workflowToRecipePatch + "Save as Recipe" from edit-shot (recipe-edit.ts / edit-shot.ts) ──
// A favourite and a recent have no save target, so promoting the shot is the only way to keep a
// dial-in from one. edit-shot hands recipe-edit the shot's RECORDED workflow and the same mapper
// Read From > Current Workflow uses reads it, so the two can never drift apart.
{
  const edit = read('../src/pages/recipe-edit.ts');
  const shot = read('../src/pages/edit-shot.ts');
  const grinders = [{ id: 'g1', model: 'Niche Zero' }, { id: 'g2', model: 'C40' }];
  // usableProfileSnapshot reaches the page from devApiScript, so inject the real one.
  const usableSrc = fn(read('../src/utils/dev-api.ts'), 'function usableProfileSnapshot(p)');
  const toPatch = new Function('grinders',
    usableSrc + fn(edit, 'function workflowToRecipePatch(wf)') + '; return workflowToRecipePatch;')(grinders);

  const wf = {
    profile: { id: 'profile:x', title: 'Adaptive v2', steps: [{ temperature: 92 }] },
    context: {
      targetDoseWeight: 18.5, targetYield: 37, grinderSetting: '4.2',
      baristaName: 'Mark', drinkerName: 'John', grinderModel: 'C40',
      extras: { rpm: 75, basketId: 'b1', basketName: '18g VST' },
    },
  };
  const p = toPatch(wf);
  assert.equal(p.profileId, 'profile:x');
  assert.equal(p.profileTitle, 'Adaptive v2');
  assert.equal(p.profileSnapshot.steps[0].temperature, 92, 'a recorded profile with steps is captured');
  assert.deepEqual(p.dashboardVariables,
    { dose: 18.5, drink: 37, grind: '4.2', rpm: 75, grinderId: 'g2', basketId: 'b1', basketName: '18g VST' },
    'the grinder is resolved by model when the shot carries no id');
  assert.equal(p.barista, 'Mark');
  assert.equal(p.drinker, 'John');

  // A thin recorded profile is not a snapshot, and an empty workflow is not a crash.
  assert.equal(toPatch({ profile: { id: 'p', title: 'T', steps: [] }, context: {} }).profileSnapshot, null,
    'steps captured as an empty array is not a usable snapshot');
  assert.equal(toPatch(null).profileId, null);
  assert.deepEqual(toPatch({}).dashboardVariables.dose, undefined);

  // readFromWorkflow must stay a thin wrapper over it, or the live and recorded paths diverge.
  assert.match(fn(edit, 'async function readFromWorkflow()'), /return workflowToRecipePatch\(await getWorkflow\(\)/);

  // The handoff: edit-shot stashes the recorded workflow, recipe-edit consumes it once.
  const handler = shot.slice(shot.indexOf("getElementById('es-save-recipe-btn')"));
  const body = handler.slice(0, handler.indexOf('\n  });'));
  assert.match(body, /setItem\('dye_recipeFromShotWf', JSON\.stringify\(currentShot\.workflow/,
    'the shot as edited on the page is what gets promoted');
  assert.match(body, /setItem\('dye_recipeEditBack', 'edit-shot'\)/, 'and leaving the recipe comes back here');
  assert.match(body, /goToPicker\('recipe-edit\?new=1'\)/,
    'reuses the stash-and-navigate that keeps the unsaved shot');
  assert.ok(shot.includes('id="es-save-recipe-btn"'), 'the button exists in the footer');

  const seed = edit.slice(edit.indexOf("sessionStorage.getItem('dye_recipeFromShotWf')"));
  assert.match(seed.slice(0, 400), /removeItem\('dye_recipeFromShotWf'\)/,
    'consumed once, so a later blank recipe is not seeded from a stale shot');
  assert.match(seed.slice(0, 400), /workflowToRecipePatch\(JSON\.parse\(shotWfRaw\)\)/);
  assert.ok(edit.indexOf("getItem('dye_selectedAutoFavId')") < edit.indexOf("getItem('dye_recipeFromShotWf')"),
    'after the favourite seed, so an explicit shot seed wins');

  console.log('ok   workflowToRecipePatch: shared by the live read and edit-shot\'s Save as Recipe');
}
