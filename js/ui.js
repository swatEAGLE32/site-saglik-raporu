const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeText = document.getElementById('themeText');

window.setTheme = function(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (theme === 'light') {
    themeIcon.textContent = '☀️';
    themeText.textContent = 'Açık';
  } else {
    themeIcon.textContent = '🌙';
    themeText.textContent = 'Koyu';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'dark' : 'light');
  });
}

// Auto detect system theme
const savedTheme = localStorage.getItem('theme');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

if (savedTheme) {
  setTheme(savedTheme);
} else {
  setTheme(systemDark.matches ? 'dark' : 'light');
}

systemDark.addEventListener('change', e => {
  if (!localStorage.getItem('theme')) {
    setTheme(e.matches ? 'dark' : 'light');
  }
});

let currentView = 'home';
window.showView = function(view) {
  currentView = view;
  const views = ['home', 'dashboard', 'history', 'tracking', 'settings', 'pro'];
  views.forEach(v => {
    const el = document.getElementById('view-' + v);
    if(el) el.style.display = v === view ? 'block' : 'none';
  });
  
  // Update sidebar links
  document.querySelectorAll('.sb-link').forEach(l => {
    l.classList.remove('active');
    if(l.textContent.toLowerCase().includes(view === 'home' ? 'ana sayfa' : view)) l.classList.add('active');
  });
  
  if(view === 'history') fetchHistory();
  if(window.innerWidth < 1024) toggleSidebar(false);
  
  // Lucide icons update
  if(window.lucide) window.lucide.createIcons();
}

window.toggleSidebar = function(force) {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sbOverlay');
  const isOpening = force !== undefined ? force : !sb.classList.contains('on');
  
  sb.classList.toggle('on', isOpening);
  ov.classList.toggle('on', isOpening);
  if(isOpening && window.lucide) window.lucide.createIcons();
}

window.fetchDashboardStats = async function() {
  if(!currentUser || !supabase) return;
  
  // İstatistikleri çek
  const { count: total } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
  const { count: tracking } = await supabase.from('tracked_domains').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
  
  // Ortalama skoru hesapla
  const { data: scores } = await supabase.from('reports').select('overall_score').eq('user_id', currentUser.id);
  let avg = 0;
  if(scores && scores.length > 0) {
    avg = Math.round(scores.reduce((acc, curr) => acc + curr.overall_score, 0) / scores.length);
  }

  document.getElementById('stat-total').textContent = total || 0;
  document.getElementById('stat-tracking').textContent = tracking || 0;
  document.getElementById('stat-avg').textContent = avg || 0;
  
  // Son analizler
  const { data: recent } = await supabase.from('reports').select('domain, overall_score, created_at').eq('user_id', currentUser.id).limit(5).order('created_at', { ascending: false });
  const list = document.getElementById('recentList');
  if(recent && recent.length) {
    list.innerHTML = recent.map(r => `
      <div class="pitem">
        <span class="pbdg ${scCl(r.overall_score)}">${r.overall_score}</span>
        <span class="pt">${r.domain}</span>
        <span class="pm2">${new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
      </div>
    `).join('');
  } else {
    list.innerHTML = '<p style="font-size:12px; color:var(--text3); padding:10px;">Henüz rapor yok.</p>';
  }
}

window.simulatePayment = function() {
  alert('Ödeme simülasyonu başlatıldı... (Stripe/Iyzico altyapısı hazır)');
  setTimeout(() => {
    alert('Tebrikler! PRO üyeliğiniz aktif edildi.');
    document.getElementById('planBadge').textContent = 'PRO PLAN';
    document.getElementById('planBadge').style.borderColor = 'var(--yellow)';
    document.getElementById('planBadge').style.color = 'var(--yellow)';
    showView('dashboard');
  }, 1500);
}

window.toggleAIChat = function() {
  const chat = document.getElementById('aiChat');
  const btn = document.getElementById('aiChatBtn');
  if(chat.style.display === 'none') {
    chat.style.display = 'flex';
    btn.style.display = 'none';
    if(window.lucide) window.lucide.createIcons();
  } else {
    chat.style.display = 'none';
    btn.style.display = 'flex';
  }
}
