const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { email, domain, score, pdfBase64 } = req.body;
  
  const gmailUser = process.env.GMAIL_USER || 'sitesaglıkanaliz@gmail.com';
  const gmailPass = process.env.GMAIL_PASS; // Uygulama Şifresi

  if (!gmailPass) {
    return res.status(500).json({ error: 'GMAIL_PASS (Uygulama Şifresi) eksik. Lütfen .env dosyasına ekleyin.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });

  try {
    const mailOptions = {
      from: `"Site Sağlık Raporu" <${gmailUser}>`,
      to: email,
      subject: `[Site Sağlık Raporu] ${domain || 'Web Siteniz'} — ${score || '??'}/100`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; color: #1e293b;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 800; color: #10b981;">site<span style="color: #34d399;">sağlık</span>.analiz</span>
          </div>
          <h2 style="font-size: 24px; margin-bottom: 16px;">Teknik Sağlık Raporunuz Hazır</h2>
          <p>Merhaba,</p>
          <p><strong>${domain}</strong> web sitesi için gerçekleştirdiğimiz detaylı analiz tamamlandı. Sitenizin genel sağlık skoru:</p>
          
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
            <div style="font-size: 48px; font-weight: 800; color: #10b981;">${score || '??'}<span style="font-size: 20px; color: #94a3b8;">/100</span></div>
            <p style="margin: 8px 0 0; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em;">GENEL SKOR</p>
          </div>

          <p>Raporunuzu ekteki PDF dosyasından detaylıca inceleyebilirsiniz. Bu rapor; güvenlik, performans, SEO ve teknik altyapı konularında kritik bulgular içermektedir.</p>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">
            <p style="margin-bottom: 4px;">Saygılarımızla,</p>
            <p style="font-weight: 700; color: #1e293b;">sitesağlık.analiz ekibi</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Site-Saglik-Raporu-${domain}.pdf`,
          content: pdfBase64,
          encoding: 'base64'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ success: true, message: 'E-posta (PDF ekiyle) başarıyla gönderildi' });
  } catch (err) {
    console.error('Error sending email via Gmail:', err);
    return res.status(500).json({ error: err.message });
  }
}
