const ALIGNMENTS = new Set(['left', 'center', 'right']);

function readAlignRow(row) {
  const value = row?.textContent?.trim();
  if (!ALIGNMENTS.has(value)) return null;
  const cell = row.firstElementChild;
  if (!cell) return null;
  const cellText = cell.textContent?.trim();
  return cellText === value ? value : null;
}

export default function decorate(block) {
  const alignRows = [];

  [...block.children].forEach((row) => {
    const align = readAlignRow(row);
    if (align) alignRows.push({ row, align });
  });

  const titleAlign = alignRows[0]?.align || 'left';
  const textAlign = alignRows[1]?.align || 'left';

  block.classList.add(`title-align-${titleAlign}`, `text-align-${textAlign}`);
  alignRows.forEach(({ row }) => row.remove());
}
