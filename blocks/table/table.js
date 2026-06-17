import { moveInstrumentation } from '../../scripts/scripts.js';

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function getColumnCount(tableRow) {
  const count = parseInt(tableRow.firstElementChild?.textContent?.trim(), 10);
  return Number.isNaN(count) ? 2 : count;
}

function getRowCells(tableRow) {
  const count = getColumnCount(tableRow);
  return [...tableRow.children].slice(1, 1 + count);
}

function decorateTableRow(tableRow) {
  const count = getColumnCount(tableRow);
  tableRow.classList.add(`columns-${count}-cols`);

  const meta = tableRow.firstElementChild;
  if (meta) meta.classList.add('table-row-columns-meta');

  [...tableRow.children].slice(1).forEach((cell, index) => {
    cell.classList.toggle('table-row-cell-hidden', index >= count);
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

    getRowCells(tableRow).forEach((col) => {
      const cell = document.createElement('td');
      moveInstrumentation(col, cell);
      while (col.firstChild) cell.append(col.firstChild);
      row.append(cell);
    });
  });

  block.replaceChildren(table);
}
