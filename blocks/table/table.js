import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const METADATA_KEYS = new Set(['columns', 'rows', 'classes', 'options']);
const MAX_COLUMNS = 6;
const FIELDS_PER_COLUMN = 3;

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function isMetadataRow(row) {
  const cells = [...row.children];
  if (!cells.length) return true;

  if (cells.length === 2) {
    const key = cells[0].textContent.trim().toLowerCase();
    return METADATA_KEYS.has(key);
  }

  return false;
}

function getNestedRowBlocks(block) {
  return [...block.children].filter(
    (child) => child.classList.contains('columns')
      || child.getAttribute('data-aue-component') === 'table-row',
  );
}

function getRowFieldDivs(rowBlock) {
  return [...rowBlock.children].filter((child) => child.tagName === 'DIV');
}

function getColumnCountFromClass(element) {
  const counts = [...element.classList]
    .map((cls) => cls.match(/^columns-(\d+)-cols$/)?.[1])
    .filter(Boolean)
    .map((value) => parseInt(value, 10));
  return counts.length ? Math.max(...counts) : null;
}

function getColumnAlign(rowBlock, columnIndex) {
  const alignClass = [...rowBlock.classList].find(
    (cls) => cls.startsWith(`col${columnIndex}-align-`),
  );
  return alignClass?.replace(`col${columnIndex}-align-`, '') || 'left';
}

function parseRowColumnCount(rowBlock) {
  const fromClass = getColumnCountFromClass(rowBlock);
  if (fromClass) return fromClass;

  const fieldCount = getRowFieldDivs(rowBlock).length;
  if (fieldCount >= FIELDS_PER_COLUMN) {
    return Math.min(Math.floor(fieldCount / FIELDS_PER_COLUMN), MAX_COLUMNS);
  }

  return 1;
}

function getColumnFields(rowBlock, columnIndex) {
  const fields = getRowFieldDivs(rowBlock);
  const start = (columnIndex - 1) * FIELDS_PER_COLUMN;
  return {
    image: fields[start],
    imageAlt: fields[start + 1],
    text: fields[start + 2],
  };
}

function collectRowData(block) {
  const nestedRows = getNestedRowBlocks(block)
    .map((rowBlock) => {
      rowBlock.classList.add('table-row');
      const columnCount = parseRowColumnCount(rowBlock);
      return { rowBlock, columnCount };
    });

  if (nestedRows.length) return nestedRows;

  return [...block.children]
    .filter(
      (row) => !row.classList?.contains('table-scroll')
        && !isMetadataRow(row)
        && row.children.length,
    )
    .map((rowBlock) => ({
      rowBlock,
      columnCount: Math.max(1, Math.floor(rowBlock.children.length / FIELDS_PER_COLUMN)),
    }));
}

function syncColumnLayout(element, columnCount) {
  element.classList.remove(
    ...[...element.classList].filter((cls) => /^columns-\d+-cols$/.test(cls)),
  );
  element.classList.add(`columns-${columnCount}-cols`);
  element.style.setProperty('--table-columns', columnCount);
}

function applyCellAlignment(element, align) {
  element.classList.remove(
    'table-cell-align-left',
    'table-cell-align-center',
    'table-cell-align-right',
  );
  element.classList.add(`table-cell-align-${align}`);
}

function layoutRowCells(rowBlock, columnCount) {
  syncColumnLayout(rowBlock, columnCount);

  for (let col = 1; col <= MAX_COLUMNS; col += 1) {
    const { image, imageAlt, text } = getColumnFields(rowBlock, col);
    const hidden = col > columnCount;
    const align = getColumnAlign(rowBlock, col);

    [image, imageAlt, text].forEach((field, rowIndex) => {
      if (!field) return;

      const isAltField = rowIndex === 1;

      field.classList.toggle('table-cell-hidden', hidden || isAltField);
      field.classList.toggle('table-cell-image', !hidden && rowIndex === 0);
      field.classList.toggle('table-cell-image-alt', !hidden && isAltField);
      field.classList.toggle('table-cell-text', !hidden && rowIndex === 2);

      if (hidden || isAltField) {
        field.style.gridColumn = '';
        field.style.gridRow = '';
        return;
      }

      field.style.gridColumn = String(col);
      field.style.gridRow = rowIndex === 0 ? '1' : '2';
      applyCellAlignment(field, align);
    });
  }

  rowBlock.style.display = 'grid';
  rowBlock.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
  rowBlock.style.gridTemplateRows = 'auto auto';
  rowBlock.style.gap = '0';
  rowBlock.style.width = '100%';
}

function applyRowLayout(rowDataList) {
  rowDataList.forEach(({ rowBlock, columnCount }) => {
    layoutRowCells(rowBlock, columnCount);
  });
}

function optimizeImages(rowBlock) {
  rowBlock.querySelectorAll('.table-cell-image picture > img, .table-cell-image img').forEach((img) => {
    if (!img.src || img.closest('picture')?.dataset.optimized) return;
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture')?.replaceWith(optimizedPic);
    optimizedPic.dataset.optimized = 'true';
  });
}

function appendFieldContent(target, field) {
  if (!field || field.classList.contains('table-cell-hidden')) return;

  const hasMedia = field.querySelector('picture, img');
  const hasText = field.textContent.trim();

  if (!hasMedia && !hasText) return;

  if (target.hasChildNodes()) {
    target.append(document.createElement('br'));
  }

  moveInstrumentation(field, target);
  while (field.firstChild) target.append(field.firstChild);
}

function buildRow(rowBlock, tagName, columnCount, maxColumnCount) {
  const tr = document.createElement('tr');

  for (let col = 1; col <= columnCount; col += 1) {
    const cell = document.createElement(tagName);
    if (tagName === 'th') cell.setAttribute('scope', 'col');

    const { image, text } = getColumnFields(rowBlock, col);
    appendFieldContent(cell, image);
    appendFieldContent(cell, text);

    applyCellAlignment(cell, getColumnAlign(rowBlock, col));
    tr.append(cell);
  }

  while (tr.children.length < maxColumnCount) {
    tr.append(document.createElement(tagName));
  }

  return tr;
}

function removeMetadataRows(block) {
  [...block.children].forEach((row) => {
    if (row.classList?.contains('table-scroll')) return;
    if (isMetadataRow(row)) row.remove();
  });
}

function removeNestedRowBlocks(block) {
  getNestedRowBlocks(block).forEach((rowBlock) => rowBlock.remove());
}

function convertToTable(block, rowDataList) {
  const useHeaderRow = block.classList.contains('header-row');
  const maxColumnCount = Math.max(...rowDataList.map(({ columnCount }) => columnCount), 1);
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  rowDataList.forEach(({ rowBlock, columnCount }, index) => {
    optimizeImages(rowBlock);
    const isHeader = useHeaderRow && index === 0;
    const tr = buildRow(rowBlock, isHeader ? 'th' : 'td', columnCount, maxColumnCount);
    if (isHeader) thead.append(tr);
    else tbody.append(tr);
  });

  if (thead.children.length) table.append(thead);
  if (tbody.children.length) table.append(tbody);

  removeNestedRowBlocks(block);
  removeMetadataRows(block);
  [...block.children].forEach((row) => {
    if (!row.classList?.contains('table-scroll')) row.remove();
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.append(table);
  block.append(wrapper);
}

export default function decorate(block) {
  block.classList.add('table');

  removeMetadataRows(block);

  const rowDataList = collectRowData(block);
  applyRowLayout(rowDataList);

  if (isAuthoringEnvironment()) {
    block.classList.add('table-editing');
    return;
  }

  if (!rowDataList.length) return;

  convertToTable(block, rowDataList);
}
