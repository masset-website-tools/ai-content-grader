export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const { content, url } = req.body;
    let inputContent = content;
  
    // Fetch content from a URL if provided
    if (!content && url) {
      try {
        const pageRes = await fetch(url);
        const html = await pageRes.text();
        const textOnly = html.replace(/<[^>]*>/g, ''); // Strips HTML tags
        inputContent = textOnly.slice(0, 3000); // Limit content to avoid token issues
      } catch (err) {
        return res.status(400).json({ error: 'Failed to fetch content from URL' });
      }
    }
  
    if (!inputContent) {
      return res.status(400).json({ error: 'No content provided' });
    }
  
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'Missing OpenAI API key in environment' });
    }
  
    const prompt = `
  You are a content analyst. Grade the following content on five areas (each out of 20 points):
  
  1. Clarity & Readability  
  2. Structure & Formatting  
  3. Tone & Voice  
  4. SEO Best Practices  
  5. Value & Relevance  
  
  Then:
  - Return a total score out of 100
  - Provide 4-6 bullet-point suggestions for improvement
  
  Content to grade:
  """${inputContent}"""
  `;
  
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });
  
      const aiData = await aiRes.json();
  
      if (!aiData.choices || !aiData.choices[0]) {
        throw new Error("Invalid response from OpenAI");
      }
  
      const output = aiData.choices[0].message.content;
  
      const match = output.match(/score.*?(\d{1,3})/i);
      const score = match ? parseInt(match[1]) : null;
  
      const suggestions = output
        .split('\n')
        .filter(line => line.startsWith('-') || line.startsWith('•'))
        .slice(0, 6);
  
      res.status(200).json({ score: score || "N/A", feedback: suggestions });
    } catch (err) {
      res.status(500).json({ error: 'AI request failed', details: err.message });
    }
  }

  