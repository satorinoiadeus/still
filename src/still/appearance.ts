export const densityOptions = ['comfortable', 'compact'] as const;
export const accentOptions = ['sage', 'clay', 'slate'] as const;
export type StillAppearance = { density: typeof densityOptions[number]; accent: typeof accentOptions[number] };
export function readAppearance(): StillAppearance {
  try {
    const value = JSON.parse(localStorage.getItem('still.appearance.v1') || '{}');
    return { density: densityOptions.includes(value?.density) ? value.density : 'comfortable',
      accent: accentOptions.includes(value?.accent) ? value.accent : 'sage' };
  } catch { return { density: 'comfortable', accent: 'sage' }; }
}
export function applyAppearance(value = readAppearance()) {
  document.documentElement.dataset.density = value.density;
  document.documentElement.dataset.accent = value.accent;
}
export function saveAppearance(value: StillAppearance) {
  localStorage.setItem('still.appearance.v1', JSON.stringify(value));
  applyAppearance(value);
}
