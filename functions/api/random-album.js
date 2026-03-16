export async function onRequest(context) {
  const { env } = context;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const list = await env.img_url.list({ limit: 1000 });
    const keys = list.keys || [];
    
    const imageKeys = keys.filter(key => {
      const name = key.name || '';
      return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name);
    });

    if (imageKeys.length === 0) {
      return new Response(JSON.stringify({ error: 'No images found' }), { status: 404, headers });
    }

    // 按上传时间分组（假设有 TimeStamp）
    const albums = {};
    imageKeys.forEach(key => {
      const ts = key.metadata?.TimeStamp;
      let groupKey = 'default';
      if (ts) {
        const date = new Date(ts);
        groupKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
      }
      if (!albums[groupKey]) albums[groupKey] = [];
      albums[groupKey].push(key);
    });

    const albumList = Object.keys(albums)
      .filter(group => albums[group].length >= 3)
      .map(group => ({
        id: group.replace('-', ''),
        title: `${group} 专辑`,
        total_photos: albums[group].length,
        cover: `https://tg.wpys.cc/file/${albums[group][0].name}`,
        photos: albums[group].map(k => `https://tg.wpys.cc/file/${k.name}`)
      }));

    if (albumList.length === 0) {
      return new Response(JSON.stringify({ error: 'No albums found' }), { status: 404, headers });
    }

    const randomAlbum = albumList[Math.floor(Math.random() * albumList.length)];
    return new Response(JSON.stringify(randomAlbum), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
