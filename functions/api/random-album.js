export async function onRequest(context) {
  const { env } = context;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const url = new URL(context.request.url);
    let cursor = url.searchParams.get('cursor') || undefined;
    const MAX_ALBUMS = 10;

    let albumList = [];
    let listComplete = false;

    while (albumList.length < MAX_ALBUMS) {
      const list = await env.img_url.list({ limit: 1000, cursor });
      const keys = list.keys || [];

      const imageKeys = keys.filter(key => {
        const name = key.name || '';
        return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
      });

      const albums = {};
      imageKeys.forEach(key => {
        const folderName = key.metadata?.folderPath || '未分类';
        if (!albums[folderName]) albums[folderName] = [];
        albums[folderName].push(key);
      });

      const pageAlbums = Object.keys(albums)
        .filter(folder => albums[folder].length >= 3)
        .map((folder, index) => {
          const photos = albums[folder];
          photos.sort((a, b) => (b.metadata?.TimeStamp || 0) - (a.metadata?.TimeStamp || 0));
          return {
            id: index + 1,
            title: folder,
            total_photos: photos.length,
            cover: `https://tg.wpys.cc/file/${photos[0].name}`,
            photos: photos.map(p => `https://tg.wpys.cc/file/${p.name}`)
          };
        });

      albumList = albumList.concat(pageAlbums);

      if (list.list_complete) {
        listComplete = true;
        break;
      }
      cursor = list.cursor;

      if (albumList.length >= MAX_ALBUMS) {
        break;
      }
    }

    const limitedAlbums = albumList.slice(0, MAX_ALBUMS);

    return new Response(JSON.stringify({
      albums: limitedAlbums,
      next_cursor: listComplete ? null : cursor,
      list_complete: listComplete
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error', message: error.message }), { status: 500, headers });
  }
}
