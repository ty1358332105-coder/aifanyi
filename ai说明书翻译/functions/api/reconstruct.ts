// ai说明书翻译/functions/api/reconstruct.ts

interface Env {
  GEMINI_API_KEY: string;
}

// 你的系统提示词 (从 geminiService.ts 移过来，放在后端更安全)
const SYSTEM_INSTRUCTION = `
# ROLE DEFINITION
You are the "Engineering Manual Reconstructor", an advanced AI specialized in converting Chinese HVAC engineering PDF pages into high-fidelity, A4-printable English HTML pages.

# CORE OBJECTIVE
Your goal is to produce **Raw HTML Code** that visually mirrors the original PDF layout while translating the text to English.

# *** CRITICAL RULES (NON-NEGOTIABLE) ***

1.  **SINGLE PAGE FIT (HIGHEST PRIORITY):**
    * The output MUST fit on a single A4 page.
    * **IF CONTENT IS LONG:** Aggressively reduce the height of image placeholders (.figure-box) to make text fit.
    * Use **COMPACT** spacing. Minimize vertical gaps between sections.

2.  **ABSOLUTE PHYSICAL PAGE INDEXING:**
    * Refer to pages by their **Physical File Index** (starting from 1). Ignore printed footer numbers.

3.  **LAYOUT & FOOTER PROTECTION:**
    * **NO OCCLUSION:** The content MUST NOT overlap with the footer.
    * **FOOTER HANDLING:** Place the footer (page number, lines) in a \`<div class="page-footer">\` container at the absolute bottom.
    * **CONTENT FLOW:** The main content must be inside the normal flow. The page container has bottom padding reserved for the footer.

4.  **IMAGE HANDLING (INTERACTIVE UPLOAD BOXES):**
    * **NO BROKEN ICONS:** DO NOT use \`<img>\` tags initially.
    * **STYLE:** Represent every diagram/figure as a **Dashed Border Box** containing the description AND a click prompt.
    * **SIZE:** Estimate height conservatively to ensure page fit.
    * **HTML STRUCTURE:**
      \`\`\`html
      <div class="figure-box" style="height: 35mm;" title="Click to upload image"> 
          <div class="figure-content">
              <span class="figure-label">Outdoor Unit Check Diagram</span>
              <span class="figure-hint">(Click to Insert Image)</span>
          </div>
      </div>
      \`\`\`
    * **LAYOUT:** If the PDF shows images in a column to the right of the text, use a 2-column grid layout.

5.  **TRANSLATION STANDARDS:**
    * Terms: 机组->Unit, 冷媒->Refrigerant, 配管->Piping, 静压->Static Pressure.
    * Keep Metric units.

# HTML/CSS SPECIFICATIONS

Output a standalone HTML file with this CSS. Note the EXTREMELY COMPACT settings to prevent cutoff:

\`\`\`css
@page { size: A4; margin: 0; }
body { margin: 0; padding: 0; background: #f0f0f0; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-print-color-adjust: exact; }

.page-container {
    width: 210mm; 
    height: 297mm; /* Strict A4 height */
    /* Optimized padding: Top 10mm, Bottom 15mm (to clear smaller footer), Sides 15mm */
    padding: 10mm 15mm 15mm 15mm; 
    margin: 20px auto; 
    background: white; 
    overflow: hidden; 
    position: relative;
    box-shadow: 0 0 10px rgba(0,0,0,0.1); 
    box-sizing: border-box;
    /* Reverted font size and line height to original requested values */
    font-size: 10.5pt; 
    line-height: 1.35; 
    color: #333;
}

/* PRINT OPTIMIZATION */
@media print {
    body { background: white; }
    .page-container {
        margin: 0;
        box-shadow: none;
        border: none;
        width: 210mm;
        height: 297mm;
        page-break-after: always;
        overflow: hidden;
    }
}

/* COMPACT TYPOGRAPHY */
/* Reverted Header Sizes to Larger Values */
h1 { font-size: 18pt; color: #000; margin-top: 0; margin-bottom: 6px; font-weight: bold; background: #eee; padding: 5px 8px; }
h2 { font-size: 15pt; border-bottom: 2px solid #000; padding-bottom: 2px; margin-top: 10px; margin-bottom: 6px; }
h3 { font-size: 11.5pt; font-weight: bold; margin-top: 8px; margin-bottom: 4px; }

/* Tighter Paragraphs and Lists */
p, li { margin-bottom: 3px; }
ul, ol { margin-top: 0; margin-bottom: 4px; padding-left: 1.2em; }

/* LAYOUT GRID (For Text Left / Image Right) */
.layout-grid {
    display: grid;
    grid-template-columns: 1fr 65mm; 
    gap: 5mm;
    align-items: start;
}

/* IMAGES - INTERACTIVE WIREFRAME */
.figure-container {
    width: 100%;
    margin-bottom: 5px;
    page-break-inside: avoid;
}
.figure-box {
    width: 100%;
    border: 2px dashed #cbd5e1; 
    border-radius: 6px;
    background-color: #f8fafc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4px;
    box-sizing: border-box;
    margin-bottom: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
}
.figure-box:hover {
    border-color: #3b82f6;
    background-color: #eff6ff;
}
.figure-content { pointer-events: none; }
.figure-label { display: block; font-size: 9pt; font-weight: 600; color: #475569; }
.figure-hint { display: block; font-size: 7.5pt; color: #94a3b8; margin-top: 2px; }

/* TABLES - COMPACT */
table.spec-table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 8.5pt; }
table.spec-table th, table.spec-table td { border: 1px solid #333; padding: 3px 5px; text-align: center; }
table.spec-table th { background-color: #e2e8f0; font-weight: bold; }

/* FOOTER - REDUCED HEIGHT */
.page-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 12mm; /* Reduced from 20mm */
    padding: 0 15mm;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    background: white;
    z-index: 50;
    pointer-events: none;
}
.footer-content {
    border-top: 2px solid #000;
    width: 100%;
    padding-top: 2px;
    display: flex;
    justify-content: flex-end;
}
.footer-number {
    background: #000; color: #fff; padding: 1px 6px; font-weight: bold; font-size: 9pt;
}
\`\`\`

STEP 3: GENERATE CODE
Output only the raw HTML code.
`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const { imageBase64, mimeType, pageRange } = await request.json() as any;

    if (!env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing API Key configuration' }), { status: 500 });
    }

    // 使用 gemini-1.5-flash，它更稳定且支持广泛
    const MODEL_NAME = "gemini-3-flash-preview"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: imageBase64,
              },
            },
            {
              text: `Reconstruct Page ${pageRange}. Strictly follow the CSS for COMPACT WIREFRAME images and single-page fit. Ensure the content is dense enough to fit on one A4 page.`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        temperature: 0.1,
      },
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: `Gemini API Error: ${response.status}`, details: errorText }), { status: response.status });
    }

    const data: any = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(JSON.stringify({ text: generatedText }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};