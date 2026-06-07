module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, report, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Mesaj boş' });

  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'API key eksik' });

  // Rapor özetini system prompt'a göm
  let reportContext = '';
  if (report) {
    const cats = (report.kategoriler || []).map(c => `  - ${c.ad}: ${c.puan}/100`).join('\n');
    const pris = (report.oncelikler || []).slice(0, 5).map(p => `  - [${p.oncelik}] ${p.is}`).join('\n');
    const eksikler = (report.kurumsal_eksikler || []).join(', ') || 'Yok';

    reportContext = `
## Analiz Edilen Site: ${report.site_url}
- Genel Puan: ${report.genel_puan}/100
- Firma: ${report.firma_adi}
- Özet: ${report.ozet_metin}

### Kategori Puanları:
${cats}

### SSL Durumu: ${report.ssl_detay?.gecerli ? 'Geçerli ✓' : 'GEÇERSİZ ✗'}
- Yayıncı: ${report.ssl_detay?.yayinci || 'Bilinmiyor'}
- Bitiş: ${report.ssl_detay?.bitis_tarihi || 'Bilinmiyor'}

### Güvenlik Başlıkları:
${Object.entries(report.guvenlik_basliklari || {}).map(([k, v]) => `  - ${k.toUpperCase()}: ${v.durum}`).join('\n')}

### Performans:
  - Mobil Skor: ${report.performans?.mobil_skor}
  - Masaüstü Skor: ${report.performans?.masaustu_skor}
  - LCP: ${report.performans?.lcp} (${report.performans?.lcp_durum})
  - FCP: ${report.performans?.fcp} (${report.performans?.fcp_durum})
  - CLS: ${report.performans?.cls} (${report.performans?.cls_durum})

### Kurumsal Eksikler: ${eksikler}

### Öncelikli Aksiyonlar:
${pris}
`;
  }

  const systemPrompt = `Sen "Site Sağlık Danışmanı" adlı uzman bir web site analiz asistanısın. Türkçe konuşuyorsun.

Görevin: Kullanıcının web sitesi analiz raporunu yorumlamak, eksikleri açıklamak ve somut çözüm önerileri sunmak.

KURALLAR:
- Her zaman Türkçe yanıt ver
- Teknik terimleri sade dille açıkla
- Somut, uygulanabilir adımlar öner
- Gereksiz uzun yanıtlar verme (max 150 kelime)
- Eğer rapor yoksa "Önce analiz yapmanız gerekiyor" de
- Pozitif ve yardımcı bir ton kullan
- KOBİ sahibiyle konuştuğunu unutma — teknik bilgisi az olabilir

${reportContext ? `\n## MEVCUT ANALİZ RAPORU:\n${reportContext}` : '\n## Henüz analiz yapılmamış.'}`;

  // Konuşma geçmişini oluştur
  const messages = [];

  // Önceki mesajları ekle (max 10 mesaj)
  if (history && Array.isArray(history)) {
    const recent = history.slice(-10);
    recent.forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });
  }

  // Yeni mesajı ekle
  messages.push({ role: 'user', content: message });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Hızlı ve ucuz — chat için ideal
        max_tokens: 400,
        system: systemPrompt,
        messages
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const reply = data.content.map(i => i.text || '').join('').trim();
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat API hatası:', err);
    return res.status(500).json({ error: 'Yanıt alınamadı: ' + err.message });
  }
}
