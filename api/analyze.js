module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { hostname } = req.body;
  if (!hostname || typeof hostname !== 'string' || hostname.length > 200) {
    return res.status(400).json({ error: 'Geçersiz hostname' });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey || apiKey.length < 10) {
    return res.status(500).json({ error: 'API key eksik veya geçersiz — Vercel\'de kontrol et' });
  }

  const systemPrompt = `Sen bir web site teknik analiz uzmanısın. Kullanıcı sana bir domain adı verir, sen o domain hakkında gerçekçi bir teknik analiz JSON'u üretirsin. SADECE geçerli JSON döndür — başka hiçbir şey yazma, markdown kullanma, açıklama yapma.`;

  const userPrompt = `Domain: ${hostname}

Aşağıdaki JSON şemasını doldur. Tüm değerler Türkçe olsun. Gerçekçi ol.

{
  "firma_adi": "string",
  "genel_puan": number,
  "ozet_metin": "string",
  "guvenlik_basliklari": {
    "csp": {"durum": "var|yok|eksik", "aciklama": "string"},
    "hsts": {"durum": "var|yok|eksik", "aciklama": "string"},
    "x_frame": {"durum": "var|yok|eksik", "aciklama": "string"},
    "x_content_type": {"durum": "var|yok|eksik", "aciklama": "string"},
    "referrer_policy": {"durum": "var|yok|eksik", "aciklama": "string"},
    "permissions_policy": {"durum": "var|yok|eksik", "aciklama": "string"}
  },
  "performans": {
    "mobil_skor": number,
    "masaustu_skor": number,
    "lcp": "string",
    "fcp": "string",
    "cls": "string",
    "speed_index": "string",
    "lcp_durum": "iyi|orta|kotu",
    "fcp_durum": "iyi|orta|kotu",
    "cls_durum": "iyi|orta|kotu",
    "si_durum": "iyi|orta|kotu"
  },
  "teknoloji": [
    {"ad": "string", "kategori": "string", "var": true}
  ],
  "kategoriler": [
    {"ad": "Sayfa Hızı", "puan": number, "ozet": "string", "bulgular": [{"tip":"iyi|uyari|hata","metin":"string"}], "aksiyonlar": ["string"]},
    {"ad": "SEO Temelleri", "puan": number, "ozet": "string", "bulgular": [{"tip":"iyi|uyari|hata","metin":"string"}], "aksiyonlar": ["string"]},
    {"ad": "Mobil Uyumluluk", "puan": number, "ozet": "string", "bulgular": [{"tip":"iyi|uyari|hata","metin":"string"}], "aksiyonlar": ["string"]},
    {"ad": "Güvenlik", "puan": number, "ozet": "string", "bulgular": [{"tip":"iyi|uyari|hata","metin":"string"}], "aksiyonlar": ["string"]},
    {"ad": "İçerik & Kullanılabilirlik", "puan": number, "ozet": "string", "bulgular": [{"tip":"iyi|uyari|hata","metin":"string"}], "aksiyonlar": ["string"]}
  ],
  "oncelikler": [
    {"oncelik": "Yüksek|Orta|Düşük", "is": "string", "etki": "string", "sure": "string"}
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    // Hata durumunda tam mesajı döndür
    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API hatası:', response.status, errText);
      return res.status(502).json({ 
        error: `API hatası ${response.status}: ${errText}` 
      });
    }

    const data = await response.json();
    const raw = data.content.map(i => i.text || '').join('');
    const clean = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse hatası:', parseErr, 'Raw:', raw);
      return res.status(500).json({ error: 'JSON parse hatası: ' + parseErr.message });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Fetch hatası:', err);
    return res.status(500).json({ error: 'Bağlantı hatası: ' + err.message });
  }
}
