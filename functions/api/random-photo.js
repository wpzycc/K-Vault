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
    
    const randomIndex = Math.floor(Math.random() * imageKeys.length);
    const randomImage = imageKeys[randomIndex];
    
    return new Response(JSON.stringify({
      url: `https://tg.wpys.cc/file/${randomImage.name}`,
      name: randomImage.metadata?.fileName || randomImage.name
    }), { headers });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
