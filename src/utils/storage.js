export function loadSettings() {
  const defaults = {
    sound: true,
    highlights: true,
    animations: true,
    theme: 'wood'
  };
  const saved = localStorage.getItem('chess-settings');
  return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
}

export function saveSettings(settings) {
  localStorage.setItem('chess-settings', JSON.stringify(settings));
}
