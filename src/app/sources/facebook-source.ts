export function facebookSource(input: string, kind: unknown): { kind: 'group' | 'page'; url: string } | null {
  if (input.length > 500 || (kind !== 'group' && kind !== 'page')) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(url.hostname)) return null;

  const path = url.pathname.replace(/\/$/, '');
  if (kind === 'group' && /^\/groups\/[a-z0-9._-]+$/i.test(path)) {
    return { kind, url: 'https://www.facebook.com' + path.toLowerCase() };
  }
  if (kind === 'page') {
    const id = url.searchParams.get('id');
    if (path === '/profile.php' && id && /^\d+$/.test(id)) {
      return { kind, url: 'https://www.facebook.com/profile.php?id=' + id };
    }
    if (/^\/[a-z0-9._-]+$/i.test(path) &&
        !/\.php$/i.test(path) && !/^\/(groups|watch|marketplace|events|share|login|reels|pages|people|help)$/i.test(path)) {
      return { kind, url: 'https://www.facebook.com' + path.toLowerCase() };
    }
    if (/^\/people\/[a-z0-9._-]+\/\d+$/i.test(path)) {
      return { kind, url: 'https://www.facebook.com/profile.php?id=' + path.split('/').pop() };
    }
  }
  return null;
}
