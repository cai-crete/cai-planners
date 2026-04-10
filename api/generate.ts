import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export default async function handler(req: any, res: any) {
  // CORS — 로컬 개발 + 프로덕션 모두 허용
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://cai-canvas.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
  ];
  res.setHeader(
    'Access-Control-Allow-Origin',
    allowedOrigins.includes(origin) ? origin : 'https://cai-canvas.vercel.app'
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { model, contents, config } = req.body;
    const generativeModel = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash' });

    // contents가 순수 문자열로 들어올 경우 SDK가 요구하는 Content[] 형식으로 정규화
    const normalizedContents =
      typeof contents === 'string'
        ? [{ role: 'user', parts: [{ text: contents }] }]
        : Array.isArray(contents)
          ? contents
          : [{ role: 'user', parts: [{ text: String(contents) }] }];

    // SSE 스트리밍 응답 헤더
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx 버퍼링 비활성화

    const result = await generativeModel.generateContentStream({
      contents: normalizedContents,
      generationConfig: config,
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(chunkText);
      }
    }

    res.end();
  } catch (error: any) {
    console.error('Gemini Streaming Error:', error);
    if (!res.writableEnded) {
      res.status(500).json({ error: error.message });
    }
  }
}
