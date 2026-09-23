import { isSelectionTool, marqueePoints, regionPath, validRegion } from '../model/pixel-region.js';
import { worldToLocal, localToWorld, hitTest } from './geometry.js';

export class PixelSelection {
  constructor(workspace, { getDocument, getLayer, select, beforeGesture, onChange, notify }) {
    Object.assign(this, { workspace, getDocument, getLayer, select, beforeGesture, onChange, notify });
    this.value = null; this.draft = null; this.closedAt = 0;
    const area = workspace.element;
    area.addEventListener('pointerdown', e => this.down(e), true);
    area.addEventListener('pointermove', e => this.move(e), true);
    area.addEventListener('pointerup', e => { if (this.draft?.pointerId === e.pointerId) { e.stopImmediatePropagation(); this.complete(); } }, true);
    area.addEventListener('pointercancel', () => this.cancelDraft(), true);
    area.addEventListener('lostpointercapture', () => { if (this.draft?.kind !== 'polygon-lasso') this.cancelDraft(); }, true);
    area.addEventListener('dblclick', e => { if (this.draft?.kind === 'polygon-lasso') { e.preventDefault(); e.stopImmediatePropagation(); this.complete(); } }, true);
  }
  eligible(layer = this.getLayer()) { return layer?.type === 'image' && layer.visible && !layer.locked; }
  current() { return this.eligible() && this.value?.layerId === this.getLayer().id ? this.value : null; }
  sync() {
    if (this.value && (!this.eligible() || this.value.layerId !== this.getLayer().id)) this.value = null;
    if (this.draft && (!this.eligible() || this.draft.layerId !== this.getLayer().id)) this.cancelDraft();
  }
  changed() { this.workspace.draw(); this.onChange(); }
  clear() { this.cancelDraft(); this.value = null; this.changed(); }
  cancelDraft() {
    if (!this.draft) return;
    const pointerId = this.draft.pointerId; this.draft = null;
    if (pointerId !== undefined && this.workspace.element.hasPointerCapture(pointerId)) this.workspace.element.releasePointerCapture(pointerId);
    this.changed();
  }
  toLocal(point, layer) {
    const local = worldToLocal(point, layer.transform);
    return { x: local.x / layer.transform.width + .5, y: local.y / layer.transform.height + .5 };
  }
  down(e) {
    if (!isSelectionTool(this.workspace.tool) || e.button !== 0 || this.workspace.space || e.target.closest('button')) return;
    e.preventDefault(); e.stopImmediatePropagation(); this.beforeGesture(); this.workspace.element.focus({preventScroll:true});
    const point = this.workspace.point(e);
    if (!this.eligible()) {
      const layer = hitTest(this.getDocument().layers.filter(l => l.type === 'image'), point);
      if (layer) this.select(layer.id);
    }
    const layer = this.getLayer();
    if (!this.eligible(layer)) { this.notify('Select an unlocked image layer first.'); return; }
    const kind = this.workspace.tool;
    if (kind === 'polygon-lasso') {
      if (!this.draft && performance.now() - this.closedAt < 300) return;
      if (this.draft) {
        const first = this.draft.points[0];
        if (this.draft.points.length >= 3 && Math.hypot(first.x - point.x, first.y - point.y) * this.workspace.view.zoom < 8) { this.complete(); return; }
        const previous = this.draft.points.at(-1);
        if (Math.hypot(previous.x - point.x, previous.y - point.y) > .01 && this.draft.points.length < 4096) this.draft.points.push(point);
        this.draft.cursor = point;
      } else this.draft = { kind, layerId: layer.id, points: [point], cursor: point };
    } else {
      this.cancelDraft(); this.draft = { kind, layerId: layer.id, start: point, cursor: point, points: [point], pointerId: e.pointerId };
      this.workspace.element.setPointerCapture(e.pointerId);
    }
    this.changed();
  }
  move(e) {
    if (!this.draft || this.workspace.gesture?.type === 'pan') return;
    e.stopImmediatePropagation(); this.workspace.pointer = {clientX:e.clientX,clientY:e.clientY};
    const point = this.workspace.point(e); this.draft.cursor = point;
    if (this.draft.kind === 'lasso') {
      const previous = this.draft.points.at(-1);
      if (Math.hypot(previous.x - point.x, previous.y - point.y) * this.workspace.view.zoom >= 2) {
        if (this.draft.points.length < 4096) this.draft.points.push(point); else this.draft.points[this.draft.points.length - 1] = point;
      }
    }
    this.changed();
  }
  draftPoints(preview = false) {
    const d = this.draft;
    if (d.kind.startsWith('marquee-')) return marqueePoints(d.start, d.cursor, d.kind === 'marquee-ellipse');
    return preview && d.kind === 'polygon-lasso' ? [...d.points, d.cursor] : d.points;
  }
  complete() {
    if (!this.draft) return false;
    const d = this.draft, layer = this.getLayer();
    if (!this.eligible(layer) || d.layerId !== layer.id) { this.cancelDraft(); return false; }
    const points = this.draftPoints().map(p => this.toLocal(p, layer));
    const width = Math.max(...points.map(p=>p.x)) - Math.min(...points.map(p=>p.x)), height = Math.max(...points.map(p=>p.y)) - Math.min(...points.map(p=>p.y));
    this.draft = null;
    if (d.pointerId !== undefined && this.workspace.element.hasPointerCapture(d.pointerId)) this.workspace.element.releasePointerCapture(d.pointerId);
    if (validRegion(points) && width > 1e-6 && height > 1e-6) this.value = { layerId: layer.id, points };
    if (d.kind === 'polygon-lasso') this.closedAt = performance.now();
    this.changed(); return true;
  }
  key(e) {
    if (e.key === 'Escape' && (this.draft || this.current())) { e.preventDefault(); this.draft ? this.cancelDraft() : this.clear(); return true; }
    if (this.draft?.kind === 'polygon-lasso' && ['Enter','Backspace','Delete'].includes(e.key)) {
      e.preventDefault(); if (e.key === 'Enter') this.complete(); else { this.draft.points.pop(); if (!this.draft.points.length) this.cancelDraft(); else this.changed(); } return true;
    }
    return false;
  }
  selectAll() {
    if (!this.eligible()) { this.notify('Select an unlocked image layer first.'); return; }
    this.cancelDraft(); this.value = { layerId: this.getLayer().id, points: marqueePoints({x:0,y:0},{x:1,y:1}) }; this.changed();
  }
  overlay(layer, zoom) {
    let points = [];
    if (this.draft?.layerId === layer.id) points = this.draftPoints(true);
    else if (this.current()) points = this.value.points.map(p => localToWorld({x:(p.x-.5)*layer.transform.width,y:(p.y-.5)*layer.transform.height},layer.transform));
    const path = regionPath(points), dash = 5 / zoom;
    if (!path) return '';
    const vertices = this.draft?.kind === 'polygon-lasso' ? this.draft.points.map((p,index)=>`<circle cx="${p.x}" cy="${p.y}" r="${(index ? 2.5 : 4)/zoom}" fill="white" stroke="#447af0" stroke-width="${1/zoom}"/>`).join('') : '';
    return `<g class="pixel-selection-outline" fill="none" stroke-width="${1/zoom}" pointer-events="none"><path d="${path}" stroke="black"/><path d="${path}" stroke="white" stroke-dasharray="${dash} ${dash}"/>${vertices}</g>`;
  }
}
