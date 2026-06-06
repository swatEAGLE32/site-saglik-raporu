const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { report, email } = req.body;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Önce kullanıcıyı e-posta ile bulmaya çalışalım (isteğe bağlı)
    let user_id = null;
    if (email) {
      const { data: userData } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      if (userData) user_id = userData.id;
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        user_id: user_id,
        domain: report.site_url,
        overall_score: report.genel_puan,
        security_score: report.kategoriler.find(c => c.ad === 'Güvenlik')?.puan || 0,
        seo_score: report.kategoriler.find(c => c.ad === 'SEO')?.puan || 0,
        performance_score: report.performans?.mobil_skor || 0,
        summary: report.ozet_metin,
        full_data: report,
        is_public: true
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ 
      success: true, 
      message: 'Rapor başarıyla kaydedildi', 
      reportId: data.id 
    });
  } catch (err) {
    console.error('Error saving report:', err);
    return res.status(500).json({ error: err.message });
  }
}
