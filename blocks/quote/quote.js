export default function decorate(block) {
    const [quoteWrapper] = block.children;

    const blockquote = doqument.createElement('blockquote');
    blockquote.textContent = quoteWrapper.textContent.trim();
    quoteWrapper.replaceWith(blockquote);
}