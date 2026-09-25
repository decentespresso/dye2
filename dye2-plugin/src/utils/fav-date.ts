/**
 * Date line for a favourite card, as a browser-side script string (no local imports, so
 * test/fav-date.test.mjs can eval it directly).
 *
 * With a known roast date: "15 Jul 2025 (30 days off-roast)", the days measured to today —
 * the same convention as the dashboard, edit-shot and bean-picker. roastDate is a BeanBatch
 * field, not a WorkflowContext one, so the caller resolves it from fav.snapshot.beanBatchId
 * (see auto-favs.ts) and passes it in. Without one (no batch, fetch failed, unparseable
 * date): the plain favourite date and time, "21 Aug 2025, 2:30pm", with no off-roast text.
 */
export const favDateScript = `
function formatFavDate(capturedAt, roastDate, now) {
  const today = now ? new Date(now) : new Date();
  if (roastDate) {
    const rd = new Date(roastDate);
    if (!isNaN(rd.getTime())) {
      const days = Math.max(0, Math.floor((today - rd) / 86400000));
      return rd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' (' + days + ' days off-roast)';
    }
  }
  if (!capturedAt) return '';
  const d = new Date(capturedAt);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  const time = ((h % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? 'am' : 'pm');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + time;
}
`;
