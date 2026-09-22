import { uid } from './document.js';
export const effectTypes = ['brightness', 'contrast', 'dither', 'colour-overlay', 'stroke', 'blur', 'drop-shadow'];
export const effectDefinitions = {
  brightness: { label: 'Brightness', defaults: { amount: 0 }, fields: [['amount', 'Amount', -100, 100, 1]] },
  contrast: { label: 'Contrast', defaults: { amount: 0 }, fields: [['amount', 'Amount', -100, 100, 1]] },
  dither: { label: 'Dither', defaults: { algorithm: 'floyd-steinberg', intensity: 1 }, fields: [['intensity', 'Intensity', 0, 1, 0.01]] },
  'colour-overlay': { label: 'Colour overlay', defaults: { colour: '#6799f5', opacity: 0.5, blendMode: 'normal' }, fields: [['colour', 'Colour', 'color'], ['opacity', 'Opacity', 0, 1, 0.01]] },
  stroke: { label: 'Stroke', defaults: { colour: '#ffffff', width: 4, opacity: 1, position: 'outside' }, fields: [['colour', 'Colour', 'color'], ['width', 'Width', 0, 24, 1], ['opacity', 'Opacity', 0, 1, 0.01]] },
  blur: { label: 'Blur', defaults: { radius: 4 }, fields: [['radius', 'Radius', 0, 40, 1]] },
  'drop-shadow': { label: 'Drop shadow', defaults: { colour: '#000000', opacity: 0.5, offsetX: 12, offsetY: 12, blur: 12 }, fields: [['colour', 'Colour', 'color'], ['opacity', 'Opacity', 0, 1, 0.01], ['offsetX', 'Horizontal', -100, 100, 1], ['offsetY', 'Vertical', -100, 100, 1], ['blur', 'Blur', 0, 40, 1]] }
};
export function createEffect(type) { return { id: uid(), type, enabled: true, ...effectDefinitions[type].defaults }; }
export function setEffect(layer, type, patch) {
  let effect = layer.effects.find(e => e.type === type);
  if (!effect) { effect = createEffect(type); layer.effects.push(effect); layer.effects.sort((a, b) => effectTypes.indexOf(a.type) - effectTypes.indexOf(b.type)); }
  Object.assign(effect, patch);
}
