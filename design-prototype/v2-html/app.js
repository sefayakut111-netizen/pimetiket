/* ============================================================
   PİM ETİKET — Shared scripts (Pim character + chatbot + nav)
   ============================================================ */

/* ---------- Pim SVG poses ---------- */
/* Pim is a friendly mascot: round head, oval body, glasses, small bowtie.
   Different expressions tell the story across pages. */

const PIM_POSES = {
  base(opts = {}) {
    const m = opts.mood || 'happy'; // happy, smile, think, magnify, thumbsup, sad, excited, sleepy, big
    const eyes = m === 'sad'
      ? `<path d="M85 95 q8 -8 16 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>
         <path d="M139 95 q8 -8 16 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : m === 'sleepy'
      ? `<path d="M85 98 q8 0 16 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>
         <path d="M139 98 q8 0 16 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : m === 'excited'
      ? `<path d="M86 90 q7 -8 14 0 q-7 8 -14 0z" fill="#1F2937"/>
         <path d="M140 90 q7 -8 14 0 q-7 8 -14 0z" fill="#1F2937"/>
         <circle cx="93" cy="89" r="2" fill="white"/>
         <circle cx="147" cy="89" r="2" fill="white"/>`
      : `<circle cx="93" cy="93" r="5" fill="#1F2937"/>
         <circle cx="147" cy="93" r="5" fill="#1F2937"/>
         <circle cx="94.5" cy="91" r="1.5" fill="white"/>
         <circle cx="148.5" cy="91" r="1.5" fill="white"/>`;
    const mouth = m === 'sad'
      ? `<path d="M108 130 q12 -10 24 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : m === 'think'
      ? `<path d="M114 128 q6 4 12 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : m === 'excited'
      ? `<path d="M105 122 q15 18 30 0 z" fill="#1F2937"/>
         <path d="M111 130 q9 6 18 0" fill="#FF9999" opacity="0.8"/>`
      : m === 'sleepy'
      ? `<path d="M114 130 q6 0 12 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<path d="M108 122 q12 12 24 0" stroke="#1F2937" stroke-width="3" fill="none" stroke-linecap="round"/>`;

    // Glasses (round)
    const glasses = `
      <circle cx="93" cy="93" r="14" stroke="#1F2937" stroke-width="2.5" fill="none"/>
      <circle cx="147" cy="93" r="14" stroke="#1F2937" stroke-width="2.5" fill="none"/>
      <line x1="107" y1="93" x2="133" y2="93" stroke="#1F2937" stroke-width="2.5"/>`;

    // Cheeks
    const cheeks = `
      <ellipse cx="80" cy="110" rx="6" ry="4" fill="#FF6B5B" opacity="0.35"/>
      <ellipse cx="160" cy="110" rx="6" ry="4" fill="#FF6B5B" opacity="0.35"/>`;

    // Bowtie under chin
    const bowtie = `
      <path d="M110 158 l-12 -8 v16 z" fill="#FF6B5B"/>
      <path d="M130 158 l12 -8 v16 z" fill="#FF6B5B"/>
      <rect x="116" y="154" width="8" height="8" rx="2" fill="#E85544"/>`;

    // Body / apron
    const body = `
      <ellipse cx="120" cy="210" rx="55" ry="40" fill="#FF6B5B"/>
      <path d="M75 200 q45 30 90 0 v40 q-45 28 -90 0 z" fill="#F5EBD9"/>
      <text x="120" y="225" text-anchor="middle" font-family="Nunito, Poppins, sans-serif" font-weight="700" font-size="14" fill="#1F2937">PiM</text>`;

    // Head shape
    const head = `<ellipse cx="120" cy="105" rx="55" ry="58" fill="#FFE3D5"/>`;

    // Hair tuft
    const hair = `<path d="M82 64 q15 -22 38 -10 q22 -12 38 10 q-15 6 -38 0 q-23 6 -38 0z" fill="#1F2937"/>`;

    // Optional accessories per pose
    let extra = '';
    if (m === 'magnify') {
      extra = `
        <g transform="translate(150 120) rotate(20)">
          <circle cx="0" cy="0" r="22" stroke="#1F2937" stroke-width="4" fill="rgba(255,255,255,0.4)"/>
          <line x1="16" y1="16" x2="40" y2="40" stroke="#1F2937" stroke-width="5" stroke-linecap="round"/>
        </g>`;
    } else if (m === 'thumbsup') {
      extra = `
        <g transform="translate(178 200)">
          <rect x="0" y="0" width="22" height="28" rx="6" fill="#FFE3D5" stroke="#1F2937" stroke-width="2"/>
          <path d="M10 -4 q4 -10 8 -2 v8 h-8 z" fill="#FFE3D5" stroke="#1F2937" stroke-width="2"/>
        </g>`;
    } else if (m === 'wave') {
      extra = `
        <g transform="translate(176 130) rotate(18)">
          <ellipse cx="0" cy="0" rx="14" ry="18" fill="#FFE3D5" stroke="#1F2937" stroke-width="2"/>
          <path d="M-5 -10 q5 -8 10 0" stroke="#1F2937" stroke-width="2" fill="none"/>
          <path d="M-5 0 q5 -6 10 0" stroke="#1F2937" stroke-width="2" fill="none"/>
        </g>`;
    }

    return `<svg viewBox="0 0 240 260" xmlns="http://www.w3.org/2000/svg" class="pim-svg" aria-label="Pim mascot">
      ${body}
      ${head}
      ${hair}
      ${cheeks}
      ${glasses}
      ${eyes}
      ${mouth}
      ${bowtie}
      ${extra}
    </svg>`;
  },
  // Tiny circular Pim head (for FAB and chat avatars)
  head() {
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" class="pim-svg">
      <circle cx="32" cy="32" r="30" fill="#FFE3D5"/>
      <path d="M8 22 q12 -18 24 -8 q12 -10 24 8 q-12 4 -24 0 q-12 4 -24 0z" fill="#1F2937"/>
      <ellipse cx="14" cy="38" rx="3.5" ry="2.5" fill="#FF6B5B" opacity="0.5"/>
      <ellipse cx="50" cy="38" rx="3.5" ry="2.5" fill="#FF6B5B" opacity="0.5"/>
      <circle cx="22" cy="32" r="6" stroke="#1F2937" stroke-width="1.6" fill="white"/>
      <circle cx="42" cy="32" r="6" stroke="#1F2937" stroke-width="1.6" fill="white"/>
      <line x1="28" y1="32" x2="36" y2="32" stroke="#1F2937" stroke-width="1.6"/>
      <circle cx="22" cy="33" r="2.5" fill="#1F2937"/>
      <circle cx="42" cy="33" r="2.5" fill="#1F2937"/>
      <path d="M24 46 q8 6 16 0" stroke="#1F2937" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
  },
};

window.Pim = PIM_POSES;

/* ---------- Top Nav (shared) ---------- */
function renderNav(active = '') {
  const links = [
    { href: 'index.html', label: 'Anasayfa', key: 'home' },
    { href: 'etiket.html', label: 'Etiket', key: 'etiket' },
    { href: 'sticker.html', label: 'Sticker', key: 'sticker' },
    { href: 'hakkimizda.html', label: 'Hakkımızda', key: 'about' },
  ];
  return `
    <header class="nav">
      <div class="container nav-inner">
        <a href="index.html" class="nav-brand">
          <span class="brand-mark">P</span>
          <span>Pim Etiket</span>
        </a>
        <nav class="nav-links">
          ${links.map(l => `<a href="${l.href}" class="${active===l.key?'active':''}">${l.label}</a>`).join('')}
        </nav>
        <div class="nav-actions">
          <a href="cuzdan.html" class="btn btn-ghost btn-sm" aria-label="Cüzdan">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
            <span class="hide-sm">2.450 ₺</span>
          </a>
          <a href="dashboard.html" class="btn btn-ghost btn-sm" aria-label="Hesap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          </a>
          <a href="sepet.html" class="btn btn-primary btn-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h2l3 12h12l2-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>
            Sepet
          </a>
          <button class="nav-toggle" aria-label="Menü">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderFooter() {
  return `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand"><span class="brand-mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M5 3h11l5 5v13a2 2 0 0 1-2 2H5z"/><path d="M14 3v6h6"/></svg></span> Pim Etiket</div>
          <p style="color:#9CA3AF; font-size:14px; max-width:280px;">
            Markanın etiketi, fikrinin sticker'ı. Düşük adetten başlayan, AI destekli dijital baskı.
          </p>
          <div class="row gap-2" style="margin-top: 16px;">
            <a href="#" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg></a>
            <a href="#" aria-label="LinkedIn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="11" x2="8" y2="17"/><line x1="8" y1="8" x2="8" y2="8"/><path d="M12 17v-4a2 2 0 0 1 4 0v4"/><line x1="12" y1="11" x2="12" y2="17"/></svg></a>
            <a href="#" aria-label="Twitter"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4h3l-7 8 8 10h-6l-5-6-6 6H2l8-9L2 4h7l4 5z"/></svg></a>
          </div>
        </div>
        <div>
          <h4>Ürünler</h4>
          <a href="etiket.html">Etiket</a>
          <a href="sticker.html">Sticker</a>
          <a href="#">Yaldız uygulama</a>
          <a href="#">Numune talep et</a>
        </div>
        <div>
          <h4>Şirket</h4>
          <a href="hakkimizda.html">Hakkımızda</a>
          <a href="#">Pim'in hikayesi</a>
          <a href="#">Kariyer</a>
          <a href="#">Blog</a>
        </div>
        <div>
          <h4>Destek</h4>
          <a href="hakkimizda.html#sss">SSS</a>
          <a href="#">İletişim</a>
          <a href="#">KVKK</a>
          <a href="#">Sözleşmeler</a>
        </div>
      </div>
      <div class="footer-bot">
        <span>© 2026 Pim Etiket — Bursa, Türkiye</span>
        <span>10 günde elinde · Türkiye geneli kargo</span>
      </div>
    </div>
  </footer>`;
}

function renderBottomNav(active = '') {
  const items = [
    { href: 'index.html', key: 'home', label: 'Ana', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>' },
    { href: 'etiket.html', key: 'order', label: 'Sipariş', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/></svg>' },
    { href: 'cuzdan.html', key: 'wallet', label: 'Cüzdan', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 14h2"/></svg>' },
    { href: 'dashboard.html', key: 'orders', label: 'Siparişler', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h12"/></svg>' },
    { href: 'auth.html', key: 'profile', label: 'Profil', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>' },
  ];
  return `
    <nav class="bottom-nav">
      <div class="bottom-nav-inner">
        ${items.map(i => `<a href="${i.href}" class="${active===i.key?'active':''}">${i.icon}<span>${i.label}</span></a>`).join('')}
      </div>
    </nav>`;
}

/* ---------- Pim Chatbot ---------- */
function renderPimWidget() {
  return `
    <button class="pim-fab" id="pimFab" aria-label="Pim'le konuş">${PIM_POSES.head()}</button>
    <div class="pim-panel" id="pimPanel" role="dialog" aria-label="Pim Chatbot">
      <div class="pim-head">
        <div class="pim-avatar">${PIM_POSES.head()}</div>
        <div class="info">
          <strong>Pim — Etiket Profesörü</strong>
          <span><span class="status-dot"></span>Şu an çevrimiçi</span>
        </div>
        <button class="close" id="pimClose" aria-label="Kapat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>
      </div>
      <div class="pim-body" id="pimBody">
        <div class="pim-msg from-pim">
          <div class="mini-pim">${PIM_POSES.head()}</div>
          <div class="pim-bubble">Selam! Ben Pim. Etiket veya sticker konusunda neye ihtiyacın varsa burayım. ☺️</div>
        </div>
        <div class="pim-msg from-pim">
          <div class="mini-pim">${PIM_POSES.head()}</div>
          <div class="pim-bubble">Aşağıdan hızlı seçeneklerden birine tıklayabilir ya da serbest yazabilirsin.</div>
        </div>
      </div>
      <div class="pim-quick" id="pimQuick">
        <button>Kozmetik etiketi öner</button>
        <button>Fiyat nasıl hesaplanıyor?</button>
        <button>Sipariş durumu</button>
        <button>Numune isteyebilir miyim?</button>
      </div>
      <form class="pim-input" id="pimForm">
        <input type="text" placeholder="Pim'e bir şey yaz..." id="pimInput" autocomplete="off"/>
        <button type="submit" aria-label="Gönder">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor"/></svg>
        </button>
      </form>
    </div>
  `;
}

const PIM_REPLIES = {
  default: ["İlginç bir soru. Sana yardım edebilmem için biraz daha detay verir misin?", "Bunu konfigürasyon sayfasında daha kolay yapabiliriz aslında, ister misin?"],
  fiyat: ["Fiyatlar; malzeme + kaplama + adet + ölçü kombinasyonuna göre dinamik hesaplanır. Konfigürasyon sayfasında kaydırırken canlı görürsün.", "Etiket için 1.000 adetten, sticker için 25 adetten başlıyor. Adet arttıkça birim fiyat ciddi düşer."],
  kozmetik: ["Kozmetik için en çok tercih edilen: Beyaz PP + ultra clear kaplama + sıcak yaldız (gold). Su ve yağa dayanıklı, premium duruyor.", "Şişe formuna göre sarım yönü 4 veya 8 öneriyorum. Vereceğin etiket adediyle sana hızlı bir fiyat çıkarabilirim."],
  numune: ["Tabii, numune talebi için hesabını açtıktan sonra dashboard'dan 'Numune talep et' diyebilirsin. Ücretsiz, kargo bile bizden.", "Numune kitinde 8 farklı malzeme + 6 kaplama + 3 yaldız örneği geliyor."],
  siparis: ["Sipariş durumunu Dashboard > Siparişlerim sekmesinden adım adım takip edebilirsin. Her adımda buradan da sana ping atarım."],
  selam: ["Selam! Bugün ne basacağız? 😊", "Hoş geldin! Etiket mi sticker mı, hangisinden başlayalım?"],
  tesekkur: ["Rica ederim! Başka bir şey istersen buradayım.", "Ne demek, görevimiz bu 🎯"],
};

function pimReply(text) {
  const t = text.toLowerCase();
  if (/(selam|merhaba|hey|sa)/.test(t)) return random(PIM_REPLIES.selam);
  if (/(teşekkür|sağol|sagol|tşk|saol)/.test(t)) return random(PIM_REPLIES.tesekkur);
  if (/(fiyat|ücret|kaç para|maliyet)/.test(t)) return random(PIM_REPLIES.fiyat);
  if (/(kozmetik|şişe|sise|krem|parfüm)/.test(t)) return random(PIM_REPLIES.kozmetik);
  if (/(numune|örnek|sample)/.test(t)) return random(PIM_REPLIES.numune);
  if (/(sipariş|kargo|takip|nerde)/.test(t)) return random(PIM_REPLIES.siparis);
  return random(PIM_REPLIES.default);
}

function random(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function initPim() {
  const fab = document.getElementById('pimFab');
  const panel = document.getElementById('pimPanel');
  const close = document.getElementById('pimClose');
  const body = document.getElementById('pimBody');
  const form = document.getElementById('pimForm');
  const input = document.getElementById('pimInput');
  const quick = document.getElementById('pimQuick');
  if (!fab) return;

  fab.addEventListener('click', () => panel.classList.toggle('open'));
  close.addEventListener('click', () => panel.classList.remove('open'));

  function addMsg(text, from) {
    const div = document.createElement('div');
    div.className = `pim-msg from-${from}`;
    div.innerHTML = from === 'pim'
      ? `<div class="mini-pim">${PIM_POSES.head()}</div><div class="pim-bubble">${text}</div>`
      : `<div class="pim-bubble">${escapeHtml(text)}</div>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    addMsg(t, 'user');
    input.value = '';
    setTimeout(() => addMsg(pimReply(t), 'pim'), 600);
  });

  quick.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const txt = b.textContent;
      addMsg(txt, 'user');
      setTimeout(() => addMsg(pimReply(txt), 'pim'), 500);
    });
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- Toast ---------- */
function toast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.className = `toast ${type}`;
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 3000);
}

window.toast = toast;

/* ---------- Page bootstrap ---------- */
function mountShell({ active = '', bottomActive = '' } = {}) {
  // Inject nav into <body>
  const navHolder = document.getElementById('nav-holder');
  if (navHolder) navHolder.innerHTML = renderNav(active);
  const footHolder = document.getElementById('footer-holder');
  if (footHolder) footHolder.innerHTML = renderFooter();
  const bottomHolder = document.getElementById('bottom-nav-holder');
  if (bottomHolder) bottomHolder.innerHTML = renderBottomNav(bottomActive);
  const pimHolder = document.getElementById('pim-holder');
  if (pimHolder) {
    pimHolder.innerHTML = renderPimWidget();
    initPim();
  }
}

window.mountShell = mountShell;

/* ---------- Number formatting (TL) ---------- */
function fmtTL(n) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ₺';
}
function fmtTLDecimal(n) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ₺';
}
window.fmtTL = fmtTL;
window.fmtTLDecimal = fmtTLDecimal;

/* ---------- Animated count-up ---------- */
function countUp(el, to, duration = 600, fmt = (v)=>String(Math.round(v))) {
  const from = parseFloat(el.dataset.cur || '0');
  const start = performance.now();
  el.dataset.cur = to;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (to - from) * eased;
    el.textContent = fmt(v);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
window.countUp = countUp;

/* ---------- Accordion ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('.accordion-trigger');
  if (!t) return;
  t.parentElement.classList.toggle('open');
});

/* ---------- Auto-fade in elements with .reveal ---------- */
const io = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = 1;
      e.target.style.transform = 'none';
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 }) : null;
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.reveal').forEach(el => {
    el.style.opacity = 0;
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'opacity 600ms ease, transform 600ms ease';
    if (io) io.observe(el); else { el.style.opacity = 1; el.style.transform = 'none'; }
  });
});
