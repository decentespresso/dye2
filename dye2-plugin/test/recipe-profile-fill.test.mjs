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
  const src = fn(page, 'function fillFromProfile(record)');

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
