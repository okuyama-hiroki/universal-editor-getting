import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const MAX_COLUMNS = 6;

let cachedDeliveryOrigin;

function isAuthoringEnvironment() {
  return document.querySelector('script[src*="editor-support.js"]') !== null;
}

function isImageUrl(url) {
  if (!url) return false;
  const value = typeof url === 'string' ? url.trim() : '';
  if (!value) return false;
  if (/^urn:aaid:/i.test(value)) return true;
  if (/^\/(content\/dam|adobe\/assets)\//i.test(value)) return true;
  if (!/^https?:\/\//.test(value)) return false;
  return /\.(avif|png|jpe?g|gif|webp|svg)(\?|$)/i.test(value)
    || value.includes('/adobe/assets/')
    || value.includes('/content/dam/')
    || value.includes('adobeaemcloud.com')
    || value.includes('scene7.com');
}

function getDeliveryOrigin() {
  if (cachedDeliveryOrigin) return cachedDeliveryOrigin;

  const candidate = document.querySelector(
    'img[src*="adobeaemcloud.com"], a[href*="adobeaemcloud.com"]',
  );
  if (candidate) {
    const raw = candidate.getAttribute('src') || candidate.getAttribute('href') || '';
    try {
      const { origin, hostname } = new URL(raw, window.location.href);
      if (hostname.includes('adobeaemcloud.com')) {
        cachedDeliveryOrigin = origin;
        return cachedDeliveryOrigin;
      }
    } catch {
      // ignore
    }
  }

  cachedDeliveryOrigin = window.location.origin;
  return cachedDeliveryOrigin;
}

function findDeliveryUrlInElement(el) {
  if (!el) return null;
  const attrs = [...el.attributes].map((a) => a.value).join(' ');
  const haystack = `${attrs} ${el.innerHTML}`;
  const match = haystack.match(/https:\/\/delivery-[^"'\\s<>]+/);
  return match ? match[0] : null;
}

function normalizeImageSrc(raw) {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value === '#' || value === 'about:blank') return null;

  const deliveryFromDom = findDeliveryUrlInElement(document.body);
  if (/^https?:\/\//.test(value) && isImageUrl(value)) {
    try {
      return new URL(value, window.location.href).href;
    } catch {
      return null;
    }
  }

  if (value.startsWith('/adobe/assets/') || value.startsWith('/content/dam/')) {
    const base = deliveryFromDom
      ? new URL(deliveryFromDom).origin
      : getDeliveryOrigin();
    try {
      return new URL(value, `${base}/`).href;
    } catch {
      return null;
    }
  }

  if (/^urn:aaid:/i.test(value)) {
    const base = deliveryFromDom
      ? new URL(deliveryFromDom).origin
      : getDeliveryOrigin();
    return `${base}/adobe/assets/${value}`;
  }

  return null;
}

function readImageUrl(element) {
  const imageLink = [...element.querySelectorAll('a[href]')].find((link) => {
    const href = link.getAttribute('href') || '';
    return isImageUrl(href);
  });
  if (imageLink) {
    const normalized = normalizeImageSrc(imageLink.getAttribute('href') || '');
    if (normalized) return normalized;
  }

  const delivery = findDeliveryUrlInElement(element);
  if (delivery) return delivery;

  const img = element.querySelector('picture img, img');
  if (img) {
    const raw = img.getAttribute('src') || img.src;
    const normalized = normalizeImageSrc(raw);
    if (normalized) return normalized;
  }

  const text = element.textContent.trim();
  if (isImageUrl(text)) {
    const normalized = normalizeImageSrc(text);
    if (normalized) return normalized;
  }

  return null;
}

function readAltText(element, src) {
  const img = element.querySelector('picture img, img');
  if (img?.alt && img.alt !== src) {
    return img.alt;
  }

  const imageLink = [...element.querySelectorAll('a[href]')].find((link) => {
    const href = link.getAttribute('href') || '';
    return isImageUrl(href);
  });
  if (imageLink) {
    const label = imageLink.textContent.trim();
    if (label && label !== src && !isImageUrl(label)) {
      return label;
    }
  }

  const text = element.textContent.trim();
  if (text && text !== src && !isImageUrl(text)) {
    return text;
  }

  return '';
}

function isAltOnlyCell(element) {
  if (!element || element.classList.contains('table-cell-consumed')) return false;
  if (element.querySelector('picture, img')) return false;

  const text = element.textContent.trim();
  if (!text) return false;

  const link = element.querySelector('a[href]');
  if (link) {
    const href = link.getAttribute('href') || '';
    return !isImageUrl(href);
  }

  return true;
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

function processImageBlock(imageElement, altElement) {
  if (!imageElement || imageElement.classList.contains('table-cell-consumed')) return;

  if (imageElement.querySelector('picture img')) {
    imageElement.classList.add('table-cell-image');
    return;
  }

  const src = readImageUrl(imageElement);
  if (!src) return;

  let alt = readAltText(imageElement, src);
  if (altElement && isAltOnlyCell(altElement)) {
    const altText = altElement.textContent.trim();
    if (altText) alt = altText;
    altElement.classList.add('table-cell-consumed');
    altElement.replaceChildren();
  }

  const picture = document.createElement('picture');
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  picture.append(img);
  moveInstrumentation(imageElement, img);
  imageElement.replaceChildren(picture);
  imageElement.classList.add('table-cell-image');
}

function normalizeColumnGroup(group) {
  if (group.length < 2) return;

  const imageIndex = 1;
  const altIndex = group.length >= 4 ? 2 : -1;

  group.forEach((element, index) => {
    if (index === 0 || index === group.length - 1) {
      element.classList.add('table-cell-body');
    }
  });

  processImageBlock(group[imageIndex], altIndex >= 0 ? group[altIndex] : null);
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
    normalizeColumnGroup(group);
    wrapColumnGroup(group, index >= count);
  });
}

function appendGroupToCell(group, cell) {
  group.forEach((element) => {
    if (element.classList.contains('table-cell-consumed')) return;

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
      normalizeColumnGroup(group);

      const cell = document.createElement('td');
      appendGroupToCell(group, cell);
      optimizeCellImages(cell);
      row.append(cell);
    });
  });

  block.replaceChildren(table);
}
