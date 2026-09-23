export class ContextMenu {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'context-menu';
    this.element.setAttribute('role', 'menu');
    this.element.setAttribute('aria-label', 'Context actions');
    this.element.hidden = true;
    document.body.append(this.element);
    document.addEventListener('pointerdown', e => { if (!this.element.contains(e.target)) this.close(false); }, true);
    document.addEventListener('keydown', e => this.key(e), true);
    window.addEventListener('resize', () => this.close(false));
    window.addEventListener('blur', () => this.close(false));
    document.addEventListener('wheel', e => { if (!this.element.contains(e.target)) this.close(false); }, { capture: true, passive: true });
  }
  open(x, y, items, returnFocus) {
    this.close(false);
    this.returnFocus = returnFocus;
    this.element.replaceChildren();
    for (const item of items) {
      if (!item) {
        const separator = document.createElement('div');
        separator.setAttribute('role', 'separator'); this.element.append(separator); continue;
      }
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('role', 'menuitem'); button.tabIndex = -1;
      button.textContent = item.label; button.disabled = !!item.disabled;
      if (item.danger) button.className = 'danger';
      button.addEventListener('click', () => { this.close(); item.run(); });
      this.element.append(button);
    }
    this.element.hidden = false;
    const rect = this.element.getBoundingClientRect();
    this.element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    this.element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    this.element.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  close(restore = true) {
    if (this.element.hidden) return;
    this.element.hidden = true;
    if (restore) this.returnFocus?.()?.focus({ preventScroll: true });
  }
  key(e) {
    if (this.element.hidden) return;
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation(); this.close(); return;
    }
    // Keep editor shortcuts from modifying the selection behind an open menu.
    e.stopImmediatePropagation();
    const buttons = [...this.element.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    let next;
    if (e.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (e.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = buttons.length - 1;
    if (next !== undefined) { e.preventDefault(); buttons[next]?.focus(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement?.click(); }
  }
}
