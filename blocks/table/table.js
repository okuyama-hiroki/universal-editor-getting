import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const METADATA_KEYS = new Set(['columns', 'rows', 'classes', 'options']);
const MAX_COLUMNS = 6;
const CONTENT_FIELD_PATTERN = /^col\d+_(image|imageAlt|text)$/;
const ROW_METADATA_PATTERN = /^columns$|^col\d+_align$/;

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function getFieldProp(row) {
  const prop = row.querySelector('[data-aue-prop]')?.getAttribute('data-aue-prop');
  if (prop) return prop;

  if (row.children.length === 2) {
    return row.children[0].textContent.trim().toLowerCase();
  }

  return null;
}

function isMetadataRow(row) {
  const cells = [...row.children];
  if (!cells.length) return true;

  const prop = getFieldProp(row);
  if (prop && (ROW_METADATA_PATTERN.test(prop) || METADATA_KEYS.has(prop))) {
    return true;
  }

  if (cells.length === 2) {
    const key = cells[0].textContent.trim().toLowerCase();
    return METADATA_KEYS.has(key);
  }

  const text = row.textContent.trim();
  return text.includes('columns-') && text.includes('col1-align');
}

function getNestedRowBlocks(block) {
  return [...block.children].filter(
    (child) => child.classList.contains('columns')
      || child.getAttribute('data-aue-component') === 'table-row',
  );
}

function cleanRowMetadata(rowBlock) {
  [...rowBlock.children].forEach((row) => {
    if (isMetadataRow(row)) row.remove();
  });
}

function getRowFieldDivs(rowBlock) {
  return [...rowBlock.children]
    .filter((child) => {
      if (child.tagName !== 'DIV') return false;
      const prop = getFieldProp(child);
      return prop && CONTENT_FIELD_PATTERN.test(prop);
    })
    .sort((a, b) => getFieldProp(a).localeCompare(getFieldProp(b), undefined, { numeric: true }));
}

function getColumnCountFromClass(element) {
  const counts = [...element.classList]
    .map((cls) => cls.match(/^columns-(\d+)-cols$/)?.[1])
    .filter(Boolean)
    .map((value) => parseInt(value, 10));
  return counts.length ? Math.max(...counts) : null;
}

function parseRowColumnCount(rowBlock, config = readBlockConfig(rowBlock)) {
  if (config.columns) return parseInt(config.columns, 10);

  const fromClass = getColumnCountFromClass(rowBlock);
  if (fromClass) return fromClass;

  const props = getRowFieldDivs(rowBlock).map((row) => getFieldProp(row));
  const columnIndexes = props
    .map((prop) => prop.match(/^col(\d+)_/)?.[1])
    .filter(Boolean)
    .map((value) => parseInt(value, 10));
  if (columnIndexes.length) return Math.min(Math.max(...columnIndexes), MAX_COLUMNS);

  return 1;
}

function getColumnAlign(config, columnIndex) {
  const align = config[`col${columnIndex}_align`];
  if (align === 'center' || align === 'right') return align;
  return 'left';
}

function getColumnField(rowBlock, columnIndex, fieldName) {
  const prop = `col${columnIndex}_${fieldName}`;
  return [...rowBlock.children].find((row) => getFieldProp(row) === prop);
}

function getColumnFields(rowBlock, columnIndex) {
  return {
    image: getColumnField(rowBlock, columnIndex, 'image'),
    imageAlt: getColumnField(rowBlock, columnIndex, 'imageAlt'),
    text: getColumnField(rowBlock, columnIndex, 'text'),
  };
}

function collectRowData(block) {
  const nestedRows = getNestedRowBlocks(block)
    .map((rowBlock) => {
      rowBlock.classList.add('table-row');
      const config = readBlockConfig(rowBlock);
      const columnCount = parseRowColumnCount(rowBlock, config);
      cleanRowMetadata(rowBlock);
      return { rowBlock, columnCount, config };
    });

  if (nestedRows.length) return nestedRows;

  return [...block.children]
    .filter(
      (row) => !row.classList?.contains('table-scroll')
        && !isMetadataRow(row)
        && row.children.length,
    )
    .map((rowBlock) => {
      const config = readBlockConfig(rowBlock);
      const columnCount = parseRowColumnCount(rowBlock, config);
      cleanRowMetadata(rowBlock);
      return {
        rowBlock,
        columnCount,
        config,
      };
    });
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

function layoutRowCells(rowBlock, columnCount, config) {
  syncColumnLayout(rowBlock, columnCount);

  for (let col = 1; col <= MAX_COLUMNS; col += 1) {
    const { image, imageAlt, text } = getColumnFields(rowBlock, col);
    const hidden = col > columnCount;
    const align = getColumnAlign(config, col);

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
  rowDataList.forEach(({ rowBlock, columnCount, config }) => {
    layoutRowCells(rowBlock, columnCount, config);
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

function buildRow(rowBlock, tagName, columnCount, maxColumnCount, config) {
  const tr = document.createElement('tr');

  for (let col = 1; col <= columnCount; col += 1) {
    const cell = document.createElement(tagName);
    if (tagName === 'th') cell.setAttribute('scope', 'col');

    const { image, text } = getColumnFields(rowBlock, col);
    appendFieldContent(cell, image);
    appendFieldContent(cell, text);

    applyCellAlignment(cell, getColumnAlign(config, col));
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

  rowDataList.forEach(({ rowBlock, columnCount, config }, index) => {
    optimizeImages(rowBlock);
    const isHeader = useHeaderRow && index === 0;
    const tr = buildRow(rowBlock, isHeader ? 'th' : 'td', columnCount, maxColumnCount, config);
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
