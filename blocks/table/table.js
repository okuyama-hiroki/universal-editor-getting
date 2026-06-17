import { moveInstrumentation } from '../../scripts/scripts.js';

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function getRowColumns(tableRow) {
  if (tableRow.children.length === 1 && tableRow.firstElementChild.children.length > 0) {
    return [...tableRow.firstElementChild.children];
  }
  return [...tableRow.children];
}

function decorateTableRow(tableRow) {
  const cols = getRowColumns(tableRow);
  tableRow.classList.add(`columns-${cols.length}-cols`);
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

    getRowColumns(tableRow).forEach((col) => {
      const cell = document.createElement('td');
      moveInstrumentation(col, cell);
      while (col.firstChild) cell.append(col.firstChild);
      row.append(cell);
    });
  });

  block.replaceChildren(table);
}
