// ai说明书翻译/services/geminiService.ts

const CLIENT_SCRIPT = `
<script>
/**
 * Interactive Image Upload Script for Standalone HTML
 * Allows users to click on dashed boxes to upload and insert images.
 */
(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    let currentBox = null;

    document.body.addEventListener('click', (e) => {
      const box = e.target.closest('.figure-box');
      if (box) {
        currentBox = box;
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && currentBox) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            currentBox.innerHTML = '<img src="' + base64Data + '" style="width:100%; height:100%; object-fit:contain; border-radius:4px;" />';
            currentBox.style.border = 'none';
            currentBox.style.background = 'transparent';
            currentBox.style.padding = '0';
        };
        reader.readAsDataURL(file);
      }
      fileInput.value = '';
    });
  });
})();
</script>
`;

export const reconstructManualPage = async (
  imageBase64: string,
  mimeType: string,
  pageRange: string
): Promise<string> => {
  
  try {
    // 改为调用我们自己的 Cloudflare Function
    const response = await fetch('/api/reconstruct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        pageRange
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `请求失败: ${response.status}`);
    }

    const data = await response.json();
    const text = data.text || "";
    
    // 清理 Markdown 标记
    let cleanHtml = text.replace(/```html/g, '').replace(/```/g, '').trim();

    // 注入前端交互脚本
    if (cleanHtml.includes('</body>')) {
      cleanHtml = cleanHtml.replace('</body>', `${CLIENT_SCRIPT}</body>`);
    } else {
      cleanHtml += CLIENT_SCRIPT;
    }

    return cleanHtml;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};