export default async function handler(req, res) {
  // Sadece POST kabul et
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { hostname } = req.body;
  if (!hostname || typeof hostname !== 'string' || hostname.length > 200) {
    return res.status(400).json({ error: 'Geçersiz hostname' });
  }

  // Basit hostname doğrulama
  const hostRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-\.]{0,253}[a-zA-Z0-9]$/;
  if (!hostRegex.test(hostname)) {
    return res.status(400).json({ error: 'Geçersiz hostname formatı' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Sunucu yapılandırma hatası' });
  }

  const systemPrompt = `Sen bir web site teknik analiz uzmanısın. Kullanıcı sana bir domain adı verir, sen o domain hakkında gerçekçi bir teknik analiz JSON'u üretirsin. SADECE geçerli JSON döndür — başka hiçbir şey yazma, markdown kullanma, açıklama yapma.`;

  const userPrompt = `Domain: ${hostname}

Aşağıdaki JSON şemasını doldur. Tüm değerler Türkçe olsun. Gerçekçi ol — çoğu KOBİ sitesi eksik güvenlik başlıklarına, yavaş hıza ve mobil sorunlara sahip.

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
}

teknoloji array için: WordPress, PHP, jQuery, Google Analytics, Cloudflare, SSL/HTTPS, CDN, React/Vue/Angular değerlendir.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API hatası:', err);
      return res.status(502).json({ error: 'Analiz servisi geçici olarak kullanılamıyor' });
    }

    const data = await response.json();
    const raw = data.content.map(i => i.text || '').join('');
    const clean = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Handler hatası:', err);
    return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}
