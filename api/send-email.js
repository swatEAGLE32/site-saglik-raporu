const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { email, domain, pdfBase64 } = req.body;
  
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
      subject: `${domain || 'Web Siteniz'} İçin Teknik Sağlık Raporu Hazır`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <h2 style="color: #059669;">Site Sağlık Raporu</h2>
          <p>Merhaba,</p>
          <p><strong>${domain}</strong> web sitesi için hazırlanan teknik sağlık raporu ekte PDF olarak sunulmuştur.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">Raporunuzu ekteki dosyadan detaylıca inceleyebilirsiniz.</p>
          </div>
          <p style="font-size: 12px; color: #64748b;">Bu e-posta <strong>sitesaglıkanaliz@gmail.com</strong> üzerinden otomatik olarak gönderilmiştir.</p>
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
