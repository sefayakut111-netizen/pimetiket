/* Pim Etiket — Anasayfa */

const Home = ({ go }) => {
  const { Sparkle, Box, Truck, Bolt, ChevR, Star, ArrowR, Roll, Sticker, Check, Info } = window.Icon;

  return (
    <div className="fade-up">
      {/* HERO */}
      <section style={{position: "relative", overflow: "hidden", paddingTop: 64, paddingBottom: 80}}>
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(900px 480px at 78% 28%, var(--krem) 0%, transparent 60%)"
        }}/>
        <div className="container" style={{position: "relative", zIndex: 1}}>
          <div style={{display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "center"}}>
            <div>
              <span className="eyebrow">Türkiye'nin akıllı dijital baskısı</span>
              <h1 className="h-display" style={{margin: "20px 0 24px"}}>
                Markanın etiketi,<br/>
                fikrinin <span style={{color: "var(--pim-mercan)", position: "relative"}}>
                  sticker'ı
                  <svg width="240" height="14" viewBox="0 0 240 14" style={{position: "absolute", left: 0, bottom: -6}}>
                    <path d="M2 8 Q60 2 120 8 T238 6" stroke="var(--pim-mercan)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                </span>.
              </h1>
              <p className="body muted" style={{maxWidth: 480, fontSize: 18, marginBottom: 32}}>
                1000 adetten başlayan, AI'ın elinden geçen, on günde kapına gelen dijital baskı.
                Pim sana yardım eder.
              </p>
              <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
                <button className="btn btn-primary btn-lg" onClick={() => go("etiket")}>
                  <Roll size={18}/> Etiket bastır
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => go("sticker")}>
                  <Sticker size={18}/> Sticker bastır
                </button>
              </div>

              <div style={{display: "flex", gap: 24, alignItems: "center", marginTop: 40, flexWrap: "wrap"}}>
                <div style={{display: "flex"}}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: ["#F5EBD9","#FFCDB9","#1F2937","#FF9933"][i],
                      border: "2px solid white",
                      marginLeft: i ? -10 : 0,
                    }}/>
                  ))}
                </div>
                <div>
                  <div style={{display: "flex", gap: 1, color: "#F0B22F"}}>
                    {[0,1,2,3,4].map(i => <Star key={i} size={14}/>)}
                  </div>
                  <div className="small muted" style={{marginTop: 2}}>2,400+ Türk markasının tercihi</div>
                </div>
              </div>
            </div>

            <div style={{position: "relative", display: "flex", justifyContent: "center", alignItems: "center"}}>
              <div style={{
                position: "absolute", width: 320, height: 320,
                background: "white", borderRadius: 32,
                boxShadow: "var(--sh-2)",
                transform: "rotate(-4deg)",
                zIndex: 0,
              }}/>
              <div style={{
                position: "absolute", width: 280, height: 280,
                background: "var(--pim-mercan-tint)", borderRadius: 28,
                transform: "rotate(6deg) translate(40px, 40px)",
                zIndex: -1,
              }}/>
              <div style={{position: "absolute", top: 30, left: 20, transform: "rotate(-12deg)", zIndex: 2}}>
                <div className="pill pill-mercan" style={{height: 32, fontSize: 13, padding: "0 14px"}}>
                  <Sparkle size={14}/> AI kontrol
                </div>
              </div>
              <div style={{position: "absolute", bottom: 60, right: 0, transform: "rotate(8deg)", zIndex: 2}}>
                <div className="pill" style={{background: "white", boxShadow: "var(--sh-1)", height: 32, fontSize: 13, padding: "0 14px"}}>
                  <Truck size={14} color="var(--pim-mercan)"/> 10 gün teslim
                </div>
              </div>
              <div style={{position: "relative", zIndex: 3}}>
                <Pim pose="wave" size={300}/>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 PILLAR */}
      <section style={{padding: "32px 0 64px"}}>
        <div className="container">
          <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16}}>
            {[
              { icon: <Bolt size={22}/>, t: "1000 adetten başla", d: "Düşük adette de kaliteden ödün vermeden bastırırsın. Stoklamadan, esnek." },
              { icon: <Sparkle size={22}/>, t: "AI tasarımına bakıyor", d: "Yüklediğin dosyayı saniyeler içinde kontrol eder; DPI, marka, yazım — eksik varsa söyler." },
              { icon: <Truck size={22}/>, t: "10 günde elinde", d: "Bursa'dan kapına. Şeffaf üretim takibi, gerçek zamanlı statü ve Pim'in haberleri." },
            ].map((p, i) => (
              <div key={i} className="card" style={{padding: 28}}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: "var(--pim-mercan-tint)", color: "var(--pim-mercan)",
                  display: "grid", placeItems: "center", marginBottom: 16,
                }}>{p.icon}</div>
                <div className="h3" style={{marginBottom: 6}}>{p.t}</div>
                <div className="body muted">{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TWO PRODUCT CARDS */}
      <section style={{padding: "48px 0"}}>
        <div className="container">
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16}}>
            <button onClick={() => go("etiket")} style={{textAlign: "left"}} className="card">
              <ProductCard
                kind="etiket"
                title="Etiket"
                sub="Rulodan etiket — kozmetik, gıda, içecek, parfüm."
                from="1000 adetten"
                price="2.13 TL/adet"
              />
            </button>
            <button onClick={() => go("sticker")} style={{textAlign: "left"}} className="card">
              <ProductCard
                kind="sticker"
                title="Sticker"
                sub="Tekli ya da tabakada — laptop, defter, kampanya."
                from="25 adetten"
                price="3.50 TL/adet"
              />
            </button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{padding: "80px 0", background: "var(--gri-50)"}}>
        <div className="container">
          <div style={{textAlign: "center", marginBottom: 48}}>
            <span className="eyebrow">Nasıl çalışır</span>
            <h2 className="h1" style={{margin: "16px auto 0", maxWidth: 640}}>
              Konfigüre et, dosyanı yükle, onayla — gerisini bize bırak.
            </h2>
          </div>

          <div style={{position: "relative"}}>
            <div style={{
              position: "absolute", left: "12.5%", right: "12.5%", top: 36,
              height: 2, background: "var(--gri-200)",
              zIndex: 0,
            }}/>
            <div style={{display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, position: "relative", zIndex: 1}}>
              {[
                { n: "01", t: "Konfigüre et", d: "Malzeme, kaplama, ölçü, adet — anlık fiyat." },
                { n: "02", t: "Dosyanı yükle", d: "PDF, AI, EPS… AI saniyeler içinde kontrol eder." },
                { n: "03", t: "Provayı onayla", d: "Rulonun üstünde nasıl görüneceğini gör, onayla." },
                { n: "04", t: "Teslim al", d: "Bursa'dan kapına ortalama 10 günde." },
              ].map((s, i) => (
                <div key={i} style={{textAlign: "center"}}>
                  <div style={{
                    width: 72, height: 72, borderRadius: "50%",
                    background: "white", border: "2px solid var(--gri-200)",
                    display: "grid", placeItems: "center",
                    margin: "0 auto 20px",
                    fontWeight: 700, fontSize: 22,
                    color: "var(--pim-mercan)",
                    boxShadow: "var(--sh-1)",
                  }}>{s.n}</div>
                  <div className="h3" style={{marginBottom: 6}}>{s.t}</div>
                  <div className="body muted" style={{maxWidth: 220, margin: "0 auto"}}>{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section">
        <div className="container">
          <div style={{display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16}}>
            {[
              { n: "Defne Karaca", b: "Olea — Naturel sabun", q: "İlk siparişte 1500 adet etiketi 9 günde elimde gördüm. Pim hata diye saydığını gerçekten yakaladı.", c: "var(--krem)" },
              { n: "Mert Yılmaz", b: "Bulutlu Roastery", q: "Mat selefon + sıcak yaldızla raf etkisi inanılmaz oldu. Online sipariş ettiğim için inanamıyorum.", c: "white" },
              { n: "Ezgi & Can", b: "Atölye Niş", q: "Sticker tarafı tam bizim için. Az adet, hızlı, harika kâğıt. Müşterilerimize hediye olarak veriyoruz.", c: "var(--pim-mercan-tint)" },
            ].map((t, i) => (
              <div key={i} className="card" style={{padding: 28, background: t.c}}>
                <div style={{display: "flex", gap: 1, color: "#F0B22F", marginBottom: 14}}>
                  {[0,1,2,3,4].map(j => <Star key={j} size={14}/>)}
                </div>
                <p className="body" style={{fontSize: 17, lineHeight: 1.5, marginBottom: 24, fontWeight: 500}}>"{t.q}"</p>
                <div style={{display: "flex", alignItems: "center", gap: 12}}>
                  <div style={{width: 40, height: 40, borderRadius: "50%", background: "var(--lacivert)", color: "white", display: "grid", placeItems: "center", fontWeight: 700}}>{t.n[0]}</div>
                  <div>
                    <div style={{fontWeight: 600}}>{t.n}</div>
                    <div className="small muted">{t.b}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ PREVIEW */}
      <section style={{padding: "48px 0"}}>
        <div className="container">
          <div style={{display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 64, alignItems: "start"}}>
            <div>
              <span className="eyebrow">Sıkça sorulanlar</span>
              <h2 className="h1" style={{margin: "16px 0 24px"}}>Cevap genelde "evet, hallederiz".</h2>
              <p className="body muted" style={{marginBottom: 24}}>Hâlâ kafa karışıyor mu? Pim cevap vermek için sayfanın sağ alt köşesinde bekliyor.</p>
              <button className="btn btn-secondary">Tüm SSS <ChevR size={14}/></button>
            </div>
            <div className="col">
              {[
                { q: "Minimum kaç adet basabiliyorum?", a: "Etiket için 1000, sticker için 25 adetten başlıyoruz." },
                { q: "Tasarım dosyam yok, ne yapacağım?", a: "Pim'e söyle, basit bir tasarım için kütüphanemizdeki şablonlardan birini özelleştirebilirsin; daha karmaşık iş için partner stüdyolarımızla bağlarız." },
                { q: "10 günden hızlı teslim mümkün mü?", a: "Evet, 'hızlı şerit' opsiyonu ile 5 güne kadar düşürebiliyoruz; ek ücreti konfigürasyon sayfasında görürsün." },
              ].map((f, i) => (
                <details key={i} className="card" style={{padding: "18px 24px", cursor: "pointer"}}>
                  <summary style={{display: "flex", justifyContent: "space-between", alignItems: "center", listStyle: "none", fontWeight: 600, fontSize: 16}}>
                    {f.q}
                    <span style={{color: "var(--pim-mercan)"}}>+</span>
                  </summary>
                  <p className="body muted" style={{marginTop: 10, marginBottom: 0}}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{padding: "80px 0"}}>
        <div className="container">
          <div style={{
            background: "var(--lacivert)",
            color: "white",
            borderRadius: 32,
            padding: "64px 56px",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
              opacity: 0.7,
            }}/>
            <div style={{display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, alignItems: "center", position: "relative"}}>
              <div>
                <h2 className="h1" style={{color: "white", margin: 0, fontSize: 48}}>Hadi başlayalım.</h2>
                <p className="body" style={{color: "rgba(255,255,255,0.75)", marginTop: 16, fontSize: 18, maxWidth: 520}}>
                  İlk siparişin için Pim ile bir tur at. 5 dakikada konfigüre, anında fiyat, gerisi bizden.
                </p>
                <div style={{display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap"}}>
                  <button className="btn btn-lg" style={{background: "var(--pim-mercan)", color: "white"}} onClick={() => go("etiket")}>
                    Etiket bastır <ArrowR/>
                  </button>
                  <button className="btn btn-lg btn-ghost" style={{color: "white"}} onClick={() => go("sticker")}>
                    Sticker'a göz at
                  </button>
                </div>
              </div>
              <div style={{display: "flex", justifyContent: "center"}}>
                <Pim pose="excited" size={240}/>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ProductCard = ({ kind, title, sub, from, price }) => {
  const isEtiket = kind === "etiket";
  return (
    <div style={{display: "flex", gap: 0, padding: 0, overflow: "hidden", borderRadius: 16}}>
      <div style={{
        flex: "0 0 240px",
        background: isEtiket ? "var(--krem)" : "linear-gradient(135deg, #FFE7D6 0%, #FFA89E 100%)",
        position: "relative",
        display: "grid", placeItems: "center",
        minHeight: 220,
      }}>
        {isEtiket ? <RolloPreview/> : <StickerPile/>}
      </div>
      <div style={{padding: 28, flex: 1}}>
        <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
          <h3 className="h2" style={{margin: 0}}>{title}</h3>
          <div className="pill pill-krem">{from}</div>
        </div>
        <p className="body muted" style={{marginBottom: 16, marginTop: 4}}>{sub}</p>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <div>
            <div className="tiny muted">{title} fiyatı, başlangıç</div>
            <div style={{fontWeight: 700, fontSize: 22}}>{price}</div>
          </div>
          <span style={{display: "inline-flex", alignItems: "center", gap: 6, color: "var(--pim-mercan)", fontWeight: 600}}>
            Konfigüre et <window.Icon.ArrowR size={16}/>
          </span>
        </div>
      </div>
    </div>
  );
};

const RolloPreview = () => (
  <svg width="180" height="180" viewBox="0 0 180 180">
    <defs>
      <linearGradient id="rollo" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#E8DCC4"/>
        <stop offset="50%" stopColor="white"/>
        <stop offset="100%" stopColor="#E8DCC4"/>
      </linearGradient>
    </defs>
    <ellipse cx="90" cy="40" rx="62" ry="14" fill="#1F2937" opacity="0.08"/>
    <rect x="28" y="40" width="124" height="100" fill="url(#rollo)"/>
    <ellipse cx="90" cy="40" rx="62" ry="14" fill="white"/>
    <ellipse cx="90" cy="40" rx="62" ry="14" fill="none" stroke="#1F2937" strokeWidth="1" opacity="0.2"/>
    <rect x="50" y="60" width="80" height="60" rx="6" fill="white" stroke="#1F2937" strokeWidth="1"/>
    <text x="90" y="86" textAnchor="middle" fontWeight="700" fontSize="14" fill="#1F2937" fontFamily="Nunito">OLEA</text>
    <text x="90" y="102" textAnchor="middle" fontSize="9" fill="#FF6B5B" fontFamily="Nunito" fontWeight="600">DOĞAL SABUN</text>
    <line x1="60" y1="110" x2="120" y2="110" stroke="#1F2937" strokeWidth="0.5" opacity="0.3"/>
    <ellipse cx="90" cy="140" rx="62" ry="14" fill="#1F2937" opacity="0.05"/>
  </svg>
);

const StickerPile = () => (
  <svg width="200" height="180" viewBox="0 0 200 180">
    <g transform="translate(40 30) rotate(-12)">
      <rect width="100" height="100" rx="20" fill="white" stroke="#1F2937" strokeWidth="1.5"/>
      <text x="50" y="58" textAnchor="middle" fontWeight="800" fontSize="28" fill="#FF6B5B" fontFamily="Nunito">PİM</text>
    </g>
    <g transform="translate(70 50) rotate(8)">
      <circle cx="50" cy="50" r="50" fill="#1F2937"/>
      <text x="50" y="58" textAnchor="middle" fontWeight="800" fontSize="22" fill="white" fontFamily="Nunito">YENİ!</text>
    </g>
    <g transform="translate(30 80) rotate(15)">
      <path d="M50 0 L60 38 L100 38 L68 60 L80 100 L50 75 L20 100 L32 60 L0 38 L40 38 Z" fill="#FF9933"/>
    </g>
  </svg>
);

window.Home = Home;
