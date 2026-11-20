if (typeof renderMathInElement === 'function') {
  renderMathInElement(document.querySelector('.note-page'), {
    delimiters: [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
    throwOnError: false,
  });
}

const demo = document.querySelector('.boundary-demo');
const nextValue = demo.querySelector('#next-value');
function updateExample() {
  const value = Number(nextValue.value);
  const terminated = demo.querySelector('input[name="boundary"]:checked').value === 'terminated';
  const target = 1 + (terminated ? 0 : 0.99 * value);
  const advantage = target - 8;
  const signed = (number) => `${number >= 0 ? '+' : '−'}${Math.abs(number).toFixed(2)}`;
  demo.querySelector('#next-value-label').value = String(value);
  demo.querySelector('#demo-correct').textContent = `Correct target: ${target.toFixed(2)} · advantage: ${signed(advantage)}`;
  demo.querySelector('#demo-done').textContent = 'Using 1 − done: target 1.00 · advantage −7.00';
  demo.querySelector('#demo-explanation').textContent = terminated
    ? 'The task really ended, so both methods correctly drop the bootstrap value.'
    : 'The reset stops the GAE trace, but the final state still contributes value.';
}
demo.addEventListener('input', updateExample);
updateExample();
