interface YouTubePlayer {
  destroy: () => void;
  playVideo: () => void;
}
interface YouTubeNamespace {
  Player: new (element: HTMLElement, options: {
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onError: (event: { data: number }) => void;
      onStateChange: (event: { data: number }) => void;
    };
  }) => YouTubePlayer;
}
declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let pending: Promise<YouTubeNamespace> | null = null;

/** One script for all players. Rejected loads can be explicitly retried. */
export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('#kora-youtube-api');
    const previous = window.onYouTubeIframeAPIReady;
    const fail = () => {
      clearTimeout(timer); script?.remove(); pending = null;
      window.onYouTubeIframeAPIReady = previous;
      reject(new Error('YouTube API unavailable'));
    };
    const timer = setTimeout(fail, 12_000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      try { previous?.(); } catch { /* a third-party callback must not break this player */ }
      if (window.YT?.Player) resolve(window.YT); else fail();
    };
    if (!script) {
      script = document.createElement('script'); script.id = 'kora-youtube-api';
      script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.referrerPolicy = 'strict-origin-when-cross-origin';
      script.addEventListener('error', fail, { once: true }); document.head.appendChild(script);
    }
  });
  return pending;
}
