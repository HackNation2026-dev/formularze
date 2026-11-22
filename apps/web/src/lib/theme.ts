export type Theme = 'Light' | 'Dark' | 'System';
export const THEME_KEY = 'formgen.theme';
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme =
    theme === 'System'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'Dark'
        : 'Light'
      : theme;
}
// Skrypt wykonuje się przed pierwszym malowaniem strony.
export const themeScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=t==='Dark'||(t!=='Light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'Dark':'Light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'Dark':'Light'}})()`;
