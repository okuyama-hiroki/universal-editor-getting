import { readBlockConfig } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const METADATA_KEYS = new Set(['columns', 'rows', 'classes', 'options']);

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

function getRowGrid(rowBlock) {
  const directCells = [...rowBlock.children].filter((child) => child.tagName === 'DIV');

  if (directCells.length === 1 && directCells[0].children.length > 1) {
    return directCells[0];
  }

  if (directCells.length > 1) {
    return rowBlock;
  }

  return directCells[0] || null;
}

function collectRows(block) {
  const nestedRows = getNestedRowBlocks(block)
    .map((rowBlock) => {
      rowBlock.classList.add('table-row');
      return getRowGrid(rowBlock);
    })
    .filter(Boolean);

  if (nestedRows.length) return nestedRows;

  return [...block.children].filter(
    (row) => !row.classList?.contains('table-scroll')
      && !isMetadataRow(row)
      && row.children.length,
  );
}

function getColumnCountFromClass(element) {
  const counts = [...element.classList]
    .map((cls) => cls.match(/^columns-(\d+)-cols$/)?.[1])
    .filter(Boolean)
    .map((value) => parseInt(value, 10));
  return counts.length ? Math.max(...counts) : null;
}

function parseColumnCount(block, dataRows) {
  const fromClass = getColumnCountFromClass(block);
  if (fromClass) return fromClass;

  const config = readBlockConfig(block);
  if (config.columns) return parseInt(config.columns, 10);

  if (!isAuthoringEnvironment()) {
    const counts = dataRows.map((row) => row.children.length).filter(Boolean);
    if (counts.length) return Math.max(...counts);
  }

  return 1;
}

function syncColumnLayout(element, columnCount) {
  element.classList.remove(
    ...[...element.classList].filter((cls) => /^columns-\d+-cols$/.test(cls)),
  );
  element.classList.add(`columns-${columnCount}-cols`);
  element.style.setProperty('--table-columns', columnCount);
}

function applyRowLayout(block, columnCount) {
  getNestedRowBlocks(block).forEach((rowBlock) => {
    rowBlock.classList.add('table-row');
    syncColumnLayout(rowBlock, columnCount);
  });
}

function buildCell(cell, tagName) {
  const el = document.createElement(tagName);
  if (tagName === 'th') {
    el.setAttribute('scope', 'col');
  }
  moveInstrumentation(cell, el);
  while (cell.firstChild) el.append(cell.firstChild);
  return el;
}

function buildRow(row, tagName, columnCount) {
  const tr = document.createElement('tr');
  const cells = [...row.children];

  cells.forEach((cell) => {
    tr.append(buildCell(cell, tagName));
  });

  while (tr.children.length < columnCount) {
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

function convertToTable(block, rows, columnCount) {
  const useHeaderRow = block.classList.contains('header-row');
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  rows.forEach((row, index) => {
    const isHeader = useHeaderRow && index === 0;
    const tr = buildRow(row, isHeader ? 'th' : 'td', columnCount);
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

  const rows = collectRows(block);
  const columnCount = parseColumnCount(block, rows);

  syncColumnLayout(block, columnCount);
  applyRowLayout(block, columnCount);

  if (isAuthoringEnvironment()) {
    return;
  }

  if (!rows.length) return;

  convertToTable(block, rows, columnCount);
}
