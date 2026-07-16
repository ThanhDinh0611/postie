// ─── AI Post Generation Core ──────────────────────────────────────────────────
// Handles communication with DeepSeek API for generating Facebook post content.

export interface GenerateRequest {
  topic: string;
  hookType: string;
  formula: string;
  tone: string;
  postFormat?: 'Post' | 'Reel' | 'Video';
  wikiSlug?: string;
  allowWebSearch?: boolean;
  brandVoice?: string;
}

export interface GenerateResponse {
  content: string;
  selectedHook: string;
  formulaApplied: string;
  variants: string[];
  tokenUsage: { input: number; output: number; total: number } | null;
}

const VIETNAMESE_HOOKS = [
  '1. Sự thật thú vị (Interesting fact)',
  '2. Câu chuyện hấp dẫn (Story - STAR model)',
  '3. Câu hỏi kích thích tư duy (Thought-provoking question)',
  '4. Hot trend (Trending topic)',
  '5. Số liệu cụ thể (Specific numbers)',
  '6. Thông tin thiếu (Incomplete info / curiosity)',
  '7. Bí mật / Bí quyết (Secret / Tip)',
  '8. Tuyên bố gây sốc (Shocking statement)',
  '9. Nếu... thì... (If... then...)',
  '10. Hậu trường (Behind-the-scenes)',
];

const FORMULAS = [
  'PAS (Problem-Agitation-Solution)',
  'AIDA (Attention-Interest-Desire-Action)',
  'FAB (Features-Advantages-Benefits)',
  'ABC Checklist',
];

const TONES = ['Friendly', 'Professional', 'Humorous', 'Curious', 'Formal'];

function buildPrompt(request: GenerateRequest): string {
  const isReel = request.postFormat === 'Reel' || request.postFormat === 'Video';
  const formatGuideline = isReel
    ? '\n- ĐỊNH DẠNG: Reels/Video — Viết cực kỳ ngắn gọn (dưới 80 ký tự, tối đa 150 ký tự).'
    : '';

  const brandVoiceSection = request.brandVoice
    ? `\n- HƯỚNG DẪN GIỌNG ĐIỆU THƯƠNG HIỆU:\n${request.brandVoice}`
    : '';

  return `Bạn là copywriter Facebook chuyên nghiệp, viết bài đăng Facebook bằng tiếng Việt.

YÊU CẦU:
- Chủ đề: ${request.topic}
- Loại Hook: ${request.hookType}
- Công thức: ${request.formula}
- Giọng điệu: ${request.tone}${formatGuideline}${brandVoiceSection}

QUY TẮC:
1. KHÔNG dùng các cụm từ spam: "Bạn đã bao giờ tự hỏi", "Bạn có biết rằng", "đắm chìm", "trải nghiệm", "siêu phẩm", "kiệt tác".
2. KHÔNG dùng câu mời tương tác giả tạo: "Like bài viết", "Share nếu bạn", "Tag bạn bè", "Comment 'CÓ'", "Thả tim".
3. KHÔNG để lộ nhãn công thức (AIDA, PAS, FAB) trong nội dung bài viết.
4. Sử dụng emoji phù hợp để tăng tính trực quan.
5. Giới hạn hashtag: 2-3 hashtag ở cuối bài.
6. Viết tự nhiên như người thật, tránh AI-sounding.
7. Kết thúc bằng câu hỏi mở để khuyến khích bình luận tự nhiên.

Định dạng đầu ra (XML):
<selected_hook>Tên hook đã chọn</selected_hook>
<formula_applied>Tên công thức đã áp dụng</formula_applied>
<content>Nội dung bài viết hoàn chỉnh</content>
<variant_1>Biến thể 1</variant_1>
<variant_2>Biến thể 2</variant_2>
<variant_3>Biến thể 3</variant_3>`;
}

export function parseResponse(raw: string, defaultHook: string, defaultFormula: string): GenerateResponse {
  const extract = (tag: string): string | null => {
    const match = raw.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'si'));
    return match?.[1]?.trim() ?? null;
  };

  const stripMarkdown = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const content = stripMarkdown(extract('content') ?? raw);

  const variants = [];
  for (let i = 1; i <= 3; i++) {
    const v = extract(`variant_${i}`);
    if (v) variants.push(stripMarkdown(v));
  }
  if (variants.length === 0) variants.push(content);

  return {
    content,
    selectedHook: extract('selected_hook') ?? defaultHook,
    formulaApplied: extract('formula_applied') ?? defaultFormula,
    variants,
    tokenUsage: null,
  };
}

export async function generatePostContent(
  request: GenerateRequest,
  apiKey: string,
): Promise<GenerateResponse> {
  if (!apiKey) {
    return {
      content: `Đây là bài viết mẫu được tạo tự động bởi Postie cho chủ đề: "${request.topic}".\n\n📌 Bài viết đã được áp dụng công thức ${request.formula} và tối ưu hóa theo tông giọng ${request.tone}.\n\nBạn nghĩ sao về giải pháp này? Hãy để lại bình luận bên dưới nhé! 👇\n\n#postie #facebookmarketing`,
      selectedHook: request.hookType,
      formulaApplied: request.formula,
      variants: [
        `Biến thể 1: Bạn đang tìm kiếm giải pháp cho "${request.topic}"? Đọc ngay bài viết này để biết cách tối ưu hóa hiệu quả với công thức ${request.formula}. #marketing`,
        `Biến thể 2: Hậu trường câu chuyện về "${request.topic}". Chia sẻ thực tế với tông giọng ${request.tone} dành cho các marketer. #marketing`,
        `Biến thể 3: Checklist 3 bước giải quyết triệt để bài toán "${request.topic}". Lưu lại ngay! #marketing`
      ],
      tokenUsage: { input: 120, output: 250, total: 370 },
    };
  }

  const prompt = buildPrompt(request);

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v3',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const result = parseResponse(data.choices[0]?.message?.content ?? '', request.hookType, request.formula);
  result.tokenUsage = {
    input: data.usage?.prompt_tokens ?? 0,
    output: data.usage?.completion_tokens ?? 0,
    total: data.usage?.total_tokens ?? 0,
  };

  return result;
}

export { VIETNAMESE_HOOKS, FORMULAS, TONES };
