window.setMode = function(m){
  currentMode = m;
  document.getElementById('singleInput').style.display = m==='single'?'block':'none';
  document.getElementById('compareInput').style.display = m==='compare'?'block':'none';
  document.getElementById('modeSingle').style.borderColor = m==='single'?'var(--accent)':'var(--border)';
  document.getElementById('modeCompare').style.borderColor = m==='compare'?'var(--accent)':'var(--border)';
}

window.normUrl = function(r){
  let u=r.trim();
  if(!u)return null;
  if(!/^https?:\/\//i.test(u))u='https://'+u;
  try{return new URL(u).hostname;}catch{return null;}
}

window.showE = function(m){const e=document.getElementById('emsg');e.textContent=m;e.classList.add('on');}
window.hideE = function(){document.getElementById('emsg').classList.remove('on');}

window.runProg = function(cb){
  const d=[0,600,1300,2100,2900],p=[12,32,55,78,95],bar=document.getElementById('pb');
  d.forEach((t,i)=>{
    setTimeout(()=>{
      if(i>0){const pv=document.getElementById('s'+(i-1));pv.className='step done';pv.querySelector('.sico').textContent='✓';}
      document.getElementById('s'+i).className='step active';
      bar.style.width=p[i]+'%';
    },t);
  });
  setTimeout(()=>{
    document.getElementById('s4').className='step done';
    document.getElementById('s4').querySelector('.sico').textContent='✓';
    bar.style.width='100%';
    setTimeout(cb,400);
  },3600);
}

window.start = async function(hn_arg, rival_hn){
  if(!currentUser && D) {
    console.log('Misafir kullanıcı için 2. analiz kısıtlaması uygulanabilir.');
  }
  hideE();
  const hn = hn_arg || normUrl(document.getElementById('urlIn').value);
  if(!hn){showE('Lütfen geçerli bir adres girin. Örnek: www.firmaniz.com');return;}
  const btn=document.getElementById('btnA');
  btn.disabled=true;
  btn.innerHTML='<span class="spin"></span> Analiz ediliyor...';
  document.getElementById('pw').classList.add('on');
  document.getElementById('how').style.display='none';
  document.getElementById('res').classList.remove('on');

  let result=null,err=null;
  const apiCall=fetch('/api/analyze',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({hostname:hn, rival_hostname: rival_hn})
  }).then(async r=>{
    if(!r.ok){const t=await r.text();throw new Error(t);}
    return r.json();
  }).then(r=>result=r).catch(e=>err=e);

  // Log flow simulation
  const logs = [
    'DNS kayıtları çözülüyor (A, MX, TXT)...',
    'SSL sertifikası geçerliliği kontrol ediliyor...',
    'Güvenlik başlıkları (CSP, HSTS) taranıyor...',
    'Sayfa içeriği ve meta etiketler analiz ediliyor...',
    'Görüntü alt etiketleri ve WebP kontrolü yapılıyor...',
    'AI Danışman raporu hazırlıyor...'
  ];
  let logIdx = 0;
  const logItems = [];
  const logInterval = setInterval(() => {
    if(logIdx < logs.length) {
      const item = document.createElement('div');
      item.className = 'step active';
      item.style.cssText = 'font-size:11px; opacity:0.7; animation: fadeIn 0.3s ease;';
      item.innerHTML = `<div class="sico">•</div><span>${logs[logIdx]}</span>`;
      document.getElementById('stps').appendChild(item);
      logItems.push(item);
      logIdx++;
    } else {
      clearInterval(logInterval);
    }
  }, 600);

  const minW=new Promise(r=>setTimeout(r,4000));
  runProg(async()=>{
    await Promise.allSettled([apiCall,minW]);
    clearInterval(logInterval);
    // Temizlik: eklenen logları kaldır
    logItems.forEach(el => el.remove());
    document.getElementById('pw').classList.remove('on');
    btn.disabled=false;btn.textContent='Analiz Et';
    if(err||!result){
      showE('Analiz hatası: '+(err?.message||'Bilinmeyen hata'));
      document.getElementById('how').style.display='';
      return;
    }
    D={...result,site_url:hn};
    if(rival_hn) D.rival_url = rival_hn;
    render(D);
    document.getElementById('aiChatBtn').style.display = 'flex';
    if(currentUser) autoSaveReport(D);
  });
}

window.autoSaveReport = async function(report) {
  if(!supabase || !currentUser) return;
  const { error } = await supabase.from('reports').insert({
    user_id: currentUser.id,
    domain: report.site_url,
    overall_score: report.genel_puan,
    security_score: report.kategoriler.find(c=>c.ad==='Güvenlik')?.puan || 0,
    seo_score: report.kategoriler.find(c=>c.ad==='SEO')?.puan || 0,
    performance_score: report.kategoriler.find(c=>c.ad==='Performans')?.puan || 0,
    summary: report.ozet_metin,
    full_data: report
  });
  if(error) console.error('Rapor kaydedilemedi:', error);
}

window.fetchHistory = async function() {
  if(!currentUser || !supabase) return;
  const { data } = await supabase.from('reports').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  renderHistoryTable(data || []);
}

window.renderHistoryTable = function(data) {
  const container = document.getElementById('historyTable');
  if(!data || !data.length) {
    container.innerHTML = '<p style="color:var(--text3); padding:20px; text-align:center;">Henüz analiz kaydınız bulunmuyor.</p>';
    return;
  }
  
  let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;">
    <thead>
      <tr style="text-align:left; border-bottom:1px solid var(--border2); color:var(--text3);">
        <th style="padding:12px;">Domain</th>
        <th style="padding:12px;">Skor</th>
        <th style="padding:12px;">Tarih</th>
        <th style="padding:12px;">İşlem</th>
      </tr>
    </thead>
    <tbody>`;
  
  data.forEach(r => {
    html += `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:12px; font-weight:600;">${r.domain}</td>
      <td style="padding:12px;"><span class="hst ${scCl(r.overall_score)}">${r.overall_score}</span></td>
      <td style="padding:12px; color:var(--text3);">${new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
      <td style="padding:12px;">
        <button onclick='viewSavedReport(${JSON.stringify(r.id)})' class="btnnew" style="padding:4px 8px; font-size:11px;">Görüntüle</button>
      </td>
    </tr>`;
  });
  
  html += `</tbody></table>`;
  container.innerHTML = html;
}

window.viewSavedReport = async function(id) {
  if(!supabase) return;
  const { data, error } = await supabase.from('reports').select('full_data').eq('id', id).single();
  if(error || !data) {
    alert('Rapor yüklenirken hata oluştu: ' + (error?.message || 'Veri bulunamadı'));
    return;
  }
  
  D = data.full_data;
  showView('home');
  render(D);
  document.getElementById('aiChatBtn').style.display = 'flex';
}

window.addTrack = async function() {
  if(!currentUser) { showAuth('register'); return; }
  const domain = document.getElementById('trackIn').value.trim();
  if(!domain) return;
  
  const { error } = await supabase.from('tracked_domains').insert({ user_id: currentUser.id, domain });
  if(error) alert(error.message);
  else {
    alert('Domain takibe alındı.');
    document.getElementById('trackIn').value = '';
    fetchDashboardStats();
  }
}

window.sendChatMessage = async function() {
  const input = document.getElementById('chatInput');
  const box = document.getElementById('chatBox');
  const msg = input.value.trim();
  if(!msg) return;
  
  box.innerHTML += `<div style="background:var(--accent-glow); padding:10px; border-radius:10px; font-size:13px; align-self:flex-end; max-width:85%; color:var(--accent2);">${msg}</div>`;
  input.value = '';
  box.scrollTop = box.scrollHeight;
  
  // AI Mock response for demo
  setTimeout(() => {
    box.innerHTML += `<div style="background:var(--surface2); padding:10px; border-radius:10px; font-size:13px; align-self:flex-start; max-width:85%;">Harika bir soru. Sitenizdeki ${msg} konusu için PRO plana geçerek detaylı AI çözüm rehberine ulaşabilirsiniz.</div>`;
    box.scrollTop = box.scrollHeight;
  }, 1000);
}

window.render = function(d){
  if(d.rival_url) {
    document.getElementById('compareHeader').style.display = 'block';
    const rival = (d.rakip_analizi || []).find(r => r.rakip_ad.toLowerCase().includes(d.rival_url.toLowerCase())) || d.rakip_analizi?.[0];
    if(rival) {
       document.getElementById('compareStats').innerHTML = `
         <div class="chip" style="color:var(--text)">${d.site_url}: <strong>${d.genel_puan}</strong></div>
         <div class="chip" style="color:var(--accent2)">${rival.rakip_ad}: <strong>${rival.puan}</strong></div>
         <div class="chip" style="background:var(--accent-glow)">Fark: <strong>${d.genel_puan - rival.puan}</strong></div>
       `;
    }
  } else {
    document.getElementById('compareHeader').style.display = 'none';
  }
  document.getElementById('rFirma').textContent=d.firma_adi||d.site_url;
  document.getElementById('rUrl').textContent=d.site_url;
  const p=d.genel_puan,cl=pCl(p);
  document.getElementById('scC').className='sccirc '+scCl(p);
  document.getElementById('scN').textContent=p;
  const l=document.getElementById('scL');l.textContent=pLb(p);l.className='slbl '+cl;
  renderH(d.guvenlik_basliklari);
  renderM(d.performans);
  renderT(d.teknoloji);
  renderTech(d.teknik_analiz, d.guvenlik_detay);
  renderCats(d.kategoriler);
  renderRadar(d.kategoriler);
  renderSSL(d.ssl_detay);
  renderCorp(d.kurumsal_eksikler);
  renderRivals(d.rakip_analizi);
  renderSocial(d.sosyal_medya_stratejisi);
  renderPri(d.oncelikler);
  document.getElementById('res').classList.add('on');
  setTimeout(()=>document.getElementById('res').scrollIntoView({behavior:'smooth',block:'start'}),100);
}

function renderH(h){
  if(!h)return;
  const map=[
    {k:'csp',n:'Content-Security-Policy'},
    {k:'hsts',n:'Strict-Transport-Security'},
    {k:'x_frame',n:'X-Frame-Options'},
    {k:'x_content_type',n:'X-Content-Type-Options'},
    {k:'referrer_policy',n:'Referrer-Policy'},
    {k:'permissions_policy',n:'Permissions-Policy'},
  ];
  const g=document.getElementById('hGrid');g.innerHTML='';
  map.forEach(({k,n})=>{
    const it=h[k]||{durum:'yok',aciklama:''};
    const sm={var:{c:'hok',t:'VAR',i:'✓'},yok:{c:'hmiss',t:'YOK',i:'✗'},eksik:{c:'hwarn',t:'EKSİK',i:'!'}};
    const s=sm[it.durum]||sm.yok;
    const ic=it.durum==='var'?'var(--green)':it.durum==='eksik'?'var(--yellow)':'var(--red)';
    const d=document.createElement('div');
    d.className='hitem';d.title=it.aciklama||'';
    d.innerHTML=`<span class="hico" style="color:${ic}">${s.i}</span><span class="hnm">${n}</span><span class="hst ${s.c}">${s.t}</span>`;
    g.appendChild(d);
  });
}

function renderM(p){
  if(!p)return;
  const g=document.getElementById('mGrid');g.innerHTML='';
  const mvCls=s=>s==='iyi'?'mvg':s==='orta'?'mvm':'mvb';
  const scMv=v=>v>=80?'mvg':v>=60?'mvm':'mvb';
  const items=[
    {l:'Mobil Skor',v:p.mobil_skor,c:scMv(p.mobil_skor),s:'PageSpeed'},
    {l:'Masaüstü Skor',v:p.masaustu_skor,c:scMv(p.masaustu_skor),s:'PageSpeed'},
    {l:'LCP',v:p.lcp,c:mvCls(p.lcp_durum),s:'Largest Contentful Paint'},
    {l:'FCP',v:p.fcp,c:mvCls(p.fcp_durum),s:'First Contentful Paint'},
    {l:'CLS',v:p.cls,c:mvCls(p.cls_durum),s:'Layout Shift'},
    {l:'Speed Index',v:p.speed_index,c:mvCls(p.si_durum),s:'Yükleme Hızı'},
  ];
  items.forEach(({l,v,c,s})=>{
    const card=document.createElement('div');
    card.className='mcard';
    card.innerHTML=`<div class="mlbl">${l}</div><div class="mval ${c}">${v??'—'}</div><div class="msub">${s}</div>`;
    g.appendChild(card);
  });
}

function renderT(ts){
  const r=document.getElementById('tRow');r.innerHTML='';
  if(!ts||!ts.length){r.innerHTML='<span style="color:var(--text3);font-size:13px">Tespit edilemedi</span>';return;}
  ts.forEach(t=>{
    const dot=t.var?'var(--green)':'var(--text3)';
    const tc=t.var?'var(--text)':'var(--text3)';
    const b=document.createElement('div');
    b.className='tbadge';b.style.color=tc;
    b.innerHTML=`<span class="tdot" style="background:${dot}"></span>${t.ad}${t.kategori?`<span style="font-size:11px;color:var(--text3);margin-left:1px">· ${t.kategori}</span>`:''}`;
    r.appendChild(b);
  });
}

let radarChart = null;
window.renderRadar = function(cats) {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if(radarChart) radarChart.destroy();
  
  const labels = cats.map(c => c.ad);
  const data = cats.map(c => c.puan);
  
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const color = isDark ? '#10B981' : '#059669';
  
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Site Skorları',
        data: data,
        backgroundColor: color + '33',
        borderColor: color,
        borderWidth: 2,
        pointBackgroundColor: color,
      }]
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: { color: isDark ? '#334155' : '#E2E8F0' },
          angleLines: { color: isDark ? '#334155' : '#E2E8F0' },
          pointLabels: { color: isDark ? '#94A3B8' : '#64748B', font: { size: 10, family: 'Syne' } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

window.renderCats = function(cats){
  const g=document.getElementById('cGrid'),p=document.getElementById('dPanels');
  if (!g || !p) return;
  g.innerHTML='';p.innerHTML='';openIdx=null;
  cats.forEach((k,i)=>{
    const col=pC(k.puan);
    const c=document.createElement('div');
    c.className='ccard';c.id='cc'+i;
    c.innerHTML=`<div class="ctop"><div class="cnm">${k.ad}</div><div class="csc" style="color:${col}">${k.puan}</div></div><div class="cbarbg"><div class="cbar" id="cb${i}" style="width:0%;background:${col}"></div></div><div class="coz">${k.ozet}</div>`;
    c.onclick=()=>togDet(i,k);
    g.appendChild(c);
    setTimeout(()=>{const b=document.getElementById('cb'+i);if(b)b.style.width=k.puan+'%';},180+i*65);
    const dp=document.createElement('div');
    dp.className='dpanel';dp.id='dp'+i;
    dp.innerHTML=buildDet(k);
    p.appendChild(dp);
  });
}

function buildDet(k){
  const ic={iyi:'✓',uyari:'!',hata:'✗'},cl={iyi:'fig',uyari:'fiw',hata:'fib'};
  let h=`<div style="font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:11px">${k.ad} — Detay</div>`;
  (k.bulgular||[]).forEach(b=>{h+=`<div class="fnd"><span class="fi ${cl[b.tip]||'fib'}">${ic[b.tip]||'•'}</span><span>${b.metin}</span></div>`;});
  if((k.aksiyonlar||[]).length){
    h+=`<div class="attl">Yapılacaklar</div>`;
    k.aksiyonlar.forEach((a,i)=>{h+=`<div class="aitem"><span class="anum">${i+1}</span><span>${a}</span></div>`;});
  }
  if(k.ai_yorum){
    h+=`<div class="attl" style="color:var(--accent2); display:flex; align-items:center; gap:6px;"><i data-lucide="sparkles" style="width:14px;"></i> AI Danışman Yorumu</div>`;
    h+=`<div class="coz" style="background:var(--accent-glow); padding:10px; border-radius:8px; color:var(--text2); border:1px solid var(--accent-glow);">${k.ai_yorum}</div>`;
  }
  return h;
}

window.togDet = function(i,k){
  if(openIdx!==null&&openIdx!==i){
    document.getElementById('cc'+openIdx).classList.remove('exp');
    document.getElementById('dp'+openIdx).classList.remove('on');
  }
  const c=document.getElementById('cc'+i),p=document.getElementById('dp'+i);
  if(openIdx===i){c.classList.remove('exp');p.classList.remove('on');openIdx=null;}
  else{c.classList.add('exp');p.classList.add('on');openIdx=i;p.scrollIntoView({behavior:'smooth',block:'nearest'});}
}

window.renderSSL = function(s){
  const g=document.getElementById('sslInfo');
  if(!s){g.innerHTML='SSL bilgisi alınamadı.';return;}
  g.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:20px;">
      <div>
        <div class="ilbl">Durum</div>
        <div style="font-weight:700;color:${s.gecerli?'var(--green)':'var(--red)'}">${s.gecerli?'GEÇERLİ':'GEÇERSİZ'}</div>
        <div class="ilbl" style="margin-top:10px">Yayıncı</div>
        <div style="font-size:14px">${s.yayinci}</div>
      </div>
      <div>
        <div class="ilbl">Bitiş Tarihi</div>
        <div style="font-size:14px">${s.bitis_tarihi}</div>
        <div class="ilbl" style="margin-top:10px">Öneri</div>
        <div style="font-size:13px;color:var(--text2)">${s.oneri}</div>
      </div>
    </div>
  `;
}

window.renderCorp = function(cs){
  const r=document.getElementById('corpMissing');if (!r) return;r.innerHTML='';
  if(!cs||!cs.length){r.innerHTML='<span style="color:var(--green)">Tüm kurumsal öğeler tam görünüyor.</span>';return;}
  cs.forEach(c=>{
    const b=document.createElement('div');
    b.className='tbadge';b.style.borderColor='var(--red-bd)';b.style.color='var(--red)';
    b.innerHTML=`<span class="tdot" style="background:var(--red)"></span>${c}`;
    r.appendChild(b);
  });
}

window.renderRivals = function(rs){
  const g=document.getElementById('competitorGrid');if (!g) return;g.innerHTML='';
  (rs||[]).forEach(r=>{
    const d=document.createElement('div');
    d.className='ccard';
    d.innerHTML=`
      <div class="ctop"><div class="cnm">${r.rakip_ad}</div><div class="csc">${r.puan}</div></div>
      <div class="coz" style="color:var(--text2); font-size: 11px;">${r.farklar}</div>
      <div class="attl">Üstün Yanları</div>
      <ul style="font-size:11px;color:var(--text3);padding-left:15px;margin-top:5px">
        ${(r.ustun_yanlar||[]).map(u=>`<li>${u}</li>`).join('')}
      </ul>
    `;
    g.appendChild(d);
  });
}

window.startCompare = async function(){
  hideE();
  const u1 = normUrl(document.getElementById('urlIn1').value);
  const u2 = normUrl(document.getElementById('urlIn2').value);
  if(!u1 || !u2){showE('Lütfen iki geçerli adres girin.'); return;}
  
  const btn = document.getElementById('btnCompare');
  btn.disabled = true;
  btn.textContent = 'Kıyaslanıyor...';
  
  start(u1, u2);
}

window.saveReport = async function(){
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = 'Kaydediliyor...';
  try {
    const r = await fetch('/api/save-report', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ report: D, email: document.getElementById('emailIn').value })
    });
    const res = await r.json();
    alert(res.message);
  } catch(e) { alert('Hata: ' + e.message); }
  btn.disabled = false; btn.textContent = 'Buluta Kaydet';
}

window.sendReport = async function(){
  const email = document.getElementById('emailIn').value;
  if(!email){ alert('Lütfen geçerli bir e-posta adresi girin.'); return; }
  if(!D){ alert('Önce analiz yapmalısınız.'); return; }
  
  const btn = document.getElementById('btnSend');
  btn.disabled = true; btn.textContent = 'Gönderiliyor...';
  
  try {
    // PDF'i oluştur ve base64 al
    const doc = await genPDF();
    if(!doc) throw new Error("PDF oluşturulamadı");
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    const r = await fetch('/api/send-email', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ 
        email, 
        domain: D.site_url,
        pdfBase64: pdfBase64
      })
    });
    
    const res = await r.json();
    if (res.error) throw new Error(res.error);
    alert('Rapor başarıyla gönderildi!');
  } catch(e) { 
    console.error(e);
    alert('Hata: ' + e.message); 
  } finally {
    btn.disabled = false; 
    btn.textContent = 'Raporu Gönder';
  }
}

window.renderTech = function(t, g){
  const grid = document.getElementById('techGrid'); if (!grid) return;
  grid.innerHTML = '';
  if(!t) return;
  
  const items = [
    {n: 'Framework', v: t.framework || 'Tespit Edilemedi', s: 'Altyapı'},
    {n: 'Sunucu Lokasyonu', v: t.ip_lokasyon || 'Bilinmiyor', s: 'Hosting'},
    {n: 'Robots.txt', v: t.files?.robots ? 'VAR' : 'YOK', c: t.files?.robots?'hok':'hmiss'},
    {n: 'Sitemap.xml', v: t.files?.sitemap ? 'VAR' : 'YOK', c: t.files?.sitemap?'hok':'hmiss'},
    {n: 'DNS (A)', v: (t.dns?.a || []).join(', ') || 'Yok', s: 'IP Adresleri'},
    {n: 'Cookie Güvenliği', v: g?.cookie_security || 'Riskli', c: g?.cookie_security==='Güvenli'?'hok':'hwarn'}
  ];
  
  items.forEach(it => {
    const d = document.createElement('div');
    d.className = 'hitem';
    d.innerHTML = `<div style="flex:1"><div class="ilbl">${it.s || 'Teknik'}</div><div style="font-size:13px; font-weight:600;">${it.n}</div><div style="font-size:11px; color:var(--text2)">${it.v}</div></div> ${it.c ? `<span class="hst ${it.c}">${it.v}</span>` : ''}`;
    grid.appendChild(d);
  });
}

window.renderSocial = function(s){
  const g=document.getElementById('socialStrategy'); if (!g) return;
  if(!s){g.innerHTML='Veri yok.';return;}
  g.innerHTML=`
    <div class="coz" style="margin-bottom:15px"><strong>Mevcut Durum:</strong> ${s.mevcut_durum}</div>
    <div class="attl">Stratejik Öneriler</div>
    <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px">
      ${(s.oneriler||[]).map(o=>`<div class="aitem"><span class="anum">•</span><span>${o}</span></div>`).join('')}
    </div>
    <div class="irow" style="margin-top:15px">
      ${(s.platformlar||[]).map(p=>`<span class="chip">#${p}</span>`).join('')}
    </div>
  `;
}

window.renderPri = function(ps){
  const l=document.getElementById('priList'); if (!l) return; l.innerHTML='';
  (ps||[]).forEach(o=>{
    const bc=o.oncelik==='Yüksek'?'ph':o.oncelik==='Orta'?'pm':'pl';
    const d=document.createElement('div');d.className='pitem';
    d.innerHTML=`<span class="pbdg ${bc}">${(o.oncelik||'').toUpperCase()}</span><span class="pt">${o.is}</span><span class="pm2">${o.etki||''} · ${o.sure||''}</span>`;
    l.appendChild(d);
  });
}

window.genPDF = async function(download = true){
  if(!D) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const b = document.getElementById('btnPdf');
  if (download) b.innerHTML = '<span class="spin"></span> Hazırlanıyor...';

  try {
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Accent color
    doc.text('Site Sağlık Raporu', 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(new Date().toLocaleString('tr-TR'), 150, 20);
    
    doc.setDrawColor(200);
    doc.line(20, 25, 190, 25);
    
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text(`Firma: ${D.firma_adi}`, 20, 40);
    doc.text(`URL: ${D.site_url}`, 20, 50);
    
    doc.setFontSize(30);
    doc.setTextColor(D.genel_puan >= 80 ? 16 : D.genel_puan >= 60 ? 245 : 239, D.genel_puan >= 80 ? 185 : D.genel_puan >= 60 ? 158 : 68, D.genel_puan >= 80 ? 129 : D.genel_puan >= 60 ? 11 : 68);
    doc.text(`${D.genel_puan}/100`, 150, 45);
    
    doc.setFontSize(12);
    doc.setTextColor(50);
    const splitText = doc.splitTextToSize(D.ozet_metin, 170);
    doc.text(splitText, 20, 65);
    
    let y = 75 + (splitText.length * 5);
    
    // SSL
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Güvenlik ve SSL', 20, y);
    doc.setFontSize(10);
    doc.text(`SSL Durumu: ${D.ssl_detay?.gecerli ? 'Geçerli' : 'Geçersiz'}`, 25, y + 7);
    doc.text(`Yayıncı: ${D.ssl_detay?.yayinci}`, 25, y + 12);
    y += 25;
    
    // Eksikler
    if (D.kurumsal_eksikler && D.kurumsal_eksikler.length) {
      doc.setFontSize(14);
      doc.text('Kurumsal Eksikler', 20, y);
      doc.setFontSize(10);
      D.kurumsal_eksikler.forEach((e, i) => {
        doc.text(`• ${e}`, 25, y + 7 + (i * 5));
      });
      y += 15 + (D.kurumsal_eksikler.length * 5);
    }
    
    // Öncelikler
    doc.setFontSize(14);
    doc.text('Öncelikli Aksiyonlar', 20, y);
    doc.setFontSize(10);
    D.oncelikler.slice(0, 5).forEach((o, i) => {
      doc.text(`${i+1}. [${o.oncelik}] ${o.is} (${o.etki})`, 25, y + 7 + (i * 5));
    });

    if (download) doc.save(`site-saglik-raporu-${D.site_url}.pdf`);
    return doc;
  } catch (err) {
    console.error(err);
    if (download) alert('PDF oluşturulurken hata oluştu.');
  } finally {
    if (download) b.innerHTML = `<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> PDF Rapor İndir`;
  }
}

window.reset = function(){
  document.getElementById('res').classList.remove('on');
  ['cGrid','dPanels','priList','hGrid','mGrid','tRow'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.innerHTML='';
  });
  document.getElementById('urlIn').value='';
  document.getElementById('how').style.display='';
  for(let i=0;i<5;i++){const s=document.getElementById('s'+i);s.className='step';s.querySelector('.sico').textContent=i+1;}
  document.getElementById('pb').style.width='0%';
  openIdx=null;D=null;
  ['sslInfo','corpMissing','competitorGrid','socialStrategy'].forEach(id=>{
     const el = document.getElementById(id);
     if (el) el.innerHTML='';
  });
  window.scrollTo({top:0,behavior:'smooth'});
}

const urlIn = document.getElementById('urlIn');
if (urlIn) {
  urlIn.addEventListener('keydown',e=>{if(e.key==='Enter')start();});
}
