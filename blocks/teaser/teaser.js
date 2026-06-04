/**
 * Wrap bare text in content cells with <p> (UE may output div-only text).
 */
export default function decorate(block) {
  block.querySelectorAll(':scope > div:not(:has(picture, img)) > div').forEach((cell) => {
    if (cell.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, pre, table')) return;
    if (!cell.textContent.trim()) return;

    const p = document.createElement('p');
    while (cell.firstChild) p.append(cell.firstChild);
    cell.append(p);
  });
}
