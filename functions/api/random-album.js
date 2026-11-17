export async function onRequest(context) {
  const { env } = context;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const url = new URL(context.request.url);
    const rawCursor = url.searchParams.get('cursor') || '';
    const BATCH_SIZE = 10;   // 每批返回的专辑数

    // ==================== 1. 解析复合游标 "<kvCursor>|<skip>" ====================
    // 格式：
    //   ""                 → 从头开始（kvCursor=null, skip=0）
    //   "|<skip>"          → 本批 KV 起始游标为空（第一批），跳过前 skip 个
    //   "<kvCursor>|<skip>" → 本批 KV 起始游标为 kvCursor，跳过前 skip 个
    //
    // 注意：kvCursor 是"本批 KV 数据之前"的游标，不是"本批之后"的！
    //      用它 list 会重新拿到本批数据。

    let kvCursor = null;   // null 表示从 KV 开头 list
    let skip = 0;

    if (rawCursor) {
      const sepIdx = rawCursor.lastIndexOf('|');
      if (sepIdx >= 0) {
        const kvPart = rawCursor.slice(0, sepIdx);
        skip = parseInt(rawCursor.slice(sepIdx + 1), 10) || 0;
        kvCursor = kvPart === '' ? null : kvPart;
      } else {
        // 兼容纯 KV 游标（老客户端）
        kvCursor = rawCursor;
        skip = 0;
      }
    }

    // ==================== 2. 用本批起始游标 list（重读同一批） ====================
    const listParams = { limit: 1000 };
    if (kvCursor) listParams.cursor = kvCursor;
    const list = await env.img_url.list(listParams);

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

    const allAlbums = Object.keys(albums)
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

    // ==================== 3. 跳过 skip 个，返回 BATCH_SIZE 个 ====================
    const albumsOut = allAlbums.slice(skip, skip + BATCH_SIZE);
    const consumed = skip + albumsOut.length;   // 本批已消费到第几个

    // ==================== 4. 计算 next_cursor ====================
    let nextCursor = null;

    if (consumed < allAlbums.length) {
      // 本批还有剩余 → 用"本批起始游标 + 新 skip"继续
      // 注意：必须用 kvCursor（本批起始），不是 list.cursor（本批之后）
      const kvPart = kvCursor === null ? '' : kvCursor;
      nextCursor = `${kvPart}|${consumed}`;
    } else {
      // 本批掏空 → 进入下一批 KV
      if (list.list_complete) {
        nextCursor = null;   // KV 到底了
      } else {
        nextCursor = `${list.cursor}|0`;
      }
    }

    return new Response(JSON.stringify({
      albums: albumsOut,
      next_cursor: nextCursor,
      list_complete: nextCursor === null,
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Server error',
      message: error.message
    }), { status: 500, headers });
  }
}
