import { readBlockConfig } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const METADATA_KEYS = new Set(['columns', 'rows', 'classes', 'options']);
const COLUMN_COUNT_PATTERN = /^[1-6]$/;

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function getCellText(cell) {
  return cell.textContent.trim();
}

function isColumnCountCell(cell) {
  return COLUMN_COUNT_PATTERN.test(getCellText(cell));
}

function getColumnCountArtifact(block) {
  const artifactRow = [...block.children].find((row) => {
    if (row.classList?.contains('table-scroll')) return false;
    const cells = [...row.children];
    return cells.length === 1 && isColumnCountCell(cells[0]);
  });

  if (!artifactRow) return null;
  return parseInt(getCellText(artifactRow.children[0]), 10);
}

function isMetadataRow(row, configColumns) {
  const cells = [...row.children];
  if (!cells.length) return true;

  if (cells.length === 2) {
    const key = cells[0].textContent.trim().toLowerCase();
    return METADATA_KEYS.has(key);
  }

  if (cells.length === 1 && isColumnCountCell(cells[0])) {
    return !configColumns || getCellText(cells[0]) === String(configColumns);
  }

  return false;
}

function getDataRows(block, configColumns) {
  return [...block.children].filter(
    (row) => !row.classList?.contains('table-scroll')
      && !isMetadataRow(row, configColumns)
      && row.children.length,
  );
}

function parseColumnCount(block, dataRows, artifactColumns) {
  if (artifactColumns) return artifactColumns;

  const fromClass = [...block.classList]
    .map((cls) => cls.match(/^columns-(\d+)-cols$/)?.[1])
    .find(Boolean);
  if (fromClass) return parseInt(fromClass, 10);

  const config = readBlockConfig(block);
  if (config.columns) return parseInt(config.columns, 10);

  const counts = dataRows.map((row) => row.children.length).filter(Boolean);
  if (counts.length) return Math.max(...counts);

  return 1;
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

function removeMetadataRows(block, configColumns) {
  [...block.children].forEach((row) => {
    if (row.classList?.contains('table-scroll')) return;
    if (isMetadataRow(row, configColumns)) row.remove();
  });
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
    row.remove();
  });

  [...block.children].forEach((row) => {
    if (!row.classList?.contains('table-scroll')) row.remove();
  });

  if (thead.children.length) table.append(thead);
  if (tbody.children.length) table.append(tbody);

  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.append(table);
  block.append(wrapper);
}

export default function decorate(block) {
  block.classList.add('table');

  const config = readBlockConfig(block);
  const artifactColumns = getColumnCountArtifact(block);
  const columnCount = parseColumnCount(block, getDataRows(block, config.columns), artifactColumns);

  block.classList.remove(...[...block.classList].filter((cls) => /^columns-\d+-cols$/.test(cls)));
  block.classList.add(`columns-${columnCount}-cols`);

  removeMetadataRows(block, config.columns);

  const rows = getDataRows(block, config.columns);

  if (isAuthoringEnvironment()) {
    return;
  }

  if (!rows.length) return;

  convertToTable(block, rows, columnCount);
}
