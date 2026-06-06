// Auth Functions
window.showAuth = function(mode = 'login') {
  const modal = document.getElementById('authModal');
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmit');
  const switcher = document.getElementById('authSwitch');

  modal.style.display = 'flex';
  if(window.lucide) window.lucide.createIcons();
  if(mode === 'login') {
    title.textContent = 'Giriş Yap';
    submit.textContent = 'Giriş Yap';
    switcher.textContent = 'Hesabınız yok mu? Kayıt olun';
    switcher.onclick = () => showAuth('register');
  } else {
    title.textContent = 'Kayıt Ol';
    submit.textContent = 'Kayıt Ol';
    switcher.textContent = 'Zaten hesabınız var mı? Giriş yapın';
    switcher.onclick = () => showAuth('login');
  }
}

window.closeAuth = function() {
  document.getElementById('authModal').style.display = 'none';
}

window.handleAuth = async function() {
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPass').value;
  const isLogin = document.getElementById('authTitle').textContent === 'Giriş Yap';

  if(!supabase) { alert('Supabase bağlantısı kurulamadı.'); return; }

  const btn = document.getElementById('authSubmit');
  btn.disabled = true; btn.textContent = 'İşleniyor...';

  try {
    let result;
    if(isLogin) {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }

    if(result.error) throw result.error;

    if(!isLogin) alert('Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.');
    closeAuth();
  } catch(e) {
    alert('Hata: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = isLogin ? 'Giriş Yap' : 'Kayıt Ol';
  }
}

window.loginWithGoogle = async function() {
  if(!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if(error) alert(error.message);
}

window.handleLogout = async function() {
  if(!supabase) return;
  await supabase.auth.signOut();
  window.location.reload();
}

// Auth State Listener
if(supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateUIForAuth();
  });
}

window.updateUIForAuth = function() {
  const authBtns = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');

  if(currentUser) {
    authBtns.style.display = 'none';
    userMenu.style.display = 'flex';
    userName.textContent = currentUser.email.split('@')[0];
    fetchDashboardStats();
  } else {
    authBtns.style.display = 'flex';
    userMenu.style.display = 'none';
    if(currentView !== 'home') showView('home');
  }
}
