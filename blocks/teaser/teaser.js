import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function isImageUrl(url) {
  if (!url || !/^https?:\/\//.test(url)) return false;
  return /\.(avif|png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
    || url.includes('/adobe/assets/')
    || url.includes('adobeaemcloud.com');
}

function isDeliveryOrExternalUrl(src) {
  try {
    const url = new URL(src, window.location.href);
    return url.origin !== window.location.origin
      || src.includes('adobeaemcloud.com')
      || src.includes('/adobe/assets/');
  } catch {
    return false;
  }
}

function readImageUrl(cell) {
  const link = cell.querySelector('a[href]');
  if (link && isImageUrl(link.href)) {
    return link.href;
  }

  const text = cell.textContent.trim();
  if (isImageUrl(text)) {
    return text;
  }

  const img = cell.querySelector('picture img, img');
  if (img?.src && isImageUrl(img.src) && isDeliveryOrExternalUrl(img.src)) {
    return img.src;
  }

  return null;
}

function readImageAlt(cell, src) {
  const img = cell.querySelector('picture img, img');
  if (img?.alt && img.alt !== src) {
    return img.alt;
  }

  const link = cell.querySelector('a[href]');
  if (link && isImageUrl(link.href)) {
    const label = link.textContent.trim();
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

function isImageRow(row) {
  const cell = row.querySelector(':scope > div');
  if (!cell || cell.querySelector('.button-container, a.button')) return false;
  return Boolean(cell.querySelector('picture') || readImageUrl(cell));
}

function buildPicture(src, alt) {
  if (isDeliveryOrExternalUrl(src)) {
    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.loading = 'lazy';
    picture.append(img);
    return picture;
  }

  return createOptimizedPicture(
    src,
    alt,
    false,
    [{ media: '(min-width: 900px)', width: '2000' }, { width: '750' }],
  );
}

function needsPictureReplacement(cell, src) {
  const picture = cell.querySelector('picture');
  if (!picture) return true;

  const img = picture.querySelector('img');
  if (!img) return true;

  if (isDeliveryOrExternalUrl(src)) {
    return img.src !== src;
  }

  return false;
}

function decorateImageRow(row, index) {
  row.classList.add(index === 0 ? 'teaser-image-desktop' : 'teaser-image-mobile');

  const cell = row.querySelector(':scope > div');
  if (!cell) return;

  const src = readImageUrl(cell);
  if (!src) return;

  let alt = readImageAlt(cell, src);

  const nextRow = row.nextElementSibling;
  if (nextRow && isAltOnlyRow(nextRow)) {
    alt = nextRow.querySelector(':scope > div').textContent.trim();
    nextRow.remove();
  }

  if (!needsPictureReplacement(cell, src)) {
    const img = cell.querySelector('picture img, img');
    if (img && alt && img.alt !== alt) {
      img.alt = alt;
    }
    return;
  }

  const picture = buildPicture(src, alt);
  moveInstrumentation(cell, picture.querySelector('img'));
  cell.textContent = '';
  cell.append(picture);
}

export default function decorate(block) {
  [...block.children]
    .filter(isImageRow)
    .forEach((row, index) => decorateImageRow(row, index));
}
