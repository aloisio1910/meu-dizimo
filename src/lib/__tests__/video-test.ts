import { describe, expect, it } from '@jest/globals';

import { idDoYouTube, paginaDoPlayer } from '../video';

describe('idDoYouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtube.com/watch?v=aqz-KE-bpKQ&t=30s', 'aqz-KE-bpKQ'],
    ['https://m.youtube.com/watch?v=aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtu.be/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://youtu.be/aqz-KE-bpKQ?si=abc', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/shorts/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/embed/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['https://www.youtube.com/live/aqz-KE-bpKQ', 'aqz-KE-bpKQ'],
    ['  https://youtu.be/aqz-KE-bpKQ  ', 'aqz-KE-bpKQ'],
  ])('reconhece %s', (link, id) => {
    expect(idDoYouTube(link)).toBe(id);
  });

  it.each([
    'https://www.instagram.com/reel/abc123/',
    'https://vimeo.com/123456',
    'https://www.youtube.com/watch?v=curto',
    'https://www.youtube.com/channel/UC123',
    'https://evil.com/watch?v=aqz-KE-bpKQ',
    'não é um link',
    '',
    null,
  ])('não trata "%s" como vídeo do YouTube', (link) => {
    expect(idDoYouTube(link)).toBeNull();
  });
});

describe('paginaDoPlayer', () => {
  it('usa o player oficial do YouTube com o vídeo certo', () => {
    expect(paginaDoPlayer('aqz-KE-bpKQ')).toContain('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
  });
});
