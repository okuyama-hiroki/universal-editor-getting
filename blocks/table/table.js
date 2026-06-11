import { createOptimizedPicture, readBlockConfig } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const METADATA_KEYS = new Set(['columns', 'rows', 'classes', 'options']);
const MAX_COLUMNS = 6;
const ALIGN_VALUES = new Set(['left', 'center', 'right']);

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
  return /^[1-6]$/.test(text);
}

function isAlignValue(text) {
  return ALIGN_VALUES.has(text.toLowerCase());
}

function isAlignRow(row) {
  const prop = getFieldProp(row);
  if (prop?.endsWith('_align')) return true;
  if (prop?.endsWith('_text') || prop?.endsWith('_image')) return false;
  if (row.querySelector('[data-aue-type="richtext"], [data-richtext-model]')) return false;
  return isAlignValue(getRowText(row));
}

function isColumnsRow(row) {
  const prop = getFieldProp(row);
  if (prop === 'columns') return true;
  if (prop) return false;
  return isColumnsValue(getRowText(row));
}

function isMetadataRow(row) {
  if (row.classList.contains('table-row-metadata')) return true;
  if (isColumnsRow(row) || isAlignRow(row)) return true;

  const prop = getFieldProp(row);
  if (prop === 'columns' || /^col\d+_align$/.test(prop || '')) return true;
  if (prop && METADATA_KEYS.has(prop)) return true;

  const legacyText = row.textContent.trim();
  return legacyText.includes('columns-') && legacyText.includes('col1-align');
}

function getNestedRowBlocks(block) {
  return [...block.children].filter(
    (child) => child.classList.contains('columns')
      || child.getAttribute('data-aue-component') === 'table-row',
  );
}

function createEmptyColumnMap() {
  return Object.fromEntries(
    [...Array(MAX_COLUMNS)].map((_, index) => [index + 1, {
      image: null,
      imageAlt: null,
      text: null,
      align: null,
    }]),
  );
}

function markMetadata(row) {
  row.classList.add('table-row-metadata');
}

function markContent(row, type) {
  row.classList.remove('table-row-metadata');
  row.classList.remove('table-cell-image', 'table-cell-text', 'table-cell-image-alt', 'table-cell-hidden');
  row.classList.add(`table-cell-${type}`);
}

function assignField(cols, colIndex, type, row) {
  if (!cols[colIndex]) return;
  if (!cols[colIndex][type]) {
    cols[colIndex][type] = row;
    if (type === 'align' || type === 'imageAlt') markMetadata(row);
    else markContent(row, type === 'image' ? 'image' : 'text');
  }
}

function scanRowFields(rowBlock) {
  const rows = [...rowBlock.children].filter((child) => child.tagName === 'DIV');
  const cols = createEmptyColumnMap();
  let columnsRow = null;

  rows.forEach((row) => {
    row.classList.remove(
      'table-row-metadata',
      'table-cell-image',
      'table-cell-text',
      'table-cell-image-alt',
      'table-cell-hidden',
    );
    delete row.dataset.tableCol;
    row.style.gridColumn = '';
    row.style.gridRow = '';
  });

  rows.forEach((row) => {
    const prop = getFieldProp(row);
    if (prop === 'columns') {
      columnsRow = row;
      markMetadata(row);
      return;
    }

    const match = prop?.match(/^col(\d+)_(image|imageAlt|text|align)$/);
    if (match) {
      const colIndex = parseInt(match[1], 10);
      assignField(cols, colIndex, match[2], row);
    }
  });

  rows.forEach((row) => {
    if (row.classList.contains('table-row-metadata') || row.classList.contains('table-cell-image')
      || row.classList.contains('table-cell-text')) return;

    if (isColumnsRow(row)) {
      if (!columnsRow) {
        columnsRow = row;
        markMetadata(row);
      }
      return;
    }

    if (isAlignRow(row)) {
      for (let col = 1; col <= MAX_COLUMNS; col += 1) {
        if (!cols[col].align) {
          cols[col].align = row;
          markMetadata(row);
          return;
        }
      }
      return;
    }

    if (row.querySelector('picture, img')) {
      for (let col = 1; col <= MAX_COLUMNS; col += 1) {
        if (!cols[col].image) {
          assignField(cols, col, 'image', row);
          return;
        }
      }
      return;
    }

    const text = getRowText(row);
    if (text) {
      for (let col = 1; col <= MAX_COLUMNS; col += 1) {
        if (!cols[col].text) {
          assignField(cols, col, 'text', row);
          return;
        }
      }
    }
  });

  return { columnsRow, cols };
}

function readRowConfig(rowBlock, fields) {
  const config = { ...readBlockConfig(rowBlock) };

  if (!config.columns && fields.columnsRow) {
    const value = getRowText(fields.columnsRow).match(/^[1-6]$/)?.[0];
    if (value) config.columns = value;
  }

  for (let col = 1; col <= MAX_COLUMNS; col += 1) {
    const key = `col${col}_align`;
    if (!config[key]) {
      const alignRow = fields.cols[col].align;
      if (alignRow) {
        const align = getRowText(alignRow).toLowerCase();
        if (isAlignValue(align)) config[key] = align;
      }
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

function parseRowColumnCount(rowBlock, config, fields) {
  if (config.columns) return parseInt(config.columns, 10);

  const fromClass = getColumnCountFromClass(rowBlock);
  if (fromClass) return fromClass;

  const usedCols = Object.entries(fields.cols)
    .filter(([, colFields]) => colFields.text || colFields.image)
    .map(([col]) => parseInt(col, 10));
  if (usedCols.length) return Math.min(Math.max(...usedCols), MAX_COLUMNS);

  return 1;
}

function getColumnAlign(config, columnIndex) {
  const align = config[`col${columnIndex}_align`];
  if (align === 'center' || align === 'right') return align;
  return 'left';
}

function prepareRowBlock(rowBlock) {
  rowBlock.classList.add('table-row');
  const fields = scanRowFields(rowBlock);
  const config = readRowConfig(rowBlock, fields);
  const columnCount = parseRowColumnCount(rowBlock, config, fields);
  return {
    rowBlock, columnCount, config, fields,
  };
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

function applyCellAlignment(element, align) {
  element.classList.remove(
    'table-cell-align-left',
    'table-cell-align-center',
    'table-cell-align-right',
  );
  element.classList.add(`table-cell-align-${align}`);
}

function layoutRowCells(rowBlock, columnCount, config, fields) {
  syncColumnLayout(rowBlock, columnCount);

  for (let col = 1; col <= MAX_COLUMNS; col += 1) {
    const { image, text } = fields.cols[col];
    const hidden = col > columnCount;
    const align = getColumnAlign(config, col);

    [image, text].forEach((field) => {
      if (!field) return;

      field.classList.toggle('table-cell-hidden', hidden);
      if (hidden) {
        field.style.gridColumn = '';
        field.style.gridRow = '';
        return;
      }

      field.dataset.tableCol = String(col);
      field.style.gridColumn = String(col);
      field.style.gridRow = '1';
      applyCellAlignment(field, align);
    });
  }

  rowBlock.style.display = 'grid';
  rowBlock.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
  rowBlock.style.gap = '0';
  rowBlock.style.width = '100%';
}

function applyRowLayout(rowDataList) {
  rowDataList.forEach(({
    rowBlock, columnCount, config, fields,
  }) => {
    layoutRowCells(rowBlock, columnCount, config, fields);
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

function buildRow(rowBlock, tagName, columnCount, maxColumnCount, config, fields) {
  const tr = document.createElement('tr');

  for (let col = 1; col <= columnCount; col += 1) {
    const cell = document.createElement(tagName);
    if (tagName === 'th') cell.setAttribute('scope', 'col');

    const { image, text } = fields.cols[col];
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

  rowDataList.forEach(({
    rowBlock, columnCount, config, fields,
  }, index) => {
    rowBlock.querySelectorAll('.table-row-metadata').forEach((row) => row.remove());
    optimizeImages(rowBlock);
    const isHeader = useHeaderRow && index === 0;
    const tr = buildRow(rowBlock, isHeader ? 'th' : 'td', columnCount, maxColumnCount, config, fields);
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
