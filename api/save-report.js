module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  
  // MOCK: In production, use @supabase/supabase-js
  const { report, email } = req.body;
  console.log('Saving report for:', email);
  
  // Simüle edilmiş gecikme
  await new Promise(r => setTimeout(r, 800));
  
  return res.status(200).json({ success: true, message: 'Rapor başarıyla kaydedildi (Mock)' });
}
