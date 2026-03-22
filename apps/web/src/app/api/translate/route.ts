import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { text, targetLanguage, provider, apiKey } = await req.json();

        if (!text || !targetLanguage || !apiKey) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        let translatedText = "";

        if (provider === "openai") {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: `You are a professional translator. Translate the given text to ${targetLanguage}. 
                            Maintain the same tone and context. Return ONLY the translated text without quotes or explanations.`
                        },
                        { role: "user", content: text }
                    ],
                    temperature: 0.3,
                }),
            });
            const data = await res.json();
            translatedText = data.choices[0].message.content.trim();
        } 
        else if (provider === "gemini") {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Translate the following text to ${targetLanguage}. Mantain tone. Return only translated text: "${text}"`
                        }]
                    }]
                }),
            });
            const data = await res.json();
            translatedText = data.candidates[0].content.parts[0].text.trim();
        } 
        else {
            return NextResponse.json({ error: "Provider not yet supported for translation" }, { status: 400 });
        }

        return NextResponse.json({ translatedText });
    } catch (err) {
        console.error("Translation error:", err);
        return NextResponse.json({ error: "Translation failed" }, { status: 500 });
    }
}
