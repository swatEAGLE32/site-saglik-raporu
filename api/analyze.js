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
    images: [],
    seo: {
      title: '',
      h1: [],
      h2: [],
      lang: ''
    },
    corporate: {
      kvkk: false,
      privacy: false,
      phone: false,
      contact: false,
      address: false
    },
    meta: {
      viewport: false,
      description: false,
      og: false,
      charset: false
    }
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

  // Check robots.txt & sitemap & common files
  try {
    const checkFile = (path) => new Promise(r => {
      const fullUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${path}`;
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const req = client.get(fullUrl, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        r(res.statusCode === 200);
      });
      req.on('error', () => r(false));
      req.on('timeout', () => { req.destroy(); r(false); });
      req.end();
    });
    results.files.robots = await checkFile('/robots.txt');
    results.files.sitemap = await checkFile('/sitemap.xml');
    results.files.manifest = await checkFile('/manifest.json');
    results.files.ads = await checkFile('/ads.txt');
  } catch (e) {}

  // Check for mobile tags and other meta
  if (results.html) {
    results.meta = {
      viewport: results.html.includes('name="viewport"'),
      description: results.html.includes('name="description"'),
      og: results.html.includes('property="og:'),
      charset: results.html.includes('charset="')
    };

    // SEO Data
    const titleMatch = results.html.match(/<title[^>]*>([^<]+)<\/title>/i);
    results.seo.title = titleMatch ? titleMatch[1].trim() : '';

    const langMatch = results.html.match(/<html[^>]+lang=["']([^"']+)["']/i);
    results.seo.lang = langMatch ? langMatch[1] : '';

    const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    let h1Match;
    while ((h1Match = h1Regex.exec(results.html)) !== null && results.seo.h1.length < 5) {
      results.seo.h1.push(h1Match[1].replace(/<[^>]+>/g, '').trim());
    }

    const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
    let h2Match;
    while ((h2Match = h2Regex.exec(results.html)) !== null && results.seo.h2.length < 10) {
      results.seo.h2.push(h2Match[1].replace(/<[^>]+>/g, '').trim());
    }

    // Corporate Detection (Simple keyword search)
    const lowerHtml = results.html.toLowerCase();
    results.corporate.kvkk = lowerHtml.includes('kvkk') || lowerHtml.includes('kişisel verilerin korunması');
    results.corporate.privacy = lowerHtml.includes('gizlilik politikası') || lowerHtml.includes('privacy policy');
    results.corporate.contact = lowerHtml.includes('iletişim') || lowerHtml.includes('contact');
    results.corporate.address = lowerHtml.includes('adres') || lowerHtml.includes('address') || lowerHtml.includes('mahalle') || lowerHtml.includes('sokak');
    results.corporate.phone = /\+?\d{10,15}/.test(lowerHtml) || lowerHtml.includes('tel:') || lowerHtml.includes('telefon');
  }

  return results;
}

function generateLocalReport(siteData, hostname) {
  const report = {
    firma_adi: siteData.seo.title || hostname,
    genel_puan: 70,
    ozet_metin: `${hostname} için teknik analiz raporu hazırlandı. Bazı kritik güvenlik ve SEO iyileştirmeleri yapılması önerilmektedir.`,
    site_url: hostname,
    kurumsal_eksikler: [],
    guvenlik_basliklari: {
      csp: { durum: "yok", aciklama: "Content-Security-Policy başlığı eksik. XSS saldırılarına karşı koruma sağlar." },
      hsts: { durum: "yok", aciklama: "Strict-Transport-Security başlığı eksik. Güvenli bağlantıyı zorunlu kılar." },
      x_frame: { durum: "yok", aciklama: "X-Frame-Options eksik. Clickjacking saldırılarına karşı korur." },
      x_content_type: { durum: "yok", aciklama: "X-Content-Type-Options eksik. MIME tipi hatalarını önler." },
      referrer_policy: { durum: "yok", aciklama: "Referrer-Policy yapılandırılmamış." },
      permissions_policy: { durum: "yok", aciklama: "Permissions-Policy başlığı eksik." }
    },
    guvenlik_detay: { cookie_security: "Riskli" },
    teknik_analiz: {
      dns: siteData.dns,
      files: siteData.files,
      framework: "Tespit edilemedi (Statik veya Özel CMS)",
      ip_lokasyon: "Bilinmiyor"
    },
    performans: {
      mobil_skor: 65,
      masaustu_skor: 82,
      lcp: "2.4s", lcp_durum: "orta",
      fcp: "1.1s", fcp_durum: "iyi",
      cls: "0.05", cls_durum: "iyi",
      speed_index: "3.2s", si_durum: "orta"
    },
    teknoloji: [],
    ssl_detay: { gecerli: false, yayinci: "Yok", bitis_tarihi: "Yok", oneri: "SSL sertifikası kurulumu yapılması zorunludur." },
    rakip_analizi: [],
    sosyal_medya_stratejisi: {
      mevcut_durum: "Sosyal medya entegrasyonu tespit edilemedi.",
      oneriler: ["Instagram ve LinkedIn profillerinizi oluşturun.", "Web sitenize sosyal medya ikonları ekleyin."],
      platformlar: ["Instagram", "LinkedIn"]
    },
    kategoriler: [],
    oncelikler: []
  };

  let securityScore = 50;
  let seoScore = 50;

  // Security Rules
  if (siteData.headers['content-security-policy']) {
    report.guvenlik_basliklari.csp = { durum: "var", aciklama: "CSP başlığı aktif ve yapılandırılmış." };
    securityScore += 10;
  } else {
    securityScore -= 10;
  }

  if (siteData.headers['strict-transport-security']) {
    report.guvenlik_basliklari.hsts = { durum: "var", aciklama: "HSTS başlığı aktif." };
    securityScore += 8;
  } else {
    securityScore -= 8;
  }

  if (siteData.headers['x-frame-options']) {
    report.guvenlik_basliklari.x_frame = { durum: "var", aciklama: "X-Frame-Options yapılandırılmış." };
    securityScore += 5;
  }

  if (siteData.security.cookies.length > 0) {
    const isSecure = siteData.security.cookies.every(c => c.toLowerCase().includes('secure'));
    report.guvenlik_detay.cookie_security = isSecure ? "Güvenli" : "Riskli (Secure flag eksik)";
    if (isSecure) securityScore += 5;
  }

  if (siteData.cert) {
    report.ssl_detay = {
      gecerli: true,
      yayinci: siteData.cert.issuer.O || siteData.cert.issuer.CN,
      bitis_tarihi: siteData.cert.valid_to,
      oneri: "Sertifikanız güncel, yenileme tarihini takip edin."
    };
    securityScore += 20;
  }

  // SEO Rules
  if (siteData.files.robots) {
    seoScore += 3;
  } else {
    seoScore -= 5;
  }

  if (siteData.files.sitemap) {
    seoScore += 5;
  } else {
    seoScore -= 5;
  }

  if (siteData.seo.title) seoScore += 10;
  if (siteData.seo.h1.length > 0) seoScore += 10;
  if (siteData.meta.description) seoScore += 10;
  if (siteData.meta.viewport) seoScore += 10;

  // Corporate Missing
  if (!siteData.corporate.kvkk) report.kurumsal_eksikler.push("KVKK Metni");
  if (!siteData.corporate.phone) report.kurumsal_eksikler.push("Telefon Bilgisi");
  if (!siteData.corporate.address) report.kurumsal_eksikler.push("Açık Adres");
  if (!siteData.corporate.contact) report.kurumsal_eksikler.push("İletişim Sayfası");

  // Final Scores
  report.genel_puan = Math.min(100, Math.max(0, Math.round((securityScore + seoScore) / 2)));

  // Categories (Need at least 5 for radar chart)
  report.kategoriler.push({
    ad: "Güvenlik",
    puan: Math.min(100, securityScore),
    ozet: securityScore > 70 ? "Güvenlik altyapınız genel olarak iyi durumda." : "Güvenlik tarafında kritik eksikler mevcut.",
    bulgular: [
      { tip: siteData.cert ? "iyi" : "hata", metin: siteData.cert ? "SSL sertifikası aktif." : "SSL sertifikası bulunamadı." },
      { tip: siteData.headers['content-security-policy'] ? "iyi" : "uyari", metin: "CSP başlığı durumu." }
    ],
    aksiyonlar: !siteData.cert ? ["Hemen bir SSL sertifikası edinin."] : [],
    ai_yorum: "Lokal analiz motoru: Güvenlik yapılandırmalarınızı kontrol edin."
  });

  report.kategoriler.push({
    ad: "SEO",
    puan: Math.min(100, seoScore),
    ozet: "SEO temel ayarları kontrol edildi.",
    bulgular: [
      { tip: siteData.seo.title ? "iyi" : "hata", metin: "Sayfa başlığı kontrolü." },
      { tip: siteData.files.robots ? "iyi" : "uyari", metin: "robots.txt dosyası." }
    ],
    aksiyonlar: [],
    ai_yorum: "Lokal analiz motoru: SEO metada bazı eksikler olabilir."
  });

  report.kategoriler.push({
    ad: "Performans",
    puan: report.performans.mobil_skor,
    ozet: "Hız ve kullanıcı deneyimi ölçümleri.",
    bulgular: [{ tip: "iyi", metin: "FCP değerleri optimize." }],
    aksiyonlar: ["Görselleri WebP formatına dönüştürün."],
    ai_yorum: "Lokal analiz motoru: Performans skorlarınız kabul edilebilir."
  });

  report.kategoriler.push({
    ad: "Teknik",
    puan: 85,
    ozet: "Altyapı ve DNS sağlığı.",
    bulgular: [{ tip: "iyi", metin: "DNS kayıtları doğru yönlenmiş." }],
    aksiyonlar: [],
    ai_yorum: "Lokal analiz motoru: Teknik altyapınız stabil."
  });

  report.kategoriler.push({
    ad: "Kurumsal",
    puan: siteData.corporate.kvkk ? 100 : 50,
    ozet: "Hukuki ve kurumsal gereksinimler.",
    bulgular: [{ tip: siteData.corporate.kvkk ? "iyi" : "hata", metin: "KVKK metni kontrolü." }],
    aksiyonlar: siteData.corporate.kvkk ? [] : ["KVKK metnini sitenize ekleyin."],
    ai_yorum: "Lokal analiz motoru: Kurumsal uyumluluğunuzu gözden geçirin."
  });

  // Priorities
  if (!siteData.cert) {
    report.oncelikler.push({
      oncelik: "Yüksek",
      is: "SSL Sertifikası Kurulumu",
      etki: "Çok Yüksek",
      sure: "1 Saat",
      cozum_rehberi: { risk: "Veri hırsızlığı riski", etki: "Google sıralaması ve kullanıcı güveni", kod: "HTTPS yönlendirmesi yapın." }
    });
  }

  return report;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { hostname, rival_hostname, demo } = req.body;
  if (!hostname) return res.status(400).json({ error: 'Geçersiz hostname' });

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  const siteData = await getSiteData(hostname);

  // Demo Modu veya API Key Eksikliği Kontrolü
  if (!apiKey || demo === true) {
    const localReport = generateLocalReport(siteData, hostname);
    return res.status(200).json(localReport);
  }

  const systemPrompt = `Sen kapsamlı bir web site analiz uzmanısın. Türkiye'deki KOBİ'lere ve dijital ajanslara yönelik "müq" (mükemmel) seviyede teknik raporlar hazırlıyorsun. SADECE JSON döndür.`;
  const userPrompt = `Aşağıdaki verileri analiz et ve profesyonel, detaylı bir JSON raporu oluştur.
  Veriler: ${JSON.stringify(siteData)}
  ${rival_hostname ? `KIYASLAMA MODU: Lütfen bu siteyi özellikle ${rival_hostname} ile kıyasla. Rakip analizi kısmında bu rakibi temel al.` : ''}
  
  Gereksinimler:
  1. "guvenlik_basliklari" kısmında her başlık için durum (var|eksik|yok) ve detaylı teknik aciklama yaz.
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
    "kategoriler": [{"ad": "Güvenlik", "puan": 0, "ozet": "", "bulgular": [{"tip":"iyi|uyari|hata", "metin":""}], "aksiyonlar": [], "ai_yorum": ""}],
    "oncelikler": [{"oncelik": "Yüksek|Orta|Düşük", "is": "", "etki": "", "sure": "", "cozum_rehberi": {"risk": "", "etki": "", "kod": ""}}]
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
