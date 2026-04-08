import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export default async function handler(req: any, res: any) {
  // CORS — cai-canvas.vercel.app 허용
  res.setHeader('Access-Control-Allow-Origin', 'https://cai-canvas.vercel.app');
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
<<<<<<< HEAD
    const generativeModel = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash' });

    // [G1 FIX] contents가 순수 문자열로 들어올 경우 SDK가 요구하는 Content[] 형식으로 정규화
    const normalizedContents =
      typeof contents === 'string'
        ? [{ role: 'user', parts: [{ text: contents }] }]
        : Array.isArray(contents)
          ? contents
          : [{ role: 'user', parts: [{ text: String(contents) }] }];

    // 스트리밍 응답 설정
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const result = await generativeModel.generateContentStream({
      contents: normalizedContents,
      generationConfig: config,
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }

    res.end();
=======
    const response = await ai.models.generateContent({ model, contents, config });
    return res.status(200).json({ text: response.text });
>>>>>>> 251ea96745ced91f658f3b0f7371e6888fea5ff1
  } catch (error: any) {
    console.error('Gemini Streaming Error:', error);
    if (!res.writableEnded) {
      return res.status(500).json({ error: error.message });
    }
  }
}
