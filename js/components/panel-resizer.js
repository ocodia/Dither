export function setupPanelResizer(inspector, handle, panel) {
  const storageKey = 'dither.layers-panel-height';
  let preferredHeight = null, drag = null;
  try {
    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isFinite(stored) && stored >= 96) preferredHeight = stored;
  } catch { /* Layout preferences are optional when browser storage is unavailable. */ }
  const bounds = () => {
    const available = inspector.clientHeight - inspector.querySelector('.inspector-tabs').offsetHeight - handle.offsetHeight;
    const max = Math.max(0, available - 80);
    return { min: Math.min(96, max), max };
  };
  function apply(height = preferredHeight) {
    if (!inspector.clientHeight) return;
    const { min, max } = bounds();
    const value = Math.round(Math.max(min, Math.min(max, height ?? Math.min(380, Math.max(180, inspector.clientHeight * .32)))));
    inspector.style.setProperty('--layers-height', `${value}px`);
    handle.setAttribute('aria-valuemin', min);
    handle.setAttribute('aria-valuemax', max);
    handle.setAttribute('aria-valuenow', value);
    handle.setAttribute('aria-valuetext', `${value} pixels`);
  }
  function persist() { try { localStorage.setItem(storageKey, String(preferredHeight)); } catch { /* Keep the session layout. */ } }
  function finish(cancel = false) {
    if (!drag) return;
    const previous = drag; drag = null;
    if (cancel) { preferredHeight = previous.preferred; apply(); }
    else { preferredHeight = panel.getBoundingClientRect().height; persist(); }
    document.body.classList.remove('resizing-panels');
    if (handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id);
  }
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    e.preventDefault(); handle.focus({ preventScroll: true });
    drag = { id: e.pointerId, y: e.clientY, height: panel.getBoundingClientRect().height, preferred: preferredHeight };
    handle.setPointerCapture(e.pointerId); document.body.classList.add('resizing-panels');
  });
  handle.addEventListener('pointermove', e => { if (drag && drag.id === e.pointerId) apply(drag.height + drag.y - e.clientY); });
  handle.addEventListener('pointerup', e => { if (drag?.id === e.pointerId) finish(); });
  handle.addEventListener('pointercancel', () => finish(true));
  handle.addEventListener('lostpointercapture', () => finish(true));
  handle.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drag) { e.preventDefault(); finish(true); return; }
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const { min, max } = bounds(), step = e.shiftKey ? 40 : 10;
    const height = e.key === 'Home' ? min : e.key === 'End' ? max : panel.getBoundingClientRect().height + (e.key === 'ArrowUp' ? step : -step);
    apply(height); preferredHeight = panel.getBoundingClientRect().height; persist();
  });
  window.addEventListener('blur', () => finish(true));
  new ResizeObserver(() => { if (!drag) apply(); }).observe(inspector);
  apply();
}
