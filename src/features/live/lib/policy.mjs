/**
 * Operator-reviewed, exact host allowlists. Adding a host does NOT grant rights.
 * Add only a broadcaster's documented embed/media host after verifying a licence.
 * This is shared by Zod validation, adapters, discovery and next.config CSP.
 * No wildcards, HTTP, IPs, userinfo, nonstandard ports or video proxy are allowed.
 */
export const livePolicy = Object.freeze({
  iframeHosts: ['www.scorebat.com'],
  hlsHosts: [],
  // Include the licensed CDN's segment/key hosts as well as its manifest host.
  mediaHosts: [],
  externalHosts: [
    'www.youtube.com', 'youtube.com', 'youtu.be',
    'www.twitch.tv', 'twitch.tv', 'www.scorebat.com',
    'www.beinsports.com', 'beinsports.com', 'www.tod.tv', 'tod.tv',
    'www.dazn.com', 'dazn.com', 'www.fifa.com', 'fifa.com', 'www.plus.fifa.com', 'plus.fifa.com',
  ],
});

/** @param {string} value */
export function secureUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    if (url.hash || url.hostname === 'localhost' || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) || url.hostname.includes(':')) return null;
    return url;
  } catch { return null; }
}

/** @param {string} value @param {readonly string[]} hosts */
export function approvedUrl(value, hosts) {
  const url = secureUrl(value);
  return Boolean(url && hosts.includes(url.hostname));
}

/** @param {string} value */
export function scorebatUrl(value) {
  const url = secureUrl(value);
  return Boolean(url && url.hostname === 'www.scorebat.com' && /^\/embed\/[a-zA-Z0-9/_-]+\/?$/.test(url.pathname));
}

/** @param {string} value */
export function isYouTubeId(value) { return /^[a-zA-Z0-9_-]{11}$/.test(value); }

/** @param {string} value */
export function isTwitchChannel(value) { return /^[a-zA-Z0-9_]{3,25}$/.test(value); }

export function liveFrameSources() {
  return [
    'https://www.youtube-nocookie.com', 'https://www.youtube.com',
    'https://player.twitch.tv', 'https://www.scorebat.com',
    ...livePolicy.iframeHosts.map((host) => `https://${host}`),
  ].filter((value, index, values) => values.indexOf(value) === index);
}
