import { clone } from '../model/document.js';
export class History {
  constructor(onChange = () => {}) { this.onChange = onChange; this.reset(); }
  reset() { this.undoStack = []; this.redoStack = []; this.state = 0; this.next = 1; this.saved = 0; }
  get dirty() { return this.state !== this.saved; }
  markSaved(state = this.state) { this.saved = state; this.onChange(); }
  execute(command) { command.redo(); this.record(command); }
  record(command) {
    command.beforeState = this.state; command.afterState = this.next++;
    this.state = command.afterState; this.undoStack.push(command); this.redoStack = [];
    if (this.undoStack.length > 150) this.undoStack.shift();
    this.onChange();
  }
  undo() { const command = this.undoStack.pop(); if (!command) return; command.undo(); this.state = command.beforeState; this.redoStack.push(command); this.onChange(); }
  redo() { const command = this.redoStack.pop(); if (!command) return; command.redo(); this.state = command.afterState; this.undoStack.push(command); this.onChange(); }
}
export function patchCommand(target, before, after, label = 'Change properties') {
  const a = clone(before), b = clone(after);
  return { label, undo: () => Object.assign(target, clone(a)), redo: () => Object.assign(target, clone(b)) };
}
export function insertCommand(doc, layer, index = doc.layers.length) {
  return { label: 'Add layer', redo: () => doc.layers.splice(index, 0, layer), undo: () => doc.layers.splice(doc.layers.indexOf(layer), 1) };
}
export function deleteCommand(doc, layer) {
  const index = doc.layers.indexOf(layer);
  return { label: 'Delete layer', redo: () => doc.layers.splice(doc.layers.indexOf(layer), 1), undo: () => doc.layers.splice(index, 0, layer) };
}
export function orderCommand(doc, layer, next) {
  const previous = doc.layers.indexOf(layer);
  const move = index => { doc.layers.splice(doc.layers.indexOf(layer), 1); doc.layers.splice(index, 0, layer); };
  return { label: 'Reorder layer', redo: () => move(next), undo: () => move(previous) };
}
