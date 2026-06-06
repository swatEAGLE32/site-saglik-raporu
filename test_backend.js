const saveReport = require('./api/save-report.js');
const sendEmail = require('./api/send-email.js');

async function test() {
  console.log("Verifying API logic (Simulated)...");

  // Mock Request/Response for save-report
  const mockResSave = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.data = data; return this; },
    send: function(msg) { this.msg = msg; return this; }
  };

  const mockReqSave = {
    method: 'POST',
    body: {
      report: { site_url: 'test.com', genel_puan: 85, kategoriler: [{ ad: 'Güvenlik', puan: 90 }, { ad: 'SEO', puan: 80 }] },
      email: 'test@example.com'
    }
  };

  // We can't easily run the real Supabase call without keys, 
  // but we can verify it fails gracefully with the right error.
  await saveReport(mockReqSave, mockResSave);
  console.log("Save Report Status (Expect 500 without keys):", mockResSave.statusCode);
  console.log("Save Report Error:", mockResSave.data?.error);

  // Mock Request/Response for send-email
  const mockResEmail = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { this.data = data; return this; },
    send: function(msg) { this.msg = msg; return this; }
  };

  const mockReqEmail = {
    method: 'POST',
    body: { email: 'test@example.com', reportUrl: 'http://localhost/report', domain: 'test.com' }
  };

  await sendEmail(mockReqEmail, mockResEmail);
  console.log("Send Email Status (Expect 500 without keys):", mockResEmail.statusCode);
  console.log("Send Email Error:", mockResEmail.data?.error);
}

test();
