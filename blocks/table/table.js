import { readBlockConfig } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const METADATA_KEYS = new Set(['columns', 'rows', 'classes', 'options']);

function isMetadataRow(row) {
  const cells = [...row.children];
  if (!cells.length) return true;

  if (cells.length === 2) {
    const key = cells[0].textContent.trim().toLowerCase();
    if (METADATA_KEYS.has(key)) return true;
  }

  if (cells.length === 1) {
    const value = cells[0].textContent.trim();
    if (/^\d+$/.test(value) && cells[0].children.length === 0) return true;
  }

  return false;
}

function getDataRows(block) {
  return [...block.children].filter((row) => !isMetadataRow(row));
}

function parseColumnCount(block) {
  const fromClass = [...block.classList]
    .map((cls) => cls.match(/^columns-(\d+)-cols$/)?.[1])
    .find(Boolean);
  if (fromClass) return parseInt(fromClass, 10);

  const config = readBlockConfig(block);
  if (config.columns) return parseInt(config.columns, 10);

  const dataRows = getDataRows(block);
  const counts = dataRows.map((row) => row.children.length).filter(Boolean);
  if (counts.length) return Math.max(...counts);

  return 1;
}

function applyClasses(block) {
  const config = readBlockConfig(block);
  const classValues = config.classes || config.options;
  if (!classValues) return;

  classValues
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => block.classList.add(value));
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

export default function decorate(block) {
  block.classList.add('table');
  applyClasses(block);

  const columnCount = parseColumnCount(block);
  block.classList.add(`columns-${columnCount}-cols`);

  const rows = getDataRows(block);
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

  [...block.children].forEach((row) => row.remove());

  if (thead.children.length) table.append(thead);
  if (tbody.children.length) table.append(tbody);

  const wrapper = document.createElement('div');
  wrapper.className = 'table-scroll';
  wrapper.append(table);
  block.append(wrapper);
}
