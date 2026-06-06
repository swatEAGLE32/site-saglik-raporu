const https = require('https');
const http = require('http');
const url = require('url');
const dns = require('dns').promises;

async function getSiteData(hostname) {
  const targetUrl = hostname.startsWith('http') ? hostname : `https://${hostname}`;
  const parsedUrl = url.parse(targetUrl);
  const results = {
    url: targetUrl,
    hostname: parsedUrl.hostname,
    headers: {},
    cert: null,
    html: '',
    statusCode: null,
    dns: {},
    files: { robots: false, sitemap: false },
    security: {
      cookies: [],
      cors: null
    },
    location: null,
    links: [],
    images: []
  };

  // DNS Lookup
  try {
    results.dns.a = await dns.resolve4(parsedUrl.hostname).catch(() => []);
    results.dns.mx = await dns.resolveMx(parsedUrl.hostname).catch(() => []);
    results.dns.txt = await dns.resolveTxt(parsedUrl.hostname).catch(() => []);
  } catch (e) {}

  // Main Request
  try {
    const mainReq = await new Promise((resolve) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.protocol === 'https:' ? 443 : 80,
        path: parsedUrl.path || '/',
        method: 'GET',
        timeout: 6000,
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'Mozilla/5.0 (SiteSağlıkAnaliz/1.1)' }
      };

      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        results.headers = res.headers;
        results.statusCode = res.statusCode;
        results.security.cookies = res.headers['set-cookie'] || [];
        results.security.cors = res.headers['access-control-allow-origin'] || 'Yok';
        
        if (parsedUrl.protocol === 'https:') {
          const cert = res.socket.getPeerCertificate(true);
          results.cert = cert && cert.subject ? {
            subject: cert.subject,
            issuer: cert.issuer,
            valid_from: cert.valid_from,
            valid_to: cert.valid_to
          } : null;
        }

        let body = '';
        res.on('data', (chunk) => { if (body.length < 50000) body += chunk; });
        res.on('end', () => resolve(body));
      });
      req.on('error', () => resolve(''));
      req.on('timeout', () => { req.destroy(); resolve(''); });
      req.end();
    });
    results.html = mainReq;
  } catch (e) {}

  // Parse HTML for images and links
  if (results.html) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(results.html)) !== null && results.images.length < 10) {
      const tag = match[0];
      const src = match[1];
      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      results.images.push({
        src,
        alt: altMatch ? altMatch[1] : null,
        isWebp: src.toLowerCase().endsWith('.webp')
      });
    }

    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    while ((match = linkRegex.exec(results.html)) !== null && results.links.length < 10) {
      results.links.push(match[1]);
    }
  }

  // Check robots.txt & sitemap
  try {
    const checkFile = (path) => new Promise(r => {
      const fullUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${path}`;
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.get(fullUrl, { timeout: 3000 }, (res) => {
        r(res.statusCode === 200);
      });
      req.on('error', () => r(false));
      req.on('timeout', () => { req.destroy(); r(false); });
      req.end();
    });
    results.files.robots = await checkFile('/robots.txt');
    results.files.sitemap = await checkFile('/sitemap.xml');
  } catch (e) {}

  return results;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { hostname, rival_hostname } = req.body;
  if (!hostname) return res.status(400).json({ error: 'Geçersiz hostname' });

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'API key eksik' });

  const siteData = await getSiteData(hostname);

  const systemPrompt = `Sen kapsamlı bir web site analiz uzmanısın. SADECE JSON döndür.`;
  const userPrompt = `Aşağıdaki verileri analiz et ve detaylı bir JSON raporu oluştur.
  Veriler: ${JSON.stringify(siteData)}
  ${rival_hostname ? `KIYASLAMA MODU: Lütfen bu siteyi özellikle ${rival_hostname} ile kıyasla.` : ''}
  
  Gereksinimler:
  1. "guvenlik_basliklari" kısmında her başlık için durum (var|eksik|yok) ve aciklama yaz.
  2. "performans" kısmında skorlar ve durumlar (iyi|orta|riskli) olmalı.
  3. "teknoloji" kısmında tespit ettiğin dilleri/araçları listele.
  4. "rakip_analizi": 3 gerçek rakip.
  5. "kurumsal_eksikler": Sitede eksik olan kurumsal öğeler.
  6. "ssl_detay": SSL verisinden yola çıkarak dürüst bir özet.
  
  JSON Şeması (BU ŞEMAYA KESİNLİKLE UY):
  {
    "firma_adi": "",
    "genel_puan": 0,
    "ozet_metin": "",
    "site_url": "${hostname}",
    "kurumsal_eksikler": ["Telefon", "KVKK Metni", "..."],
    "guvenlik_basliklari": {
      "csp": {"durum": "yok", "aciklama": ""},
      "hsts": {"durum": "yok", "aciklama": ""},
      "x_frame": {"durum": "yok", "aciklama": ""},
      "x_content_type": {"durum": "yok", "aciklama": ""},
      "referrer_policy": {"durum": "yok", "aciklama": ""},
      "permissions_policy": {"durum": "yok", "aciklama": ""}
    },
    "guvenlik_detay": { "cookie_security": "Güvenli|Riskli" },
    "teknik_analiz": {
      "dns": {"a": [], "mx": [], "txt": []},
      "files": {"robots": true, "sitemap": false},
      "framework": "",
      "ip_lokasyon": ""
    },
    "performans": { 
      "mobil_skor": 0, "masaustu_skor": 0, 
      "lcp": "1.2s", "lcp_durum": "iyi", 
      "fcp": "0.8s", "fcp_durum": "iyi", 
      "cls": "0.01", "cls_durum": "iyi", 
      "speed_index": "2.1s", "si_durum": "iyi" 
    },
    "teknoloji": [{"ad": "React", "var": true, "kategori": "Frontend"}],
    "ssl_detay": { "gecerli": true, "yayinci": "", "bitis_tarihi": "", "oneri": "" },
    "rakip_analizi": [{"rakip_ad": "", "puan": 0, "farklar": "", "ustun_yanlar": []}],
    "sosyal_medya_stratejisi": {"mevcut_durum": "", "oneriler": [], "platformlar": []},
    "kategoriler": [{"ad": "Güvenlik", "puan": 0, "ozet": "", "bulgular": [{"tip":"iyi|uyari|hata", "metin":""}], "aksiyonlar": []}],
    "oncelikler": [{"oncelik": "Yüksek|Orta|Düşük", "is": "", "etki": "", "sure": ""}]
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
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const raw = data.content.map(i => i.text || '').join('');
    const clean = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
    const finalJson = JSON.parse(clean);
    
    // Ensure critical fields from siteData are preserved if LLM misses them
    finalJson.site_url = hostname;
    if (!finalJson.teknik_analiz.dns.a.length) finalJson.teknik_analiz.dns = siteData.dns;
    finalJson.teknik_analiz.files = siteData.files;
    
    if (siteData.cert && !finalJson.ssl_detay.yayinci) {
      finalJson.ssl_detay.gecerli = true;
      finalJson.ssl_detay.yayinci = siteData.cert.issuer.O || siteData.cert.issuer.CN;
      finalJson.ssl_detay.bitis_tarihi = siteData.cert.valid_to;
    }

    return res.status(200).json(finalJson);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
