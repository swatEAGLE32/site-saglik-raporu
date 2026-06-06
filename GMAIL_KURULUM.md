# Gmail Uygulama Şifresi Kurulum Kılavuzu

`sitesaglıkanaliz@gmail.com` adresinden e-posta gönderebilmek için aşağıdaki adımları takip ederek bir "Uygulama Şifresi" almanız ve bunu `.env` dosyasına eklemeniz gerekmektedir.

## Adımlar:

1. **Google Hesabınıza Giriş Yapın:** [myaccount.google.com](https://myaccount.google.com/) adresine gidin.
2. **Güvenlik Sekmesine Tıklayın:** Sol menüden "Güvenlik" (Security) sekmesini seçin.
3. **2 Adımlı Doğrulamayı Açın:** "Google'da oturum açma" bölümünde "2 Adımlı Doğrulama" kapalıysa, önce bunu aktif hale getirin.
4. **Uygulama Şifrelerini Arayın:** Sayfanın en üstündeki arama çubuğuna "Uygulama şifreleri" (App passwords) yazın ve çıkan sonuca tıklayın.
5. **Yeni Şifre Oluşturun:**
   - "Uygulama seçin" kısmından "Diğer (Özel isim)" seçeneğini seçin.
   - İsim olarak `Site Saglik Analiz` yazın.
   - "Oluştur" butonuna basın.
6. **Şifreyi Kopyalayın:** Ekranda görünen 16 haneli sarı kutu içindeki şifreyi kopyalayın (boşlukları silmenize gerek yok, sistem otomatik algılar).

## .env Dosyasını Güncelleme:

Projenizin `.env` dosyasına (veya Vercel Environment Variables kısmına) şu satırı ekleyin:

```env
GMAIL_USER=sitesaglıkanaliz@gmail.com
GMAIL_PASS=buraya_aldiginiz_16_haneli_sifre
```

**Not:** Bu işlemden sonra backend otomatik olarak Gmail üzerinden PDF ekli e-postaları göndermeye başlayacaktır.
