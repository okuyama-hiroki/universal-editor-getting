import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const MAX_COLUMNS = 6;

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function getColumnCount(tableRow) {
  const count = parseInt(tableRow.firstElementChild?.textContent?.trim(), 10);
  return Number.isNaN(count) ? 2 : count;
}

function getAllColumnGroups(tableRow) {
  const fields = [...tableRow.children].slice(1);
  const perColumn = Math.floor(fields.length / MAX_COLUMNS);

  return Array.from({ length: MAX_COLUMNS }, (_, index) => {
    const start = index * perColumn;
    return fields.slice(start, start + perColumn);
  });
}

function getColumnGroups(tableRow) {
  const count = getColumnCount(tableRow);
  return getAllColumnGroups(tableRow).slice(0, count);
}

function wrapColumnGroup(group, hidden) {
  if (group.length === 0 || group[0].parentElement?.classList.contains('table-row-cell')) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.classList.add('table-row-cell');
  wrapper.classList.toggle('table-row-cell-hidden', hidden);
  group[0].before(wrapper);
  group.forEach((element) => wrapper.append(element));
}

function decorateTableRow(tableRow) {
  const count = getColumnCount(tableRow);
  tableRow.classList.add(`columns-${count}-cols`);

  const meta = tableRow.firstElementChild;
  if (meta) meta.classList.add('table-row-columns-meta');

  getAllColumnGroups(tableRow).forEach((group, index) => {
    wrapColumnGroup(group, index >= count);
  });
}

function appendGroupToCell(group, cell) {
  group.forEach((element) => {
    if (element.querySelector('picture')) {
      element.classList.add('table-cell-image');
    } else {
      element.classList.add('table-cell-body');
    }
    moveInstrumentation(element, cell);
    while (element.firstChild) cell.append(element.firstChild);
  });
}

function optimizeCellImages(cell) {
  cell.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
}

export default function decorate(block) {
  block.classList.add('table');

  if (isAuthoringEnvironment()) {
    block.classList.add('table-editing');
    [...block.children].forEach(decorateTableRow);
    return;
  }

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.append(tbody);

  [...block.children].forEach((tableRow) => {
    const row = document.createElement('tr');
    tbody.append(row);

    getColumnGroups(tableRow).forEach((group) => {
      const cell = document.createElement('td');
      appendGroupToCell(group, cell);
      optimizeCellImages(cell);
      row.append(cell);
    });
  });

  block.replaceChildren(table);
}
