const https = require('https');
const url = require('url');

function getSiteData(hostname) {
  return new Promise((resolve) => {
    const targetUrl = hostname.startsWith('http') ? hostname : `https://${hostname}`;
    const parsedUrl = url.parse(targetUrl);

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path || '/',
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (SiteSağlıkAnaliz/1.0)'
      }
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate(true);
      let html = '';
      res.on('data', (chunk) => {
        if (html.length < 30000) html += chunk;
      });
      res.on('end', () => {
        resolve({
          headers: res.headers,
          cert: cert && cert.subject ? {
            subject: cert.subject,
            issuer: cert.issuer,
            valid_from: cert.valid_from,
            valid_to: cert.valid_to,
            bits: cert.bits
          } : null,
          html: html.substring(0, 20000), // Claude için yeterli
          statusCode: res.statusCode
        });
      });
    });

    req.on('error', (e) => {
      resolve({ error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout' });
    });

    req.end();
  });
}

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

  // Gerçek veri toplama
  const siteData = await getSiteData(hostname);

  const systemPrompt = `Sen bir web site teknik analiz uzmanısın. Sana bir domain adı ve o siteden toplanan gerçek veriler (headerlar, SSL bilgisi, HTML özeti) verilecek. Bu verileri kullanarak profesyonel, dürüst ve derinlemesine bir analiz yapmalısın. SADECE geçerli JSON döndür.`;

  const userPrompt = `Domain: ${hostname}
Gerçek Veriler:
${JSON.stringify(siteData, null, 2)}

Aşağıdaki JSON şemasını doldur. Tüm değerler Türkçe olsun.
ÖNEMLİ:
1. Rakip analizi kısmında bu sektördeki 3 gerçek rakibi bul ve karşılaştır.
2. Sosyal medya kısmında sitenin eksiklerini ve yapması gerekenleri belirt.
3. Güvenlik kısmında SSL, headerlar ve HTML'deki olası açıkları (XSS riskleri, eski kütüphaneler vb.) incele.
4. "kurumsal_eksikler" kısmında (telefon, adres, mail, KVKK, SSL vb.) nelerin eksik olduğunu belirt.

{
  "firma_adi": "string",
  "genel_puan": number,
  "ozet_metin": "string",
  "kurumsal_eksikler": ["string"],
  "guvenlik_basliklari": {
    "csp": {"durum": "var|yok|eksik", "aciklama": "string"},
    "hsts": {"durum": "var|yok|eksik", "aciklama": "string"},
    "x_frame": {"durum": "var|yok|eksik", "aciklama": "string"},
    "x_content_type": {"durum": "var|yok|eksik", "aciklama": "string"},
    "referrer_policy": {"durum": "var|yok|eksik", "aciklama": "string"},
    "permissions_policy": {"durum": "var|yok|eksik", "aciklama": "string"}
  },
  "ssl_detay": {
    "gecerli": boolean,
    "yayinci": "string",
    "bitis_tarihi": "string",
    "oneri": "string"
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
  "rakip_analizi": [
    {
      "rakip_ad": "string",
      "puan": number,
      "farklar": "string",
      "ustun_yanlar": ["string"]
    }
  ],
  "sosyal_medya_stratejisi": {
    "mevcut_durum": "string",
    "oneriler": ["string"],
    "platformlar": ["string"]
  },
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
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `API hatası ${response.status}: ${errText}` });
    }

    const data = await response.json();
    const raw = data.content.map(i => i.text || '').join('');
    const clean = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (pe) {
      // JSON parse hatası durumunda Claude'dan gelen ham metni logla ve hata dön
      console.error('JSON Parse Error:', pe, 'Raw content:', raw);
      return res.status(500).json({ error: 'Analiz sonuçları işlenirken bir hata oluştu (JSON Parse).' });
    }
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'İşlem hatası: ' + err.message });
  }
}
