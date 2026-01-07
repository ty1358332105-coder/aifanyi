
// ai说明书翻译/functions/api/reconstruct.ts

interface Env {
  GEMINI_API_KEY: string;

  // 推荐：用这两个拼出 Cloudflare AI Gateway provider baseUrl
  CF_ACCOUNT_ID?: string;
  CF_GATEWAY_ID?: string;

  // 可选：你也可以直接在环境变量写死完整 provider baseUrl（必须包含 /google-ai-studio）
  API_BASE_URL?: string;

  // 可选：模型名
  GEMINI_MODEL?: string;
}

// --- 核心提示词：已包含多页生成逻辑 ---
const SYSTEM_INSTRUCTION = `
# ROLE DEFINITION
You are the "Engineering Manual Reconstructor", an advanced AI specialized in converting Chinese HVAC engineering PDF pages into high-fidelity, A4-printable English HTML pages.

# CORE OBJECTIVE
Your goal is to produce **Raw HTML Code** that visually mirrors the original PDF layout.
**CRITICAL:** If the user requests multiple pages (e.g., "Pages 15-17"), you must generate **MULTIPLE** \`<div class="page-container">\` blocks—one for each physical page.

# *** CRITICAL RULES (NON-NEGOTIABLE) ***

1.  **MULTI-PAGE STRUCTURE:**
    * **DO NOT** squeeze multiple PDF pages into one HTML page.
    * **Structure:**
        \`\`\`html
        <div class="page-container" data-page="1"> ...content... <div class="page-footer">...</div> </div>
        
        <div class="page-container" data-page="2"> ...content... <div class="page-footer">...</div> </div>
        \`\`\`

2.  **SINGLE PAGE FIT (PER CONTAINER):**
    * Each \`.page-container\` must represent exactly **ONE** physical A4 page from the source.
    * Refer to pages by their **Physical File Index**.

3.  **LAYOUT & FOOTER PROTECTION:**
    * **FOOTER:** Each page container must have its own \`<div class="page-footer">\` at the absolute bottom.

4.  **IMAGE HANDLING (INTERACTIVE UPLOAD BOXES):**
    * Use the dashed border box style for diagrams.
    * **HTML STRUCTURE:**
      \`\`\`html
      <div class="figure-box" style="height: 35mm;" title="Click to upload image"> 
          <div class="figure-content">
              <span class="figure-label">Diagram Description</span>
              <span class="figure-hint">(Click to Insert Image)</span>
          </div>
      </div>
      \`\`\`

5.  **TRANSLATION STANDARDS:**
    * Terms: 机组->Unit, 冷媒->Refrigerant, 配管->Piping, 静压->Static Pressure.
    * Keep Metric units.

# HTML/CSS SPECIFICATIONS
(…你的 CSS 规范原样保留…)
STEP 3: GENERATE CODE
Output only the raw HTML code. Ensure you create a separate .page-container for each page requested.
`;

const json = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { imageBase64, mimeType, pageRange } = (await request.json()) as any;

    if (!env.GEMINI_API_KEY) {
      return json(500, { error: "Missing GEMINI_API_KEY" });
    }
    if (!imageBase64 || !mimeType || !pageRange) {
      return json(400, { error: "Missing imageBase64 / mimeType / pageRange" });
    }

    // 允许前端传 dataURL（data:image/png;base64,xxxx），这里做一次清洗
    const cleanBase64 =
      typeof imageBase64 === "string" && imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

    // --- 关键修改：确定 AI Gateway 的 Google AI Studio provider baseUrl ---
    // Cloudflare 文档：provider 基址为
    // https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/google-ai-studio
    // 并在后面拼 v1/models/{model}:{resource}（例如 :generateContent）[1](https://blog.csdn.net/2301_77187902/article/details/149547714)
    let providerBaseUrl = (env.API_BASE_URL || "").trim();

    if (!providerBaseUrl) {
      if (!env.CF_ACCOUNT_ID || !env.CF_GATEWAY_ID) {
        return json(500, {
          error:
            "Missing CF_ACCOUNT_ID/CF_GATEWAY_ID. Or set API_BASE_URL to the full google-ai-studio provider baseUrl.",
        });
      }
      providerBaseUrl = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_GATEWAY_ID}/google-ai-studio`;
    }

    // 模型名：先建议用稳定模型跑通，避免 preview 名称导致 400
    const MODEL_NAME = (env.GEMINI_MODEL || "gemini-1.5-flash").trim();

    // Cloudflare 文档给的 URL 结构：.../google-ai-studio/v1/models/{model}:generateContent [1](https://blog.csdn.net/2301_77187902/article/details/149547714)
    const API_URL = `${providerBaseUrl}/v1/models/${MODEL_NAME}:generateContent`;

    // ✅ 为了避免你之前 systemInstruction 字段在某些版本上触发 400
    // 我们把 SYSTEM_INSTRUCTION 直接作为第一段 text parts 注入（不再用顶层 systemInstruction 字段）
    const promptText = `Reconstruct Page ${pageRange}. Strictly follow the CSS for COMPACT WIREFRAME images and single-page fit. Ensure the content is dense enough to fit on one A4 page.`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_INSTRUCTION },
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
      ],
      // generationConfig 通常可用；如果你仍遇到 400，可以先注释掉这段做最小化排查
      generationConfig: {
        temperature: 0.1,
      },
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Cloudflare 文档示例：使用 x-goog-api-key 传 Google AI Studio key [1](https://blog.csdn.net/2301_77187902/article/details/149547714)
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Gemini API Error: ${response.status}`;

      try {
        const errJson = JSON.parse(errorText);
        // Gemini 常见错误结构：{ error: { message: "..." } }
        if (errJson?.error?.message) errorMsg = errJson.error.message;
      } catch (_) {}

      return json(response.status, {
        error: errorMsg,
        details: errorText,
        debug: {
          apiUrl: API_URL,
          baseUrlUsed: providerBaseUrl,
          model: MODEL_NAME,
        },
      });
    }

    const data: any = await response.json();

    // Gemini REST 常见返回：candidates[0].content.parts[0].text
    const generatedText =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    return json(200, {
      text: generatedText,
      debug: { baseUrlUsed: providerBaseUrl, model: MODEL_NAME },
    });
  } catch (error: any) {
    return json(500, { error: error?.message || String(error) });
  }
};
