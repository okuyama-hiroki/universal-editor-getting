const ALIGNMENTS = new Set(['left', 'center', 'right']);
const TEXT_COLORS = new Set(['default', 'dark', 'light', 'accent']);

function readAlignRow(row) {
  const value = row?.textContent?.trim();
  if (!ALIGNMENTS.has(value)) return null;
  const cell = row.firstElementChild;
  if (!cell) return null;
  const cellText = cell.textContent?.trim();
  return cellText === value ? value : null;
}

function readTextColorCell(cell) {
  const value = cell?.textContent?.trim();
  if (!TEXT_COLORS.has(value)) return null;
  if (cell.children.length > 0) return null;
  return value;
}

export default function decorate(block) {
  const alignRows = [];
  let textColor = 'default';

  [...block.children].forEach((row) => {
    const align = readAlignRow(row);
    if (align) alignRows.push({ row, align });

    [...row.children].forEach((cell) => {
      const color = readTextColorCell(cell);
      if (color) {
        textColor = color;
        cell.remove();
      }
    });
  });

  const titleAlign = alignRows[0]?.align || 'left';
  const textAlign = alignRows[1]?.align || 'left';

  block.classList.add(
    `title-align-${titleAlign}`,
    `text-align-${textAlign}`,
    `text-color-${textColor}`,
  );
  alignRows.forEach(({ row }) => row.remove());
}
