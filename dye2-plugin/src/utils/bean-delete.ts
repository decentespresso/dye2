/**
 * Delete a bean together with its batches, as a browser-side script string (no local
 * imports, so test/bean-delete.test.mjs can eval it with a fake api).
 *
 * DELETE /beans/{id} removes only that row, and BeanBatches.beanId references it with no
 * cascade while the host runs with foreign keys on — so a bean that still has batches
 * (archived ones too) fails to delete. Batches go first; if one fails the bean is left
 * alone and the error surfaces, with earlier batches already gone.
 * api = { getBeanBatches(beanId, includeArchived), deleteBeanBatch(id), deleteBean(id) }.
 */
export const beanDeleteScript = `
async function deleteBeanWithBatches(beanId, api) {
  const batches = await api.getBeanBatches(beanId, true);
  const ids = (Array.isArray(batches) ? batches : (batches && batches.items) || []).map(b => b.id).filter(Boolean);
  for (const id of ids) await api.deleteBeanBatch(id);
  await api.deleteBean(beanId);
  return ids;
}
`;
