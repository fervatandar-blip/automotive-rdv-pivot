// Light/Dark theme. The choice lives in localStorage under THEME_STORAGE_KEY
// ("light" | "dark"); with no stored choice the OS setting applies. The
// `dark` class on <html> is what Tailwind's dark: variant keys off
// (app/[lang]/globals.css).

export const THEME_STORAGE_KEY = "theme";

/**
 * Runs inline in <head> before first paint, so the page never flashes the
 * wrong theme, and keeps following the OS setting until the user picks one.
 * Kept as a plain-ES5 string: it executes before any bundle loads.
 */
export const THEME_INIT_SCRIPT = `(function(){var m=window.matchMedia("(prefers-color-scheme: dark)");function s(){try{return localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})}catch(e){return null}}function a(){var t=s();document.documentElement.classList.toggle("dark",t==="dark"||(t!=="light"&&m.matches))}a();m.addEventListener("change",a)})();`;
