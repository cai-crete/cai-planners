import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function enhanceNote(text: string): Promise<string> {
  if (!text.trim()) return text;

  const prompt = `
당신은 ES-MoE 기반의 다중 전문가 토론 엔진을 보조하는 AI 비서입니다.
사용자가 작성한 다음 노트를 더 전문적이고 구체적인 아이디어로 발전시켜 주세요.
원래의 의도를 유지하되, 논리적이고 명확한 형태로 다듬어주세요.
*주의사항*: 마크다운 문법(해시(#), 글머리기호, 표, 볼드체 등)이나 특수문자를 절대 사용하지 말고 오직 "자연어 줄글 문장"으로만 작성하세요.

원본 텍스트:
${text}
`;

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'text/plain',
        }
      });
    } catch (primaryError) {
      console.warn('Fallback to gemini-2.5-pro:', primaryError);
      response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'text/plain',
        }
      });
    }

    const resultText = response.text;
    if (!resultText) throw new Error('No response from Gemini');
    return resultText;
  } catch (error) {
    console.error('Enhance API Error:', error);
    throw error;
  }
}

export async function summarizeNote(fullText: string): Promise<string> {
  if (!fullText.trim()) return fullText;

  const prompt = `
다음 원문을 바탕으로 Sticky Note 캔버스에 표시할 짧은 요약본을 작성해주세요.
형식: [제목 (1~2줄)] / [본문 (3~4줄)] 형태로 매우 간결하게 핵심만 압축하세요.

원문:
${fullText}
`;

  try {
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'text/plain',
        }
      });
    } catch (primaryError) {
      console.warn('Fallback to gemini-2.5-pro for summary:', primaryError);
      response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          responseMimeType: 'text/plain',
        }
      });
    }

    const resultText = response.text;
    if (!resultText) throw new Error('No response from Gemini for summary');
    return resultText;
  } catch (error) {
    console.error('Summarize API Error:', error);
    throw error;
  }
}
