const fs = require('fs');

async function testPrompt() {
    const reqBody = {
        model: "deepseek-ai/deepseek-v3.2",
        messages: [
            {
                role: "system",
                content: `You are an expert web developer and UI designer for a drag-and-drop website builder.
When given a user description, generate a complete, high-quality website layout (maximum 9 blocks).

CRITICAL SPEED OPTIMIZATIONS:
1. You MUST return aggressively MINIFIED JSON. Absolutely NO spaces, NO newlines, NO pretty-printing.
2. Keep all generated text copy extremely punchy and short (maximum 8-10 words per text field).
3. Do NOT include markdown formatting like \`\`\`json. Return ONLY the raw JSON array starting with '[' and ending with ']'.

Each block must follow this exact format:
{"id":"8charstr","type":"blocktype","props":{...},"style":{"animation":"...","backgroundColor":"...","textColor":"...","padding":"...","borderRadius":"...","customCss":"..."}}

Your design tasks:
1. **VIBRANT DESIGN**: Provide a style object for EVERY block. Use modern, beautiful, highly vibrant colors (e.g. #0f172a, #3b82f6) for backgroundColor, with high contrast textColor.
2. **CUSTOM CSS ANIMATIONS**: You MUST assign an entrance animation to EVERY block using raw, inline CSS inside the style.customCss string property. Write actual CSS rules (e.g. animation:slideUp 0.8s ease-out forwards;opacity:0;). Keep CSS short and optimized.
3. **Valid block types and props (KEEP PROPS SHORT):**
- hero: {title, subtitle, buttonText}
- navbar: {brand, links: [{label, url}], ctaText}
- footer: {columns: [{title, links: [string]}], copyright}
- features: {features: [{title, desc}]}

Return ONLY the minified JSON array.`
      },
      { role: "user", content: "Make me a colorful, animated landing page for a modern high-end sneaker brand with dark mode and neon accents" }
    ],
    temperature: 1,
    top_p: 0.95,
    max_tokens: 8192,
    stream: false,
  };

  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer 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"
      },
      body: JSON.stringify(reqBody)
    });
    
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "";
    console.log("RAW AI RESPONSE:");
    console.log(content.substring(0, 500) + "...");
    
    // Parse logic from routes.ts
    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const jsonMatch = cleanContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("FAILED MATCH: Did not find [ ] array boundaries.");
      return;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log("SUCCESSFULLY PARSED JSON ARRAY OF LENGTH:", parsed.length);
    console.log("First block:", JSON.stringify(parsed[0]));
    
  } catch(e) {
    console.error("ERROR:", e);
  }
}

testPrompt();
