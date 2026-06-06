module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  // MOCK: In production, use Resend or SendGrid
  const { email, reportUrl } = req.body;
  console.log('Sending email to:', email);

  await new Promise(r => setTimeout(r, 1000));

  return res.status(200).json({ success: true, message: 'E-posta gönderildi (Mock)' });
}
