if (typeof renderMathInElement === 'function') {
  renderMathInElement(document.querySelector('.note-page'), {
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
    throwOnError: false,
  });
}
