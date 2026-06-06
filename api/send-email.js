const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { email, reportUrl, domain } = req.body;
  
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(500).json({ error: 'Resend API key missing' });
  }

  const resend = new Resend(resendApiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Site Sağlık Raporu <onboarding@resend.dev>',
      to: email,
      subject: `${domain || 'Web Siteniz'} İçin Teknik Sağlık Raporu Hazır`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <h2 style="color: #059669;">Site Sağlık Raporu</h2>
          <p>Merhaba,</p>
          <p><strong>${domain}</strong> web sitesi için talep ettiğiniz teknik analiz tamamlandı.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">Raporunuzu aşağıdaki bağlantıya tıklayarak görüntüleyebilirsiniz:</p>
            <p style="margin: 10px 0 0 0;">
              <a href="${reportUrl}" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">Raporu Görüntüle</a>
            </p>
          </div>
          <p style="font-size: 12px; color: #64748b;">Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.</p>
        </div>
      `
    });

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'E-posta başarıyla gönderildi' });
  } catch (err) {
    console.error('Error sending email:', err);
    return res.status(500).json({ error: err.message });
  }
}
