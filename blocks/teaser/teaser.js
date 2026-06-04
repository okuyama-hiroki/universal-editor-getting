import { moveInstrumentation } from '../../scripts/scripts.js';

let cachedDeliveryOrigin;

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

function isLikelyBrokenImgSrc(src) {
  try {
    const url = new URL(src, window.location.href);
    if (url.searchParams.has('width') || url.searchParams.has('optimize')) return true;
    return url.origin === window.location.origin && url.pathname.includes('/adobe/assets/');
  } catch {
    return true;
  }
}

function getRowCells(row) {
  const wrapper = row.querySelector(':scope > div');
  if (!wrapper) return [];
  const cells = [...wrapper.children].filter((el) => el.tagName === 'DIV');
  return cells.length ? cells : [wrapper];
}

function readImageUrl(cell) {
  const imageLink = [...cell.querySelectorAll('a[href]')].find((link) => {
    const href = link.getAttribute('href') || '';
    return isImageUrl(href);
  });
  if (imageLink) {
    const href = imageLink.getAttribute('href') || '';
    const normalized = normalizeImageSrc(href);
    if (normalized) return normalized;
  }

  const delivery = findDeliveryUrlInElement(cell);
  if (delivery) return delivery;

  const text = cell.textContent.trim();
  if (isImageUrl(text)) {
    const normalized = normalizeImageSrc(text);
    if (normalized) return normalized;
  }

  const img = cell.querySelector('picture img, img');
  if (img) {
    const raw = img.getAttribute('src') || img.src;
    if (raw && !isLikelyBrokenImgSrc(raw)) {
      const normalized = normalizeImageSrc(raw);
      if (normalized) return normalized;
    }
  }

  return null;
}

function readImageUrlFromRow(row) {
  const cells = getRowCells(row);
  const match = cells.map((cell) => readImageUrl(cell)).find(Boolean);
  return match || null;
}

function readImageAlt(row, src) {
  const cells = getRowCells(row);
  const fromImg = cells.map((cell) => cell.querySelector('picture img, img')).find(Boolean);
  if (fromImg?.alt && fromImg.alt !== src && fromImg.alt.length > 0) {
    return fromImg.alt;
  }

  const imageLink = cells
    .flatMap((cell) => [...cell.querySelectorAll('a[href]')])
    .find((link) => isImageUrl(link.getAttribute('href') || ''));

  if (imageLink) {
    const label = imageLink.textContent.trim();
    if (label && label !== src && !isImageUrl(label)) {
      return label;
    }
  }

  return '';
}

function isAltOnlyRow(row) {
  const cell = row.querySelector(':scope > div');
  if (!cell) return false;
  if (cell.querySelector('picture, img, a, .button-container, h1, h2, h3, h4, h5, h6')) {
    return false;
  }

  const text = cell.textContent.trim();
  return text.length > 0 && !isImageUrl(text);
}

function isCtaRow(row) {
  const cell = row.querySelector(':scope > div');
  if (!cell) return false;
  const link = cell.querySelector('.button-container a[href], a.button[href]');
  if (!link) return false;
  const href = link.getAttribute('href') || link.href;
  return !isImageUrl(href);
}

function isImageRow(row) {
  if (isCtaRow(row)) return false;
  const cells = getRowCells(row);
  return cells.some((cell) => cell.querySelector('picture, img') || readImageUrl(cell));
}

function buildPicture(src, alt) {
  const picture = document.createElement('picture');
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  img.loading = 'lazy';
  picture.append(img);
  return picture;
}

function decorateImageRow(row, index) {
  row.classList.add(index === 0 ? 'teaser-image-desktop' : 'teaser-image-mobile');

  const src = readImageUrlFromRow(row);
  if (!src) return;

  let alt = readImageAlt(row, src);

  const nextRow = row.nextElementSibling;
  if (nextRow && isAltOnlyRow(nextRow)) {
    alt = nextRow.querySelector(':scope > div').textContent.trim();
    nextRow.remove();
  }

  const cell = getRowCells(row)[0] || row.querySelector(':scope > div');
  if (!cell) return;

  const picture = buildPicture(src, alt);
  moveInstrumentation(cell, picture.querySelector('img'));
  cell.replaceChildren(picture);
}

export default function decorate(block) {
  [...block.children]
    .filter(isImageRow)
    .forEach((row, index) => decorateImageRow(row, index));
}
