import { documentPresetGroups } from '../model/document-presets.js';

export function setupDocumentPresets(form) {
  const select = form.elements.preset, width = form.elements.width, height = form.elements.height;
  const note = form.querySelector('#preset-note'), presets = new Map();
  select.replaceChildren(new Option('Custom size', 'custom'));
  for (const group of documentPresetGroups) {
    const element = document.createElement('optgroup'); element.label = group.name;
    for (const preset of group.presets) {
      presets.set(preset.id, { ...preset, note: preset.note || group.note });
      element.append(new Option(`${preset.name} · ${preset.width} × ${preset.height} px`, preset.id));
    }
    select.append(element);
  }
  select.value = 'landscape';
  function updateNote() {
    note.textContent = presets.get(select.value)?.note || 'Dimensions are in pixels. Choose a preset or enter a custom size.';
  }
  select.addEventListener('change', () => {
    const preset = presets.get(select.value);
    if (preset) { width.value = preset.width; height.value = preset.height; }
    form.querySelector('#new-error').textContent = ''; updateNote();
  });
  for (const input of [width, height]) input.addEventListener('input', () => { select.value = 'custom'; updateNote(); });
  form.querySelector('#swap-dimensions').addEventListener('click', () => {
    [width.value, height.value] = [height.value, width.value];
    const preset = presets.get(select.value);
    if (preset) {
      // Preserve the chosen use and its print-resolution hint when rotating it.
      updateNote();
      if (Number(width.value) !== preset.width) note.textContent += ' Width and height swapped.';
    } else updateNote();
    form.querySelector('#new-error').textContent = '';
  });
  updateNote();
}
