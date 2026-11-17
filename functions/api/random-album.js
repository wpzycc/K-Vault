export async function onRequest(context) {
  const { env } = context;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const url = new URL(context.request.url);
    
    // 获取游标和偏移量
    let baseCursor = url.searchParams.get('cursor') || undefined;
    let skip = parseInt(url.searchParams.get('skip') || '0', 10);
    const MAX_ALBUMS = 10;

    let albumList = [];
    let listComplete = false;
    let currentCursor = baseCursor;

    // 翻页拿数据
    while (true) {
      const list = await env.img_url.list({ limit: 1000, cursor: currentCursor });
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

      albumList = pageAlbums;
      
      if (list.list_complete) {
        listComplete = true;
        currentCursor = null;
        break;
      }
      currentCursor = list.cursor;
      
      if (albumList.length > skip) {
        break;
      }
      
      skip -= albumList.length;
    }

    // 开始截取数据
    let limitedAlbums = [];
    let nextCursor = null;
    let nextSkip = 0;

    if (albumList.length > skip) {
      // 截取 10 个
      limitedAlbums = albumList.slice(skip, skip + MAX_ALBUMS);

      // 判断这页是不是还没被掏空
      if (skip + MAX_ALBUMS < albumList.length) {
        // 这页还有剩，游标保持当前的，让脚本带着 skip 再来一次
        nextCursor = baseCursor; 
        nextSkip = skip + MAX_ALBUMS;
      } else {
        // 这页刚好掏空了，游标指向下一页
        nextCursor = listComplete ? null : currentCursor;
        nextSkip = 0;
      }
    } else {
      nextCursor = listComplete ? null : currentCursor;
      nextSkip = 0;
    }

    return new Response(JSON.stringify({
      albums: limitedAlbums,
      next_cursor: nextCursor,
      next_skip: nextSkip,
      list_complete: listComplete && nextCursor === null
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error', message: error.message }), { status: 500, headers });
  }
}
