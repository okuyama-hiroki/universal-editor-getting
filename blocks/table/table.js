import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const METADATA_KEYS = new Set(['columns', 'rows', 'classes', 'options']);
const MAX_COLUMNS = 3;

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function getRowText(row) {
  return row?.textContent?.trim() || '';
}

function getFieldProp(row) {
  const prop = row.querySelector('[data-aue-prop]')?.getAttribute('data-aue-prop');
  if (prop) return prop;

  if (row.children.length === 2) {
    return row.children[0].textContent.trim().toLowerCase();
  }

  return null;
}

function isColumnsValue(text) {
  return /^[1-3]$/.test(text);
}

function isMetadataProp(prop) {
  if (!prop) return false;
  if (prop === 'columns' || METADATA_KEYS.has(prop)) return true;
  return prop.endsWith('_imageAlt');
}

function isContentProp(prop) {
  return prop?.endsWith('_text') || prop?.endsWith('_image');
}

function isMetadataRow(row) {
  if (row.classList.contains('table-row-metadata')) return true;

  const prop = getFieldProp(row);
  if (isMetadataProp(prop)) return true;

  const text = getRowText(row).toLowerCase();
  return isColumnsValue(text);
}

function getNestedRowBlocks(block) {
  return [...block.children].filter(
    (child) => child.classList.contains('columns')
      || child.getAttribute('data-aue-component') === 'table-row',
  );
}

function hideMetadataRows(rowBlock) {
  [...rowBlock.children].forEach((row) => {
    if (isMetadataRow(row)) {
      row.classList.add('table-row-metadata');
      row.style.display = 'none';
    }
  });
}

function getColumnIndexFromProp(prop) {
  const match = prop?.match(/^col(\d+)_(image|text)$/);
  return match ? parseInt(match[1], 10) : null;
}

function readRowConfig(rowBlock) {
  const config = readBlockConfig(rowBlock);

  if (!config.columns) {
    const columnsRow = [...rowBlock.children].find((row) => getFieldProp(row) === 'columns');
    if (columnsRow) {
      const value = getRowText(columnsRow).match(/^[1-3]$/)?.[0];
      if (value) config.columns = value;
    }
  }

  return config;
}

function getColumnCountFromClass(element) {
  const counts = [...element.classList]
    .map((cls) => cls.match(/^columns-(\d+)-cols$/)?.[1])
    .filter(Boolean)
    .map((value) => parseInt(value, 10));
  return counts.length ? Math.max(...counts) : null;
}

function parseRowColumnCount(rowBlock, config) {
  if (config.columns) return parseInt(config.columns, 10);

  const fromClass = getColumnCountFromClass(rowBlock);
  if (fromClass) return fromClass;

  const contentCols = [...rowBlock.children]
    .map((row) => getColumnIndexFromProp(getFieldProp(row)))
    .filter(Boolean);
  if (contentCols.length) return Math.min(Math.max(...contentCols), MAX_COLUMNS);

  return 1;
}

function getContentRows(rowBlock) {
  return [...rowBlock.children].filter((row) => {
    if (isMetadataRow(row)) return false;
    const prop = getFieldProp(row);
    return isContentProp(prop);
  });
}

function getColumnField(rowBlock, columnIndex, fieldName) {
  const prop = `col${columnIndex}_${fieldName}`;
  return [...rowBlock.children].find((row) => getFieldProp(row) === prop);
}

function prepareRowBlock(rowBlock) {
  rowBlock.classList.add('table-row');
  hideMetadataRows(rowBlock);
  const config = readRowConfig(rowBlock);
  const columnCount = parseRowColumnCount(rowBlock, config);
  return { rowBlock, columnCount, config };
}

function collectRowData(block) {
  const nestedRows = getNestedRowBlocks(block).map((rowBlock) => prepareRowBlock(rowBlock));
  if (nestedRows.length) return nestedRows;

  return [...block.children]
    .filter(
      (row) => !row.classList?.contains('table-scroll')
        && !isMetadataRow(row)
        && row.children.length,
    )
    .map((rowBlock) => prepareRowBlock(rowBlock));
}

function syncColumnLayout(element, columnCount) {
  element.classList.remove(
    ...[...element.classList].filter((cls) => /^columns-\d+-cols$/.test(cls)),
  );
  element.classList.add(`columns-${columnCount}-cols`);
  element.style.setProperty('--table-columns', columnCount);
}

function layoutRowCells(rowBlock, columnCount) {
  syncColumnLayout(rowBlock, columnCount);
  hideMetadataRows(rowBlock);

  getContentRows(rowBlock).forEach((row) => {
    const prop = getFieldProp(row);
    const col = getColumnIndexFromProp(prop);
    if (!col) return;

    const hidden = col > columnCount;
    const type = prop.endsWith('_image') ? 'image' : 'text';

    row.classList.toggle('table-cell-hidden', hidden);
    row.classList.toggle('table-cell-image', !hidden && type === 'image');
    row.classList.toggle('table-cell-text', !hidden && type === 'text');

    if (hidden) {
      row.style.gridColumn = '';
      row.style.gridRow = '';
      return;
    }

    row.style.gridColumn = String(col);
    row.style.gridRow = '1';
  });

  rowBlock.style.display = 'grid';
  rowBlock.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
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

    const image = getColumnField(rowBlock, col, 'image');
    const text = getColumnField(rowBlock, col, 'text');
    appendFieldContent(cell, image);
    appendFieldContent(cell, text);
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
    rowBlock.querySelectorAll('.table-row-metadata').forEach((row) => row.remove());
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
