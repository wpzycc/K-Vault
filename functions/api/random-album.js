export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  // 获取游标，如果没有就是第一页
  const cursor = url.searchParams.get("cursor") || undefined;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // 每次拉 1000 个，如果有游标就接着往后拉
    const list = await env.img_url.list({ limit: 1000, cursor });
    const keys = list.keys || [];
    const nextCursor = list.cursor || null;

    // 过滤出图片文件
    const imageKeys = keys.filter(key => {
      const name = key.name || '';
      return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
    });

    // 按文件夹（专辑名）分组
    const albums = {};
    imageKeys.forEach(key => {
      const folderName = key.metadata?.folderPath || '未分类';
      if (!albums[folderName]) {
        albums[folderName] = [];
      }
      albums[folderName].push(key);
    });

    // 转换成专辑列表（不再随机抽，把这一页的专辑全部返回）
    const albumList = Object.keys(albums).map((folder) => {
      const photos = albums[folder];
      photos.sort((a, b) => {
        const ta = a.metadata?.TimeStamp || 0;
        const tb = b.metadata?.TimeStamp || 0;
        return tb - ta;
      });
      
      return {
        id: folder, // 🌟 核心修改：用文件夹名做唯一 ID，保证跨页不冲突
        title: folder,
        total_photos: photos.length,
        cover: `https://tg.wpys.cc/file/${photos[0].name}`,
        photos: photos.map(p => `https://tg.wpys.cc/file/${p.name}`)
      };
    });

    // 返回这一页的数据和下一个游标
    return new Response(JSON.stringify({
      albums: albumList,
      next_cursor: nextCursor
    }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Server error', 
      message: error.message 
    }), { status: 500, headers });
  }
}
