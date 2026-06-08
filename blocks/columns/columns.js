export default async function decorate(block) {
  if (block.classList.contains('table') || block.dataset.blockName === 'table') {
    const { loadCSS } = await import('../../scripts/aem.js');
    await loadCSS(`${window.hlx.codeBasePath}/blocks/table/table.css`);
    const { default: decorateTable } = await import('../table/table.js');
    decorateTable(block);
    return;
  }

  const firstRow = block.firstElementChild;
  if (!firstRow) return;

  const cols = [...firstRow.children];
  block.classList.add(`columns-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });
}
