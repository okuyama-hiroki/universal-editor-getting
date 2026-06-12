/*
 * Table Block (AEM Block Collection)
 * https://www.aem.live/developer/block-collection/table
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function buildCell(rowIndex) {
  const cell = rowIndex ? document.createElement('td') : document.createElement('th');
  if (!rowIndex) cell.setAttribute('scope', 'col');
  return cell;
}

export default function decorate(block) {
  block.classList.add('table');

  if (isAuthoringEnvironment()) {
    block.classList.add('table-editing');
    const firstRow = block.firstElementChild;
    if (firstRow) {
      block.classList.add(`columns-${firstRow.children.length}-cols`);
    }
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const header = !block.classList.contains('no-header');
  if (header) table.append(thead);
  table.append(tbody);

  [...block.children].forEach((child, i) => {
    const row = document.createElement('tr');
    if (header && i === 0) thead.append(row);
    else tbody.append(row);

    [...child.children].forEach((col) => {
      const cell = buildCell(header ? i : i + 1);
      const align = col.getAttribute('data-align');
      const valign = col.getAttribute('data-valign');
      if (align) cell.style.textAlign = align;
      if (valign) cell.style.verticalAlign = valign;
      moveInstrumentation(col, cell);
      while (col.firstChild) cell.append(col.firstChild);
      row.append(cell);
    });
  });

  block.replaceChildren(table);
}
