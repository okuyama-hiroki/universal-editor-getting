import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function isImageUrl(url) {
  if (!url || !/^https?:\/\//.test(url)) return false;
  return /\.(avif|png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)
    || url.includes('/adobe/assets/')
    || url.includes('adobeaemcloud.com');
}

function readImageFromCell(cell) {
  const existing = cell.querySelector('picture img, img');
  if (existing) {
    return { src: existing.src, alt: existing.alt || '' };
  }

  const link = cell.querySelector('a[href]');
  if (link && isImageUrl(link.href)) {
    return {
      src: link.href,
      alt: link.getAttribute('title') || link.textContent.trim(),
    };
  }

  const text = cell.textContent.trim();
  if (isImageUrl(text)) {
    return { src: text, alt: '' };
  }

  return null;
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

function decorateImageRow(row, index) {
  row.classList.add(index === 0 ? 'teaser-image-desktop' : 'teaser-image-mobile');

  const cell = row.querySelector(':scope > div');
  if (!cell || cell.querySelector('picture')) return;

  const image = readImageFromCell(cell);
  if (!image) return;

  const nextRow = row.nextElementSibling;
  if (nextRow && isAltOnlyRow(nextRow) && !image.alt) {
    image.alt = nextRow.querySelector(':scope > div').textContent.trim();
    nextRow.remove();
  }

  const optimizedPic = createOptimizedPicture(
    image.src,
    image.alt,
    false,
    [{ media: '(min-width: 900px)', width: '2000' }, { width: '750' }],
  );
  moveInstrumentation(cell, optimizedPic.querySelector('img'));
  cell.textContent = '';
  cell.append(optimizedPic);
}

export default function decorate(block) {
  const imageRows = [...block.children].filter((row) => {
    const cell = row.querySelector(':scope > div');
    return cell && (cell.querySelector('picture') || readImageFromCell(cell));
  });

  imageRows.forEach((row, index) => decorateImageRow(row, index));
}
