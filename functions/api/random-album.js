export async function onRequest(context) {
  const { env } = context;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // 从 KV 获取所有图片
    const list = await env.img_url.list({ limit: 1000 });
    const keys = list.keys || [];
    
    // 过滤出图片文件
    const imageKeys = keys.filter(key => {
      const name = key.name || '';
      return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
    });

    if (imageKeys.length === 0) {
      return new Response(JSON.stringify({ error: 'No images found' }), { 
        status: 404, 
        headers 
      });
    }

    // 按文件夹（专辑名）分组
    const albums = {};
    imageKeys.forEach(key => {
      // 从 metadata 中获取 folderPath，如果没有就放到"未分类"
      const folderName = key.metadata?.folderPath || '未分类';
      
      if (!albums[folderName]) {
        albums[folderName] = [];
      }
      albums[folderName].push(key);
    });

    // 转换成专辑列表，过滤掉图片太少的（比如少于3张）
    const albumList = Object.keys(albums)
      .filter(folder => albums[folder].length >= 3)
      .map((folder, index) => {
        const photos = albums[folder];
        // 按上传时间排序，最新的在前
        photos.sort((a, b) => {
          const ta = a.metadata?.TimeStamp || 0;
          const tb = b.metadata?.TimeStamp || 0;
          return tb - ta;
        });
        
        return {
          id: index + 1,
          title: folder,  // 直接用文件夹名作为专辑名
          total_photos: photos.length,
          cover: `https://tg.wpys.cc/file/${photos[0].name}`,
          photos: photos.map(p => `https://tg.wpys.cc/file/${p.name}`)
        };
      });

    if (albumList.length === 0) {
      return new Response(JSON.stringify({ error: 'No albums found' }), { 
        status: 404, 
        headers 
      });
    }

    // 随机返回一个专辑
    const randomAlbum = albumList[Math.floor(Math.random() * albumList.length)];
    return new Response(JSON.stringify(randomAlbum), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Server error', 
      message: error.message 
    }), { status: 500, headers });
  }
}
