export async function onRequest(context) {
  const { env } = context;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const url = new URL(context.request.url);
    
    // 获取游标和本页的偏移量
    let baseCursor = url.searchParams.get('cursor') || undefined;
    let skip = parseInt(url.searchParams.get('skip') || '0', 10);
    const MAX_ALBUMS = 10; // 每次只返回 10 个专辑

    let albumList = [];
    let listComplete = false;
    let currentCursor = baseCursor;
    let nextPageCursor = baseCursor;

    // 去 KV 翻页拉取数据
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
      
      // 记录下一页的游标
      nextPageCursor = list.list_complete ? null : list.cursor;
      listComplete = list.list_complete;

      // 如果当前这页的专辑数大于 skip，说明不用去下一页找，直接在这页截取即可
      if (albumList.length > skip) {
        break;
      }
      
      // 如果当前页的专辑数不够扣，说明这页已经被彻底跳过了，去下一页
      skip -= albumList.length;
      currentCursor = nextPageCursor;

      // 如果真拉到底了，退出循环
      if (listComplete) break;
    }

    // 开始截取当前页要返回的数据
    let limitedAlbums = [];
    let nextCursor = null;
    let nextSkip = 0;

    if (albumList.length > skip) {
      // 截取 10 个专辑
      limitedAlbums = albumList.slice(skip, skip + MAX_ALBUMS);

      // 判断这 1000 张图分出的专辑，是不是还没被掏空
      if (skip + MAX_ALBUMS < albumList.length) {
        // 这页还有剩，游标保持当前的，让脚本带着新的 skip 再来拿剩余部分
        nextCursor = baseCursor; 
        nextSkip = skip + MAX_ALBUMS;
      } else {
        // 这页刚好掏空了，游标指向真正的下一页
        nextCursor = nextPageCursor;
        nextSkip = 0;
      }
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
