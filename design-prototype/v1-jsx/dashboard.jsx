/* Pim Etiket — Dashboard */

const Dashboard = ({ go }) => {
  const { Sparkle, Box, Truck, Bolt, Wallet, Plus, ChevR, ArrowR, Roll, Sticker: StickerIc, Calendar } = window.Icon;

  const orders = [
    { id: "PE-2026-1182", title: "Olea Doğal Sabun — etiket", qty: 2000, mat: "Kraft + mat selefon",
      status: "Kontrolde", color: "var(--sari)", soft: "var(--sari-soft)", phase: 4, days: 3, action: "Provayı incele", pim: "inspect" },
    { id: "PE-2026-1175", title: "Bulutlu Roastery — sticker", qty: 500, mat: "Vinil + parlak",
      status: "Üretimde", color: "var(--pim-mercan)", soft: "var(--pim-mercan-tint)", phase: 6, days: 5, action: "Detay", pim: "happy" },
    { id: "PE-2026-1167", title: "Atölye Niş — Holografik tabaka", qty: 250, mat: "Holografik + glitter",
      status: "Kargoda", color: "var(--lacivert)", soft: "var(--gri-100)", phase: 7, days: 1, action: "Takip et", pim: "box" },
  ];

  const phases = ["Konfigüre", "Ödendi", "Yüklendi", "AI kontrol", "Onay", "Üretim", "Kargo", "Teslim"];

  return (
    <div className="fade-up" style={{background: "var(--gri-50)", minHeight: "calc(100vh - 64px)"}}>
      <div className="container" style={{padding: "32px 32px 80px"}}>

        {/* HERO */}
        <div className="card" style={{
          padding: 32,
          background: "linear-gradient(135deg, var(--krem) 0%, #FAF4E8 100%)",
          border: "none",
          marginBottom: 24,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{position: "absolute", top: -20, right: 32, opacity: 0.95}}>
            <Pim pose="wave" size={160}/>
          </div>
          <div className="tiny muted">8 MAYIS, CUMA</div>
          <h1 className="h1" style={{margin: "8px 0 6px"}}>Hoş geldin, Ahmet 👋</h1>
          <p className="body muted" style={{margin: 0}}>Bugün üç siparişin yolda. Olea provasını bekliyorum, hazır olunca bakalım.</p>

          <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 28, maxWidth: 720}}>
            <Stat label="Aktif sipariş" value="3" sub="2 üretimde, 1 kargoda" icon={<Box size={18}/>} accent="var(--pim-mercan)"/>
            <Stat label="Cüzdan bakiyen" value="2.480 TL" sub="Son işlem: 6 gün önce" icon={<Wallet size={18}/>} accent="var(--yesil)"/>
            <Stat label="Bu yıl basıldı" value="14.250" sub="adet etiket + sticker" icon={<Sparkle size={18}/>} accent="var(--turuncu)"/>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32}}>
          <QuickAction icon={<Roll/>} title="Yeni etiket" desc="1000 adetten başla" onClick={() => go("etiket")} primary/>
          <QuickAction icon={<StickerIc/>} title="Yeni sticker" desc="25 adetten başla" onClick={() => go("sticker")}/>
          <QuickAction icon={<Bolt/>} title="Tekrar sipariş" desc="Olea — 2000 adet" onClick={() => {}}/>
        </div>

        <div style={{display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start"}}>
          {/* MAIN COLUMN */}
          <div style={{display: "flex", flexDirection: "column", gap: 24}}>

            {/* Active orders */}
            <div>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14}}>
                <h2 className="h2" style={{margin: 0}}>Aktif siparişler</h2>
                <button className="btn btn-sm btn-ghost">Tümünü gör <ChevR size={12}/></button>
              </div>

              <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                {orders.map(o => (
                  <div key={o.id} className="card" style={{padding: 20}}>
                    <div style={{display: "flex", gap: 16, alignItems: "flex-start"}}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 12,
                        background: o.soft, color: o.color,
                        display: "grid", placeItems: "center",
                        flexShrink: 0,
                      }}>
                        <window.PimMini pose={o.pim} size={48}/>
                      </div>

                      <div style={{flex: 1, minWidth: 0}}>
                        <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 4}}>
                          <div className="tiny muted">{o.id}</div>
                          <div className="pill" style={{background: o.soft, color: o.color, height: 22, fontSize: 12}}>
                            <div style={{width: 6, height: 6, borderRadius: "50%", background: o.color}}/>
                            {o.status}
                          </div>
                        </div>
                        <div style={{fontWeight: 600, fontSize: 16, marginBottom: 2}}>{o.title}</div>
                        <div className="small muted">{o.qty} adet · {o.mat}</div>

                        {/* Phase mini timeline */}
                        <div style={{display: "flex", alignItems: "center", gap: 4, marginTop: 14}}>
                          {phases.map((p, i) => (
                            <div key={i} style={{flex: 1, display: "flex", alignItems: "center", gap: 4}}>
                              <div style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: i < o.phase ? "var(--yesil)" : i === o.phase ? o.color : "var(--gri-200)",
                                flexShrink: 0,
                                boxShadow: i === o.phase ? `0 0 0 4px ${o.soft}` : "none",
                              }}/>
                              {i < phases.length - 1 && (
                                <div style={{flex: 1, height: 2, background: i < o.phase ? "var(--yesil)" : "var(--gri-200)"}}/>
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{display: "flex", justifyContent: "space-between", marginTop: 6}}>
                          <div className="tiny muted">{phases[o.phase]}</div>
                          <div className="tiny" style={{color: o.color, fontWeight: 700}}>
                            {o.phase >= 4 ? `${o.days} gün kaldı` : "Devam ediyor"}
                          </div>
                        </div>
                      </div>

                      <button className="btn btn-secondary btn-sm" style={{flexShrink: 0}}>{o.action} <ChevR size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI suggestion card */}
            <div className="card" style={{
              padding: 20,
              background: "linear-gradient(135deg, var(--lacivert) 0%, #2C3849 100%)",
              color: "white", border: "none",
              display: "flex", gap: 20, alignItems: "center",
            }}>
              <window.PimMini pose="think" size={56}/>
              <div style={{flex: 1}}>
                <div className="tiny" style={{color: "rgba(255,255,255,0.6)"}}>SANA ÖZEL</div>
                <div style={{fontWeight: 600, fontSize: 15, marginTop: 4, lineHeight: 1.4}}>
                  Geçen ay 5.000 etiket bastın — stokun azalmış olabilir, tekrar sipariş?
                </div>
              </div>
              <button className="btn btn-sm" style={{background: "white", color: "var(--lacivert)"}}>
                Yeniden bastır <ArrowR size={14}/>
              </button>
            </div>

            {/* Design library */}
            <div>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14}}>
                <h2 className="h2" style={{margin: 0}}>Tasarım kütüphanen</h2>
                <button className="btn btn-sm btn-ghost"><Plus size={14}/> Yeni yükle</button>
              </div>
              <div className="scroll-x">
                {[
                  { name: "Olea_v3.pdf", note: "Kullanıldı 2x", c: "#F5EBD9" },
                  { name: "Bulutlu_logo.ai", note: "Kullanıldı 1x", c: "#FFE7D6" },
                  { name: "Niş_holo_2026.pdf", note: "Yeni", c: "#FFD9D2" },
                  { name: "Olea_kapak.pdf", note: "Taslak", c: "#E8F5EE" },
                  { name: "Defterler_v1.eps", note: "Kullanıldı 4x", c: "#F3F2EE" },
                ].map((f, i) => (
                  <div key={i} className="card" style={{width: 180, padding: 0, overflow: "hidden", flexShrink: 0}}>
                    <div style={{height: 130, background: f.c, position: "relative", display: "grid", placeItems: "center"}}>
                      <svg width="64" height="80" viewBox="0 0 64 80">
                        <rect x="6" y="2" width="52" height="74" rx="4" fill="white" stroke="#1F2937" strokeWidth="1"/>
                        <rect x="14" y="14" width="36" height="6" rx="1" fill="#FF6B5B"/>
                        <rect x="14" y="26" width="28" height="3" rx="1" fill="#1F2937" opacity="0.4"/>
                        <rect x="14" y="34" width="32" height="3" rx="1" fill="#1F2937" opacity="0.4"/>
                        <rect x="14" y="48" width="36" height="20" rx="2" fill="#F5EBD9"/>
                      </svg>
                    </div>
                    <div style={{padding: 12}}>
                      <div style={{fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{f.name}</div>
                      <div className="tiny muted" style={{marginTop: 2}}>{f.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SIDE COLUMN */}
          <div style={{display: "flex", flexDirection: "column", gap: 16}}>
            {/* Wallet detail */}
            <div className="card" style={{padding: 20}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14}}>
                <h3 className="h3" style={{margin: 0, fontSize: 16}}>Cüzdan</h3>
                <Wallet size={18}/>
              </div>
              <div style={{fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em"}}>2.480 <span style={{fontSize: 16, fontWeight: 600, color: "var(--gri-700)"}}>TL</span></div>
              <div className="small muted" style={{marginTop: 4}}>Cüzdandan ödeyince <strong style={{color: "var(--yesil)"}}>+%2 indirim</strong> kazanırsın</div>
              <div style={{display: "flex", gap: 8, marginTop: 14}}>
                <button className="btn btn-sm btn-primary" style={{flex: 1}}><Plus size={14}/> Yatır</button>
                <button className="btn btn-sm btn-secondary" style={{flex: 1}}>Geçmiş</button>
              </div>
              {/* mini transactions */}
              <div style={{borderTop: "1px solid var(--gri-200)", marginTop: 16, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8}}>
                {[
                  { d: "2 May", t: "Sipariş PE-1175", a: -1750, },
                  { d: "28 Nis", t: "İade bonusu", a: +120, },
                  { d: "15 Nis", t: "Cüzdana yatırma", a: +5000, },
                ].map((tr, i) => (
                  <div key={i} style={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13}}>
                    <div>
                      <div style={{fontWeight: 500}}>{tr.t}</div>
                      <div className="tiny muted">{tr.d}</div>
                    </div>
                    <div style={{fontWeight: 600, color: tr.a > 0 ? "var(--yesil)" : "var(--lacivert)"}}>
                      {tr.a > 0 ? "+" : ""}{tr.a.toLocaleString("tr-TR")} TL
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile shortcuts */}
            <div className="card" style={{padding: 8}}>
              {[
                { t: "Profil ayarları", d: "Adres, fatura bilgileri" },
                { t: "Kurumsal hesap", d: "B2B fatura ve cari" },
                { t: "Bildirim tercihleri", d: "E-posta, SMS, push" },
                { t: "Yardım merkezi", d: "Pim ile sohbet" },
              ].map((s, i, a) => (
                <button key={i} style={{
                  width: "100%", padding: "14px 12px", textAlign: "left",
                  display: "flex", alignItems: "center", gap: 12,
                  borderRadius: 10,
                  borderBottom: i < a.length - 1 ? "1px solid var(--gri-100)" : "none",
                }}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: 600, fontSize: 14}}>{s.t}</div>
                    <div className="tiny muted">{s.d}</div>
                  </div>
                  <ChevR size={14}/>
                </button>
              ))}
            </div>

            {/* Pim chat shortcut */}
            <div className="card" style={{padding: 18, background: "var(--krem)"}}>
              <div style={{display: "flex", gap: 12, alignItems: "center", marginBottom: 10}}>
                <window.PimMini pose="chat" size={40}/>
                <div>
                  <div style={{fontWeight: 700}}>Pim'le konuş</div>
                  <div className="tiny muted">Etiket Profesörü · şu an çevrimiçi</div>
                </div>
              </div>
              <button className="btn btn-sm btn-block" style={{background: "var(--lacivert)", color: "white"}}>Sohbeti aç</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub, icon, accent }) => (
  <div style={{
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(6px)",
    borderRadius: 14,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.6)",
  }}>
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
      <div className="tiny muted">{label}</div>
      <div style={{color: accent}}>{icon}</div>
    </div>
    <div style={{fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 6, lineHeight: 1}}>{value}</div>
    <div className="tiny muted" style={{marginTop: 6}}>{sub}</div>
  </div>
);

const QuickAction = ({ icon, title, desc, onClick, primary }) => (
  <button onClick={onClick} className="card" style={{
    padding: 18, textAlign: "left",
    background: primary ? "var(--lacivert)" : "white",
    color: primary ? "white" : "var(--lacivert)",
    border: primary ? "none" : "1px solid var(--gri-200)",
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: 14,
    transition: "transform 120ms",
  }}
  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
    <div style={{
      width: 44, height: 44, borderRadius: 10,
      background: primary ? "var(--pim-mercan)" : "var(--pim-mercan-tint)",
      color: primary ? "white" : "var(--pim-mercan)",
      display: "grid", placeItems: "center",
    }}>{icon}</div>
    <div style={{flex: 1}}>
      <div style={{fontWeight: 600, fontSize: 15}}>{title}</div>
      <div className="small" style={{opacity: 0.7, marginTop: 2}}>{desc}</div>
    </div>
    <window.Icon.ArrowR size={16}/>
  </button>
);

window.Dashboard = Dashboard;
