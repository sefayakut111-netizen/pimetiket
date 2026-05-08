/* Pim Etiket — Etiket Konfigürasyon Sayfası (the critical one) */

const Etiket = ({ go }) => {
  const { ChevR, Info, Sparkle, ArrowR, Calendar, Plus, Check } = window.Icon;

  const [material, setMaterial] = React.useState("kraft");
  const [coating, setCoating] = React.useState("mat");
  const [custom, setCustom] = React.useState("yok");
  const [yaldiz, setYaldiz] = React.useState("altin");
  const [winding, setWinding] = React.useState(1);
  const [qty, setQty] = React.useState(2000);
  const [width, setWidth] = React.useState(60);
  const [height, setHeight] = React.useState(80);

  const materials = [
    { id: "kraft", name: "Kraft", desc: "Doğal, dokunsal", swatch: "#C9A47A" },
    { id: "beyaz", name: "Beyaz semi-glos", desc: "Klasik, parlak", swatch: "#F8F8F4" },
    { id: "ultra", name: "Ultra clear", desc: "Şeffaf cam etkisi", swatch: "linear-gradient(135deg, #E0F2FE 0%, #FFFFFF 100%)" },
    { id: "metalik", name: "Metalik", desc: "Folyo gümüş", swatch: "linear-gradient(135deg, #C0C7CD 0%, #EFF2F6 60%, #B2BAC2 100%)" },
  ];
  const coatings = [
    { id: "mat", name: "Mat selefon", desc: "Yansımasız, premium" },
    { id: "parlak", name: "Parlak selefon", desc: "Canlı, temiz" },
    { id: "soft", name: "Soft touch", desc: "Velvet his" },
    { id: "yok", name: "Kaplama yok", desc: "Kâğıt dokusu kalsın" },
  ];
  const customs = [
    { id: "yok", name: "Eklenti yok", desc: "Sade ve hızlı" },
    { id: "emboss", name: "Kabartma (emboss)", desc: "Logo / metin kabartması" },
    { id: "yaldiz", name: "Sıcak yaldız", desc: "Folyo baskı, premium parıltı" },
    { id: "spotuv", name: "Spot UV", desc: "Parlak nokta vurgu" },
  ];
  const yaldizlar = [
    { id: "altin", c: "linear-gradient(135deg,#FFE08A 0%, #C99A3D 100%)" },
    { id: "gulkurusu", c: "linear-gradient(135deg,#FFD3CB 0%, #C97862 100%)" },
    { id: "gumus", c: "linear-gradient(135deg,#E5E9EE 0%, #9BA4AD 100%)" },
    { id: "bakir", c: "linear-gradient(135deg,#F0B17A 0%, #A65A2C 100%)" },
    { id: "siyahkrom", c: "linear-gradient(135deg,#4A4F55 0%, #11141A 100%)" },
    { id: "yesil", c: "linear-gradient(135deg,#D6F0D0 0%, #2F6B2F 100%)" },
    { id: "lacivert", c: "linear-gradient(135deg,#7B92C6 0%, #1F2A4D 100%)" },
    { id: "holo", c: "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)" },
  ];

  // pricing
  const matPrice = { kraft: 1.6, beyaz: 1.4, ultra: 2.1, metalik: 2.6 }[material];
  const coatPrice = { mat: 0.4, parlak: 0.35, soft: 0.55, yok: 0 }[coating];
  const customPrice = { yok: 0, emboss: 0.6, yaldiz: 0.9, spotuv: 0.5 }[custom];
  const sizeFactor = (width * height) / (60 * 80);
  const tierDiscount = qty >= 20000 ? 0.78 : qty >= 10000 ? 0.84 : qty >= 5000 ? 0.9 : qty >= 2000 ? 0.96 : 1;
  const unit = (matPrice + coatPrice + customPrice) * sizeFactor * tierDiscount;
  const total = unit * qty;

  const fmt = (n) => Math.round(n).toLocaleString("tr-TR");
  const fmtUnit = (n) => n.toFixed(2).replace(".", ",");

  const teslim = (() => {
    const days = qty > 10000 ? 12 : qty > 3000 ? 10 : 8;
    const d = new Date(2026, 4, 8 + days);
    const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  })();

  const upsell = (() => {
    if (qty < 2000) return { msg: "+1000 adet ekle, %4 daha tasarruf", to: 2000 };
    if (qty < 5000) return { msg: "5000'e çık, %6 daha tasarruf", to: 5000 };
    if (qty < 10000) return { msg: "10000'e çık, %6 daha tasarruf", to: 10000 };
    if (qty < 20000) return { msg: "20000'e çık, %7 daha tasarruf", to: 20000 };
    return null;
  })();

  return (
    <div className="fade-up" style={{background: "var(--gri-50)", minHeight: "calc(100vh - 64px)"}}>
      {/* breadcrumb */}
      <div style={{borderBottom: "1px solid var(--gri-200)", background: "white"}}>
        <div className="container" style={{padding: "16px 32px", display: "flex", alignItems: "center", gap: 8, fontSize: 14}}>
          <button className="btn-ghost small" onClick={() => go("home")} style={{padding: "4px 8px", borderRadius: 6}}>Anasayfa</button>
          <ChevR size={14}/>
          <span style={{fontWeight: 600}}>Etiket konfigüre et</span>
        </div>
      </div>

      <div className="container" style={{padding: "32px 32px 80px"}}>
        <div style={{display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 32, alignItems: "start"}}>
          {/* LEFT — preview */}
          <div style={{position: "sticky", top: 80}}>
            <PreviewCanvas
              material={material}
              coating={coating}
              custom={custom}
              yaldiz={yaldiz}
              winding={winding}
              width={width}
              height={height}
            />
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "0 8px"}}>
              <div className="small muted">Seçimlerin canlı önizlemesi</div>
              <div style={{display: "flex", gap: 8}}>
                <button className="btn btn-sm btn-ghost" style={{boxShadow: "inset 0 0 0 1px var(--gri-200)"}}>3D</button>
                <button className="btn btn-sm btn-ghost" style={{boxShadow: "inset 0 0 0 1px var(--gri-200)"}}>Düz</button>
              </div>
            </div>
          </div>

          {/* RIGHT — config */}
          <div style={{display: "flex", flexDirection: "column", gap: 20}}>
            <div>
              <h1 className="h1" style={{margin: 0}}>Etiketini konfigüre et</h1>
              <p className="body muted" style={{marginTop: 8}}>Seçimlerin sol taraftaki rulonun üstünde anında görünür.</p>
            </div>

            {/* Step 1 — material */}
            <Step n={1} title="Malzeme" hint="Etiketin dokusunu ve hissini belirler.">
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
                {materials.map(m => (
                  <SelectableCard key={m.id} selected={material === m.id} onClick={() => setMaterial(m.id)}>
                    <div style={{
                      width: "100%", height: 56, borderRadius: 8,
                      background: m.swatch.startsWith("linear") ? m.swatch : m.swatch,
                      backgroundImage: m.swatch.startsWith("linear") ? m.swatch : undefined,
                      border: "1px solid rgba(31,41,55,0.06)",
                      marginBottom: 10,
                    }}/>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
                      <div>
                        <div style={{fontWeight: 600, fontSize: 14}}>{m.name}</div>
                        <div className="small muted" style={{marginTop: 2}}>{m.desc}</div>
                      </div>
                      <button className="dim" style={{padding: 2, lineHeight: 0}}><Info size={14}/></button>
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </Step>

            {/* Step 2 — coating */}
            <Step n={2} title="Kaplama" hint="Yüzey parlaklığı ve dokunsal his.">
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
                {coatings.map(c => (
                  <SelectableCard key={c.id} selected={coating === c.id} onClick={() => setCoating(c.id)} compact>
                    <div style={{fontWeight: 600, fontSize: 14}}>{c.name}</div>
                    <div className="small muted" style={{marginTop: 2}}>{c.desc}</div>
                  </SelectableCard>
                ))}
              </div>
            </Step>

            {/* Step 3 — custom */}
            <Step n={3} title="Özelleştirme" hint="Premium dokunuş — her adetin değil.">
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
                {customs.map(c => (
                  <SelectableCard key={c.id} selected={custom === c.id} onClick={() => setCustom(c.id)} compact>
                    <div style={{fontWeight: 600, fontSize: 14}}>{c.name}</div>
                    <div className="small muted" style={{marginTop: 2}}>{c.desc}</div>
                  </SelectableCard>
                ))}
              </div>

              {custom === "yaldiz" && (
                <div style={{marginTop: 12, padding: 14, background: "var(--gri-50)", borderRadius: 12, border: "1px solid var(--gri-200)"}}>
                  <div className="small" style={{fontWeight: 600, marginBottom: 10}}>Yaldız rengi</div>
                  <div style={{display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8}}>
                    {yaldizlar.map(y => (
                      <button key={y.id} onClick={() => setYaldiz(y.id)}
                        style={{
                          width: "100%", aspectRatio: "1", borderRadius: 8,
                          background: y.c, position: "relative",
                          boxShadow: yaldiz === y.id ? "0 0 0 3px var(--pim-mercan), 0 0 0 5px white" : "inset 0 0 0 1px rgba(31,41,55,0.1)",
                          transition: "box-shadow 150ms",
                        }}>
                        {yaldiz === y.id && <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "white", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))"}}><Check size={14}/></div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Step>

            {/* Step 4 — winding */}
            <Step n={4} title="Sarım yönü" hint="Otomatik etiketleme makinesi varsa önemli. R harfi etiketin baskı yönünü temsil eder.">
              {/* DIŞA SARIM */}
              <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 10}}>
                <div className="tiny" style={{color: "var(--lacivert)", fontWeight: 700, letterSpacing: "0.1em"}}>DIŞA SARIM</div>
                <div style={{flex: 1, height: 1, background: "var(--gri-200)"}}/>
              </div>
              <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18}}>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => setWinding(n)}
                    className={`selectable ${winding === n ? "is-selected" : ""}`}
                    style={{padding: "12px 8px 10px", textAlign: "center"}}>
                    <WindingIcon n={n}/>
                    <div className="tiny" style={{marginTop: 8, color: winding === n ? "var(--pim-mercan)" : "var(--gri-700)"}}>SARIM {n}</div>
                    <div className="tick"><Check size={10}/></div>
                  </button>
                ))}
              </div>
              {/* İÇE SARIM */}
              <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 10}}>
                <div className="tiny" style={{color: "var(--lacivert)", fontWeight: 700, letterSpacing: "0.1em"}}>İÇE SARIM</div>
                <div style={{flex: 1, height: 1, background: "var(--gri-200)"}}/>
              </div>
              <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10}}>
                {[5,6,7,8].map(n => (
                  <button key={n} onClick={() => setWinding(n)}
                    className={`selectable ${winding === n ? "is-selected" : ""}`}
                    style={{padding: "12px 8px 10px", textAlign: "center"}}>
                    <WindingIcon n={n}/>
                    <div className="tiny" style={{marginTop: 8, color: winding === n ? "var(--pim-mercan)" : "var(--gri-700)"}}>SARIM {n}</div>
                    <div className="tick"><Check size={10}/></div>
                  </button>
                ))}
              </div>
              <div className="small muted" style={{marginTop: 14, padding: "10px 12px", background: "var(--gri-50)", borderRadius: 8, display: "flex", gap: 8, alignItems: "flex-start"}}>
                <Info size={14}/>
                <span>Emin değilsen <strong style={{color: "var(--lacivert)"}}>Sarım 1</strong>'i seç — en yaygın kullanılan yön. Pim sana yardım edebilir.</span>
              </div>
            </Step>

            {/* Step 5 — quantity / size */}
            <Step n={5} title="Adet ve ölçü" hint="Slider'ı kaydırdıkça fiyat anında değişir.">
              <div>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12}}>
                  <div className="small" style={{fontWeight: 600}}>Adet</div>
                  <div style={{fontWeight: 700, fontSize: 22}}>{fmt(qty)} <span className="small muted">adet</span></div>
                </div>
                <input type="range" min={1000} max={50000} step={1000}
                  value={qty} onChange={e => setQty(+e.target.value)}
                  className="qty-slider"/>
                <div style={{display: "flex", justifyContent: "space-between", marginTop: 6}}>
                  {[1000, 5000, 10000, 20000, 50000].map(t => (
                    <button key={t} onClick={() => setQty(t)} className="small dim" style={{padding: 0}}>
                      {t >= 1000 ? `${t/1000}K` : t}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20}}>
                <div>
                  <div className="small" style={{fontWeight: 600, marginBottom: 6}}>Genişlik (mm)</div>
                  <input className="input" type="number" value={width} onChange={e => setWidth(+e.target.value || 0)}/>
                </div>
                <div>
                  <div className="small" style={{fontWeight: 600, marginBottom: 6}}>Yükseklik (mm)</div>
                  <input className="input" type="number" value={height} onChange={e => setHeight(+e.target.value || 0)}/>
                </div>
              </div>
            </Step>

            {/* Price card */}
            <div className="card" style={{padding: 24, background: "white", marginTop: 8, position: "relative", overflow: "hidden"}}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 4,
                background: "linear-gradient(90deg, var(--pim-mercan), var(--turuncu))"
              }}/>

              <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 16}}>
                <div>
                  <div className="tiny muted">TOPLAM</div>
                  <div style={{fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1}} key={Math.round(total)}
                    className="count-pulse">{fmt(total)} <span style={{fontSize: 22, fontWeight: 600, color: "var(--gri-700)"}}>TL</span></div>
                  <div className="small muted" style={{marginTop: 6}}>Birim fiyat <strong style={{color: "var(--lacivert)"}}>{fmtUnit(unit)} TL/adet</strong> · KDV dahil</div>
                </div>
                <div style={{textAlign: "right"}}>
                  <div className="pill pill-yesil" style={{marginBottom: 6}}>%{Math.round((1 - tierDiscount) * 100)} adet indirimi</div>
                </div>
              </div>

              {upsell && (
                <button onClick={() => setQty(upsell.to)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "12px 14px", borderRadius: 10,
                    background: "var(--sari-soft)",
                    border: "1px dashed #E0B158",
                    color: "#7A560A",
                    fontWeight: 600, fontSize: 14,
                    textAlign: "left",
                    marginBottom: 12,
                  }}>
                  <span style={{fontSize: 18}}>💡</span>
                  <span style={{flex: 1}}>{upsell.msg}</span>
                  <ArrowR size={14}/>
                </button>
              )}

              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", background: "var(--gri-50)",
                borderRadius: 10, marginBottom: 16,
              }}>
                <Calendar size={16}/>
                <div className="small">Tahmini teslim: <strong>{teslim}</strong></div>
              </div>

              <button className="btn btn-primary btn-lg btn-block">
                Sepete ekle <ArrowR/>
              </button>
              <div className="small dim" style={{textAlign: "center", marginTop: 10}}>
                Şimdi öderken dosya yüklemen gerekmez · 3 gün içinde yükleyebilirsin
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Step = ({ n, title, hint, children }) => (
  <div className="card" style={{padding: 20}}>
    <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 14}}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "var(--lacivert)", color: "white",
        display: "grid", placeItems: "center",
        fontWeight: 700, fontSize: 13,
      }}>{n}</div>
      <div style={{flex: 1}}>
        <div style={{fontWeight: 600, fontSize: 16}}>{title}</div>
        <div className="small muted">{hint}</div>
      </div>
    </div>
    {children}
  </div>
);

const SelectableCard = ({ selected, onClick, children, compact }) => (
  <button onClick={onClick} className={`selectable ${selected ? "is-selected" : ""}`}
    style={{padding: compact ? 12 : 14, textAlign: "left"}}>
    {children}
    <div className="tick"><window.Icon.Check size={11}/></div>
  </button>
);

const WindingIcon = ({ n }) => {
  // 1-4 dışa sarım (strip comes off front of roll)
  // 5-8 içe sarım (strip comes off back of roll)
  // R rotation: 1/5: 0°, 2/6: 180°, 3/7: 90° (R lies right), 4/8: -90° (R lies left)
  const rotMap = { 1: 0, 2: 180, 3: 90, 4: -90, 5: 0, 6: 180, 7: 90, 8: -90 };
  const isInner = n >= 5;
  const rot = rotMap[n];

  // SVG: 100 wide, 130 tall. Roll at top, strip coming down with 4 labels.
  const stripX = 28;       // strip left edge
  const stripW = 44;       // strip width
  const labelH = 22;       // each label cell height
  const stripTop = 30;     // strip starts at y
  const cells = 4;

  // Roll geometry
  const rollCx = 50;
  const rollCy = 22;
  const rollRx = 32;
  const rollRy = 8;

  return (
    <svg width="80" height="120" viewBox="0 0 100 140" style={{margin: "0 auto", display: "block"}}>
      <defs>
        <linearGradient id={`roll-grad-${n}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="100%" stopColor="#E7E5DD"/>
        </linearGradient>
      </defs>

      {/* For içe sarım, strip is drawn first (behind roll) */}
      {isInner && (
        <g>
          {/* strip extending up behind roll */}
          <rect x={stripX} y={rollCy} width={stripW} height={stripTop + cells * labelH - rollCy + 4}
            fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.4"/>
        </g>
      )}

      {/* Roll */}
      <g>
        {/* back side (top ellipse) */}
        <ellipse cx={rollCx} cy={rollCy - 7} rx={rollRx} ry={rollRy} fill={`url(#roll-grad-${n})`} stroke="#1F2937" strokeWidth="1.4"/>
        {/* sides */}
        <rect x={rollCx - rollRx} y={rollCy - 7} width={rollRx * 2} height="9" fill={`url(#roll-grad-${n})`}/>
        <line x1={rollCx - rollRx} y1={rollCy - 7} x2={rollCx - rollRx} y2={rollCy + 2} stroke="#1F2937" strokeWidth="1.4"/>
        <line x1={rollCx + rollRx} y1={rollCy - 7} x2={rollCx + rollRx} y2={rollCy + 2} stroke="#1F2937" strokeWidth="1.4"/>
        {/* front face (bottom ellipse) */}
        <ellipse cx={rollCx} cy={rollCy + 2} rx={rollRx} ry={rollRy} fill={`url(#roll-grad-${n})`} stroke="#1F2937" strokeWidth="1.4"/>
        {/* core hole */}
        <ellipse cx={rollCx} cy={rollCy + 2} rx="8" ry="2" fill="#1F2937" opacity="0.6"/>
      </g>

      {/* Strip — for dışa, drawn AFTER roll so it sits in front */}
      {!isInner && (
        <g>
          {/* curve coming off front of roll */}
          <path
            d={`M ${stripX} ${rollCy + 2} Q ${stripX} ${stripTop - 4} ${stripX} ${stripTop} L ${stripX + stripW} ${stripTop} Q ${stripX + stripW} ${stripTop - 4} ${stripX + stripW} ${rollCy + 2}`}
            fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.4"/>
          <rect x={stripX} y={stripTop} width={stripW} height={cells * labelH}
            fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.4"/>
        </g>
      )}

      {/* Label cells — divider lines */}
      {[1, 2, 3].map(i => (
        <line key={i}
          x1={stripX} y1={stripTop + i * labelH}
          x2={stripX + stripW} y2={stripTop + i * labelH}
          stroke="#1F2937" strokeWidth="0.8" opacity="0.4"/>
      ))}

      {/* R letters in each cell */}
      {[0, 1, 2, 3].map(i => {
        const cx = stripX + stripW / 2;
        const cy = stripTop + i * labelH + labelH / 2;
        return (
          <g key={i} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
            <text x="0" y="6"
              textAnchor="middle"
              fontFamily="Nunito, sans-serif"
              fontWeight="800"
              fontSize="17"
              fill="#1F2937">R</text>
          </g>
        );
      })}
    </svg>
  );
};

// ----- 3D-ish preview canvas -----
const PreviewCanvas = ({ material, coating, custom, yaldiz, winding, width, height }) => {
  const matBg = {
    kraft: "linear-gradient(180deg, #D9B889 0%, #C9A472 100%)",
    beyaz: "linear-gradient(180deg, #FCFCF8 0%, #F0EFE8 100%)",
    ultra: "linear-gradient(180deg, rgba(220,240,250,0.6) 0%, rgba(255,255,255,0.4) 100%)",
    metalik: "linear-gradient(180deg, #E5E9EE 0%, #B7BFC9 50%, #DDE2E8 100%)",
  }[material];

  const sheen = {
    mat: 0.04,
    parlak: 0.32,
    soft: 0.06,
    yok: 0.16,
  }[coating];

  const yaldizMap = {
    altin: "linear-gradient(135deg,#FFE08A 0%, #C99A3D 100%)",
    gulkurusu: "linear-gradient(135deg,#FFD3CB 0%, #C97862 100%)",
    gumus: "linear-gradient(135deg,#E5E9EE 0%, #9BA4AD 100%)",
    bakir: "linear-gradient(135deg,#F0B17A 0%, #A65A2C 100%)",
    siyahkrom: "linear-gradient(135deg,#4A4F55 0%, #11141A 100%)",
    yesil: "linear-gradient(135deg,#D6F0D0 0%, #2F6B2F 100%)",
    lacivert: "linear-gradient(135deg,#7B92C6 0%, #1F2A4D 100%)",
    holo: "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)",
  }[yaldiz];

  return (
    <div style={{
      position: "relative",
      borderRadius: 24,
      background: "linear-gradient(180deg, var(--krem) 0%, #EFE3CB 100%)",
      padding: 48,
      minHeight: 540,
      overflow: "hidden",
      boxShadow: "var(--sh-1)",
      border: "1px solid var(--gri-200)",
    }}>
      {/* radial highlight */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(60% 50% at 70% 20%, rgba(255,255,255,0.6) 0%, transparent 70%)",
        pointerEvents: "none",
      }}/>

      {/* the rulo */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        perspective: "1200px",
      }}>
        <div style={{
          position: "relative",
          width: 360, height: 200,
          transformStyle: "preserve-3d",
          transform: "rotateX(12deg)",
        }}>
          {/* roll body */}
          <div style={{
            position: "absolute", inset: 0,
            background: matBg,
            borderRadius: "180px / 100px",
            boxShadow: "0 30px 60px rgba(31,41,55,0.18), 0 6px 12px rgba(31,41,55,0.1)",
          }}/>
          {/* sheen overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(80% 40% at 50% 0%, rgba(255,255,255,${sheen + 0.3}) 0%, transparent 60%)`,
            borderRadius: "180px / 100px",
            mixBlendMode: "screen",
          }}/>
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(180deg, rgba(255,255,255,${sheen}) 0%, transparent 30%, transparent 70%, rgba(31,41,55,0.18) 100%)`,
            borderRadius: "180px / 100px",
          }}/>
          {/* core hole */}
          <div style={{
            position: "absolute", left: 0, right: 0, top: 50,
            height: 80,
            display: "flex", justifyContent: "space-between",
          }}>
            <div style={{width: 60, height: 80, background: "radial-gradient(ellipse, #1F2937 0%, #4B5563 100%)", borderRadius: "50%", marginLeft: -10}}/>
            <div style={{width: 60, height: 80, background: "radial-gradient(ellipse, #1F2937 0%, #4B5563 100%)", borderRadius: "50%", marginRight: -10}}/>
          </div>

          {/* sample label on the roll */}
          <div style={{
            position: "absolute",
            left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: width * 1.4,
            height: height * 1.4,
            background: material === "ultra" ? "rgba(255,255,255,0.5)" :
                       material === "metalik" ? "linear-gradient(135deg,#E5E9EE,#FFFFFF,#C7CFD8)" :
                       material === "kraft" ? "#E8C99B" : "white",
            borderRadius: 6,
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            border: material === "ultra" ? "1px dashed rgba(31,41,55,0.4)" : "none",
          }}>
            <div style={{textAlign: "center", padding: 4}}>
              <div style={{
                fontWeight: 800,
                fontSize: Math.min(width, height) * 0.22,
                background: custom === "yaldiz" ? yaldizMap : "transparent",
                color: custom === "yaldiz" ? "transparent" : (material === "metalik" ? "#1F2937" : "#1F2937"),
                WebkitBackgroundClip: custom === "yaldiz" ? "text" : "initial",
                backgroundClip: custom === "yaldiz" ? "text" : "initial",
                letterSpacing: "0.05em",
                textShadow: custom === "emboss" ? "0 1px 0 rgba(255,255,255,0.6), 0 -1px 0 rgba(0,0,0,0.15)" : "none",
                filter: custom === "spotuv" ? "contrast(1.2)" : "none",
              }}>OLEA</div>
              <div style={{fontSize: 9, color: "#FF6B5B", fontWeight: 600, marginTop: 2, letterSpacing: "0.1em"}}>DOĞAL SABUN</div>
              <div style={{height: 1, background: "rgba(31,41,55,0.2)", margin: "6px 12px"}}/>
              <div style={{fontSize: 7, color: "#4B5563"}}>100ml</div>
            </div>
          </div>
        </div>
      </div>

      {/* dimension overlay */}
      <div style={{
        position: "absolute", bottom: 24, left: 24,
        padding: "8px 12px",
        background: "white",
        borderRadius: 10,
        boxShadow: "var(--sh-1)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div className="small">
          <div className="tiny muted">ÖLÇÜ</div>
          <div style={{fontWeight: 600}}>{width} × {height} mm</div>
        </div>
      </div>

      <div style={{
        position: "absolute", top: 24, left: 24,
        padding: "6px 12px",
        background: "white",
        borderRadius: 999,
        boxShadow: "var(--sh-1)",
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 12, fontWeight: 600,
      }}>
        <div style={{width: 8, height: 8, borderRadius: "50%", background: "var(--yesil)"}}/>
        Canlı önizleme
      </div>

      {/* Pim chat trigger */}
      <div style={{position: "absolute", bottom: 24, right: 24}}>
        <div style={{
          background: "white", borderRadius: 16, padding: 12,
          boxShadow: "var(--sh-2)", display: "flex", gap: 10, alignItems: "center", maxWidth: 220,
        }}>
          <window.PimMini pose="think" size={36}/>
          <div className="small" style={{fontWeight: 500}}>
            <strong>Pim:</strong> Kozmetik için ultra clear de güzel olur, denedin mi?
          </div>
        </div>
      </div>
    </div>
  );
};

window.Etiket = Etiket;
