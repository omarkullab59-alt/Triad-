// Set at build time by GitHub Actions (repository variables, not secrets: these are public URLs).
//   VITE_AI_URL        URL of the studio-ai Cloudflare Worker (Draw → live AI render)
//   VITE_DARKROOM_URL  URL of the TRIAD site's Worker (the one behind /darkroom/) for "Send to TRIAD"
const clean = (u) => (u || '').trim().replace(/\/+$/, '');
export const AI_URL = clean(import.meta.env?.VITE_AI_URL);
export const DARKROOM_URL = clean(import.meta.env?.VITE_DARKROOM_URL);
export const TRIAD_URL = 'https://omarkullab59-alt.github.io/Triad-/';
export const DARKROOM_PAGE = `${TRIAD_URL}darkroom/`;
export const INSTAGRAM = 'https://www.instagram.com/triad.closet/';
