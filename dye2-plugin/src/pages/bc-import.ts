import { devPageShell } from "../utils/dev-shell";
import { devApiScript } from "../utils/dev-api";
import { bcMapScript } from "../utils/bc-map";
import { pickerHeaderHtml } from "../utils/shared-components";

const styles = `
  .bc-panel {
    border: 2px solid var(--profile-button-outline-color);
    border-radius: 15px;
    background: var(--box-color);
    padding: 24px;
  }
  .bc-label {
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 24px;
    color: var(--mimoja-blue); margin-bottom: 12px;
  }
  .bc-hint { font-size: 20px; line-height: 1.5; color: var(--low-contrast-white); }
  .bc-textarea {
    width: 100%; height: 300px; resize: none; padding: 16px;
    border: 2px solid var(--profile-button-outline-color); border-radius: 15px;
    font-family: monospace; font-size: 18px; color: var(--text-primary);
    background: transparent; outline: none;
  }
  .bc-file-btn {
    display: inline-flex; align-items: center; justify-content: center;
    height: 82px; padding: 0 40px; border-radius: 68px;
    border: 2px solid var(--mimoja-blue); color: var(--mimoja-blue);
    font-weight: 700; font-size: 24px; cursor: pointer;
  }
  .bc-report {
    height: 100%; overflow-y: auto; font-size: 20px; line-height: 1.6;
    color: var(--text-primary); white-space: pre-wrap; word-break: break-word;
  }
  .bc-report .bc-add  { color: #2E7D32; }
  .bc-report .bc-upd  { color: var(--mimoja-blue); }
  .bc-report .bc-skip { color: var(--low-contrast-white); }
  .bc-report .bc-err  { color: var(--danger); }
`;

const content = `
<div class="bg-[var(--bgmain-color)] overflow-hidden flex-grow flex flex-col">
  ${pickerHeaderHtml("Import from Beanconqueror", "IMPORT")}
  <div class="flex flex-1 overflow-hidden gap-[30px] p-[30px]">
    <div class="bc-panel flex flex-col gap-[20px] w-[820px] shrink-0">
      <div>
        <div class="bc-label">1. Get the file</div>
        <div class="bc-hint">
          In Beanconqueror: Settings &rarr; Export. Unzip the backup and take
          <b>Beanconqueror.json</b> (plus <b>Beanconqueror_Beans_0.json</b> if your export
          was split into chunks).
        </div>
      </div>
      <div>
        <div class="bc-label">2. Load it here</div>
        <label class="bc-file-btn">
          CHOOSE FILE
          <input id="bc-file" type="file" accept=".json,application/json" class="hidden">
        </label>
        <span id="bc-file-name" class="bc-hint ml-[16px]"></span>
      </div>
      <div class="flex flex-col flex-1 min-h-0">
        <div class="bc-label">…or paste the JSON</div>
        <textarea id="bc-text" class="bc-textarea" placeholder="{ &quot;BEANS&quot;: [ … ] }" spellcheck="false"></textarea>
      </div>
    </div>
    <div class="bc-panel flex-1 min-w-0">
      <div id="bc-report" class="bc-report">Nothing loaded yet.</div>
    </div>
  </div>
</div>
`;

const pageScript = `
${bcMapScript}

let bcPlan = null;
let bcImporting = false;

function bcEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bcLine(cls, text) { return '<div class="' + cls + '">' + bcEsc(text) + '</div>'; }

function bcSetReport(html) { document.getElementById('bc-report').innerHTML = html; }

function bcEnableImport(on) {
  const btn = document.getElementById('dye-confirm-btn');
  if (!btn) return;
  btn.disabled = !on;
  btn.classList.toggle('opacity-50', !on);
}

/** Only fill DYE2 fields that are still empty — a hand-edited bean never loses data
    to Beanconqueror, which matters because this page gets re-run on every backup. */
function bcFillEmptyPatch(existing, incoming) {
  const patch = {};
  Object.keys(incoming).forEach(function (k) {
    if (k === 'decaf' || k === 'roaster' || k === 'name') return;
    const cur = existing[k];
    const empty = cur == null || cur === '' || (Array.isArray(cur) && cur.length === 0);
    if (empty && incoming[k] != null) patch[k] = incoming[k];
  });
  return patch;
}

function bcBatchCreatePayload(batch) {
  // POST /beans/:id/batches accepts neither archived nor weightRemaining — those go
  // in a follow-up PUT (see bcRunImport).
  const p = Object.assign({}, batch);
  delete p.archived;
  delete p.weightRemaining;
  return p;
}

function bcBatchUpdatePayload(batch) {
  // weightRemaining is left alone on update: the tablet decrements it per shot, and
  // Beanconqueror's own idea of what is left is staler than that.
  const p = Object.assign({}, batch);
  delete p.weightRemaining;
  return p;
}

async function bcBuildPlan(json) {
  const groups = bcMapBeans(json);
  const mills = bcMapMills(json);
  const equipment = bcMapEquipment(json);

  const existingBeans = await getBeans(true);
  const beanByKey = {};
  existingBeans.forEach(function (b) { beanByKey[bcBeanKey(b.roaster, b.name)] = b; });

  // Batches are matched on the Beanconqueror uuid we stored in extras on a previous run.
  const batchByUuid = {};
  await Promise.all(existingBeans.map(async function (b) {
    // includeArchived matters: a finished bag is archived, and if it is not listed here
    // its bcUuid goes unmatched and the next import re-creates it as a duplicate.
    const batches = await getBeanBatches(b.id, true).catch(function () { return []; });
    (Array.isArray(batches) ? batches : []).forEach(function (bt) {
      const uuid = bt.extras && bt.extras.bcUuid;
      if (uuid) batchByUuid[uuid] = bt;
    });
  }));

  const existingGrinders = await getGrinders(true);
  const grinderModels = new Set(existingGrinders.map(function (g) { return String(g.model || '').trim().toLowerCase(); }));

  const plan = { beans: [], grinders: [], equipment: equipment, counts: { beanNew: 0, beanUpd: 0, batchNew: 0, batchUpd: 0, grinderNew: 0 } };

  groups.forEach(function (g) {
    const existing = beanByKey[g.key] || null;
    const patch = existing ? bcFillEmptyPatch(existing, g.bean) : {};
    if (!existing) plan.counts.beanNew++;
    else if (Object.keys(patch).length) plan.counts.beanUpd++;
    const batches = g.batches.map(function (batch) {
      const match = batchByUuid[batch.extras.bcUuid] || null;
      if (match) plan.counts.batchUpd++; else plan.counts.batchNew++;
      return { payload: batch, batchId: match ? match.id : null };
    });
    plan.beans.push({ key: g.key, bean: g.bean, beanId: existing ? existing.id : null, patch: patch, batches: batches });
  });

  mills.forEach(function (m) {
    if (grinderModels.has(m.model.trim().toLowerCase())) return;
    plan.counts.grinderNew++;
    plan.grinders.push(m);
  });

  return plan;
}

function bcRenderPlan(plan) {
  const c = plan.counts;
  let out = '<div class="bc-label">Ready to import</div>';
  out += bcLine('bc-add', '+ ' + c.beanNew + ' new beans, ' + c.batchNew + ' new batches');
  out += bcLine('bc-upd', '~ ' + c.beanUpd + ' beans get missing fields filled, ' + c.batchUpd + ' batches refreshed');
  out += bcLine('bc-add', '+ ' + c.grinderNew + ' new grinders');
  out += bcLine('bc-skip', '· ' + plan.equipment.length + ' preparation setups (baskets, drippers) stored as reference data');
  out += '<div style="height:16px"></div>';
  plan.beans.forEach(function (g) {
    const mark = g.beanId ? (Object.keys(g.patch).length ? '~' : '·') : '+';
    const cls = mark === '+' ? 'bc-add' : (mark === '~' ? 'bc-upd' : 'bc-skip');
    out += bcLine(cls, mark + ' ' + g.bean.roaster + ' — ' + g.bean.name + '  (' + g.batches.length + ' batch' + (g.batches.length === 1 ? '' : 'es') + ')');
  });
  plan.grinders.forEach(function (g) { out += bcLine('bc-add', '+ grinder: ' + g.model); });
  return out;
}

async function bcAnalyse(text, sourceName) {
  bcPlan = null;
  bcEnableImport(false);
  bcSetReport('Reading ' + bcEsc(sourceName) + ' …');
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    bcSetReport(bcLine('bc-err', 'That is not valid JSON: ' + e.message));
    return;
  }
  if (!json || (!json.BEANS && !json.MILL && !json.PREPARATION)) {
    bcSetReport(bcLine('bc-err', 'No BEANS / MILL / PREPARATION in this file — is it a Beanconqueror export?'));
    return;
  }
  try {
    bcPlan = await bcBuildPlan(json);
  } catch (e) {
    bcSetReport(bcLine('bc-err', 'Could not read current DYE2 data: ' + e.message));
    return;
  }
  bcSetReport(bcRenderPlan(bcPlan));
  const c = bcPlan.counts;
  bcEnableImport(c.beanNew + c.beanUpd + c.batchNew + c.batchUpd + c.grinderNew + bcPlan.equipment.length > 0);
}

async function bcRunImport() {
  if (!bcPlan || bcImporting) return;
  bcImporting = true;
  bcEnableImport(false);
  const done = { beans: 0, batches: 0, grinders: 0 };
  const errors = [];
  const total = bcPlan.beans.length;

  for (let i = 0; i < bcPlan.beans.length; i++) {
    const g = bcPlan.beans[i];
    bcSetReport(bcLine('bc-upd', 'Importing ' + (i + 1) + ' / ' + total + ' — ' + g.bean.roaster + ' ' + g.bean.name));
    try {
      let beanId = g.beanId;
      if (!beanId) {
        const created = await createBean(g.bean);
        beanId = created.id;
      } else if (Object.keys(g.patch).length) {
        await updateBean(beanId, g.patch);
      }
      done.beans++;
      for (const b of g.batches) {
        if (b.batchId) {
          await updateBeanBatch(b.batchId, bcBatchUpdatePayload(b.payload));
        } else {
          const created = await createBeanBatch(beanId, bcBatchCreatePayload(b.payload));
          const needsPut = b.payload.archived || (b.payload.weightRemaining != null && b.payload.weightRemaining !== b.payload.weight);
          if (created && created.id && needsPut) {
            await updateBeanBatch(created.id, { archived: !!b.payload.archived, weightRemaining: b.payload.weightRemaining });
          }
        }
        done.batches++;
      }
    } catch (e) {
      errors.push(g.bean.roaster + ' ' + g.bean.name + ': ' + e.message);
    }
  }

  for (const gr of bcPlan.grinders) {
    try {
      // POST /grinders takes neither archived nor extras — same follow-up PUT as batches.
      const payload = Object.assign({}, gr);
      delete payload.archived;
      delete payload.extras;
      const created = await createGrinder(payload);
      if (created && created.id && (gr.archived || gr.extras)) {
        await updateGrinder(created.id, { archived: !!gr.archived, extras: gr.extras });
      }
      done.grinders++;
    } catch (e) { errors.push('grinder ' + gr.model + ': ' + e.message); }
  }

  if (bcPlan.equipment.length) {
    try { await kvSetArray('bcEquipment', bcPlan.equipment); }
    catch (e) { errors.push('equipment: ' + e.message); }
  }

  let out = '<div class="bc-label">Import finished</div>';
  out += bcLine('bc-add', done.beans + ' beans, ' + done.batches + ' batches, ' + done.grinders + ' grinders');
  errors.forEach(function (e) { out += bcLine('bc-err', '! ' + e); });
  out += '<div style="height:16px"></div>';
  out += bcLine('bc-skip', 'Re-run this page after your next Beanconqueror export to pick up changes.');
  bcSetReport(out);
  bcImporting = false;
}

function bcInit() {
  bcEnableImport(false);
  const cancelBtn = document.getElementById('dye-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', function () { window.location.href = 'bean-picker'; });
  const confirmBtn = document.getElementById('dye-confirm-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', function () { bcRunImport().catch(function (e) { bcSetReport(bcLine('bc-err', e.message)); }); });

  const file = document.getElementById('bc-file');
  file.addEventListener('change', async function () {
    const f = file.files && file.files[0];
    if (!f) return;
    document.getElementById('bc-file-name').textContent = f.name;
    bcAnalyse(await f.text(), f.name);
  });

  // Paste is the primary path: REA's WebView does not always wire up Android's file chooser.
  const ta = document.getElementById('bc-text');
  let timer = null;
  ta.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (ta.value.trim()) bcAnalyse(ta.value, 'pasted text');
    }, 400);
  });
}

bcInit();
`;

export function renderBcImportPage(request: HttpRequest): HttpResponse {
  return {
    requestId: request.requestId,
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: devPageShell("Import from Beanconqueror", content, styles, [devApiScript, pageScript]),
  };
}
