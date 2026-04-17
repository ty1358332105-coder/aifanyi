// ai说明书翻译/functions/api/reconstruct.ts

interface Env {
  GEMINI_API_KEY: string;
  API_BASE_URL?: string;
}

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

Output a standalone HTML file. Note the CSS changes to support scrolling and printing multiple pages:

\`\`\`css
@page { size: A4; margin: 0; }
body {
margin: 0; padding: 20px; background: #525659;
font-family: 'Helvetica Neue', Arial, sans-serif;
-webkit-print-color-adjust: exact;
display: flex; flex-direction: column; align-items: center; gap: 20px;
}
.page-container {
width: 210mm; height: 297mm;
padding: 10mm 15mm 15mm 15mm;
background: white; overflow: hidden; position: relative;
box-shadow: 0 4px 15px rgba(0,0,0,0.3);
box-sizing: border-box; font-size: 10.5pt; line-height: 1.35; color: #333;
page-break-after: always;
}
.page-container:last-child { page-break-after: auto; }
@media print {
  body { background: white; padding: 0; gap: 0; display: block; }
  .page-container { margin: 0; box-shadow: none; border: none; width: 210mm; height: 297mm; overflow: hidden; }
}
h1 { font-size: 18pt; color: #000; margin-top: 0; margin-bottom: 6px; font-weight: bold; background: #eee; padding: 5px 8px; }
h2 { font-size: 15pt; border-bottom: 2px solid #000; padding-bottom: 2px; margin-top: 10px; margin-bottom: 6px; }
h3 { font-size: 11.5pt; font-weight: bold; margin-top: 8px; margin-bottom: 4px; }
p, li { margin-bottom: 3px; }
ul, ol { margin-top: 0; margin-bottom: 4px; padding-left: 1.2em; }
.layout-grid { display: grid; grid-template-columns: 1fr 65mm; gap: 5mm; align-items: start; }
.figure-container { width: 100%; margin-bottom: 5px; page-break-inside: avoid; }
.figure-box {
  width: 100%; border: 2px dashed #cbd5e1; border-radius: 6px; background-color: #f8fafc;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 4px; box-sizing: border-box; margin-bottom: 4px;
  cursor: pointer; transition: all 0.2s ease; overflow: hidden;
}
.figure-box:hover { border-color: #3b82f6; background-color: #eff6ff; }
.figure-content { pointer-events: none; }
.figure-label { display: block; font-size: 9pt; font-weight: 600; color: #475569; }
.figure-hint { display: block; font-size: 7.5pt; color: #94a3b8; margin-top: 2px; }
table.spec-table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 8.5pt; }
table.spec-table th, table.spec-table td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
table.spec-table th { background-color: #e2e8f0; font-weight: bold; }
.page-footer {
  position: absolute; bottom: 0; left: 0; width: 100%; height: 12mm;
  padding: 0 15mm; display: flex; align-items: center; justify-content: flex-end;
  background: white; z-index: 50; pointer-events: none;
}
.footer-content { border-top: 2px solid #000; width: 100%; padding-top: 2px; display: flex; justify-content: flex-end; }
.footer-number { background: #000; color: #fff; padding: 1px 6px; font-weight: bold; font-size: 9pt; }
\`\`\`

STEP 3: GENERATE CODE
Output only the raw HTML code. Ensure you create a separate .page-container for each page requested.
`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body = await request.json() as any;
    const {
      imageBase64, mimeType, pageRange,
      userApiKey, userBaseUrl,
      modelName   = 'gemini-3-flash-preview',
      apiProtocol = 'gemini',
    } = body;

    const resolvedApiKey  = userApiKey  || env.GEMINI_API_KEY;
    const resolvedBaseUrl = userBaseUrl || env.API_BASE_URL || (
      apiProtocol === 'openai'
        ? 'https://api.openai.com'
        : 'https://generativelanguage.googleapis.com'
    );

    if (!resolvedApiKey) {
      return new Response(
        JSON.stringify({ error: '未找到 API Key，请在设置中配置或联系管理员。' }),
        { status: 500 },
      );
    }

    let generatedText = '';
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    // ── Gemini 协议 ────────────────────────────────────────────────────────
    if (apiProtocol === 'gemini') {
      const API_URL = `${resolvedBaseUrl}/v1beta/models/${modelName}:generateContent`;
      const payload = {
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: `Reconstruct Page ${pageRange}. Strictly follow the CSS for COMPACT WIREFRAME images and single-page fit.` },
          ],
        }],
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig:  { temperature: 0.1 },
      };

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': resolvedApiKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        let msg = `Gemini API Error: ${res.status}`;
        try { const j = JSON.parse(errText); if (j.error?.message) msg = j.error.message; } catch {}
        return new Response(JSON.stringify({ error: msg, details: errText }), { status: res.status });
      }
      const data: any = await res.json();
      generatedText   = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const u         = data.usageMetadata || {};
      usage = {
        inputTokens:  u.promptTokenCount     || 0,
        outputTokens: u.candidatesTokenCount || 0,
        totalTokens:  u.totalTokenCount      || 0,
      };

    // ── OpenAI 兼容协议（包括 Claude）────────────────────────────────────
    } else if (apiProtocol === 'openai') {
      const API_URL = `${resolvedBaseUrl}/v1/chat/completions`;
      const payload = {
        model: modelName,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: 'text', text: `Reconstruct Page ${pageRange}. Strictly follow the CSS for COMPACT WIREFRAME images and single-page fit.` },
            ],
          },
        ],
      };

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resolvedApiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        let msg = `API Error: ${res.status}`;
        try { const j = JSON.parse(errText); if (j.error?.message) msg = j.error.message; } catch {}
        return new Response(JSON.stringify({ error: msg, details: errText }), { status: res.status });
      }
      const data: any = await res.json();
      generatedText   = data.choices?.[0]?.message?.content || '';
      const u         = data.usage || {};
      usage = {
        inputTokens:  u.prompt_tokens     || 0,
        outputTokens: u.completion_tokens || 0,
        totalTokens:  u.total_tokens      || 0,
      };

    } else {
      return new Response(JSON.stringify({ error: `不支持的协议: ${apiProtocol}` }), { status: 400 });
    }

    return new Response(JSON.stringify({ text: generatedText, usage }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
