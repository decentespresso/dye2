/**
 * Date line for a favourite card, as a browser-side script string (no local imports, so
 * test/fav-date.test.mjs can eval it directly).
 *
 * The date shown is always the favourite's own (recents: the newest shot's timestamp;
 * saved: capturedAt). With a roast date on or before that day it is date only plus the
 * days between them, "15 Jul 2025 (30 days off-roast)" — measured to the shown date, as
 * first-gen DYE does for past shots. Otherwise (no roast date, unparseable, or after the
 * shown date) it is "21 Aug 2025, 2:30pm". roastDate is a BeanBatch field, so the caller
 * resolves it (see auto-favs.ts).
 */
export const favDateScript = `
function formatFavDate(capturedAt, roastDate) {
  if (!capturedAt) return '';
  const d = new Date(capturedAt);
  if (isNaN(d.getTime())) return '';
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (roastDate) {
    const rd = new Date(roastDate);
    if (!isNaN(rd.getTime())) {
      const days = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
        Date.UTC(rd.getFullYear(), rd.getMonth(), rd.getDate())) / 86400000);
      if (days >= 0) return dateStr + ' (' + days + (days === 1 ? ' day' : ' days') + ' off-roast)';
    }
  }
  const h = d.getHours();
  const time = ((h % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? 'am' : 'pm');
  return dateStr + ', ' + time;
}

// Latest batch per bean: roastDate desc, else newest createdAt/updatedAt.
function latestBatchPerBean(batches) {
  const stamp = b => new Date(b.roastDate || b.updatedAt || b.createdAt || 0).getTime() || 0;
  const best = {};
  (batches || []).forEach(b => {
    if (b && b.beanId && (!best[b.beanId] || stamp(b) > stamp(best[b.beanId]))) best[b.beanId] = b;
  });
  return best;
}

// A favourite's snapshot.beanBatchId is a real batch id from a recent or a workflow-seeded
// favourite, but the beans lookup on the edit page stores a bean id. Try it as a batch id
// first, then as a bean id -> that bean's latest batch.
function resolveRoastDate(id, batches) {
  if (!id) return '';
  const list = batches || [];
  const hit = list.find(b => b && b.id === id);
  if (hit) return hit.roastDate || '';
  const latest = latestBatchPerBean(list)[id];
  return (latest && latest.roastDate) || '';
}
`;
