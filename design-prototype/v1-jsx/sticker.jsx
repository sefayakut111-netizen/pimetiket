/* Pim Etiket — Sticker Konfigürasyon Sayfası
   Same architecture as Etiket but: 6 tier cards instead of slider,
   more energetic palette, festival-y feel.
*/

const Sticker = ({ go }) => {
  const { ChevR, Info, ArrowR, Calendar, Check, Sparkle } = window.Icon;
  const { FormSection, SelectableCard, PriceCard } = window;

  const [shape, setShape] = React.useState("circle");
  const [material, setMaterial] = React.useState("vinil");
  const [finish, setFinish] = React.useState("parlak");
  const [tier, setTier] = React.useState(250);
  const [size, setSize] = React.useState(75);

  const shapes = [
    { id: "circle", name: "Yuvarlak" },
    { id: "square", name: "Kare" },
    { id: "rounded", name: "Yumuşak köşe" },
    { id: "die", name: "Kontur kesim" },
  ];
  const materials = [
    { id: "vinil", name: "Vinil", desc: "Su ve UV dayanımı", swatch: "#FFFFFF" },
    { id: "transparan", name: "Transparan", desc: "Şeffaf zemin", swatch: "linear-gradient(135deg,#E0F2FE,#FFFFFF)" },
    { id: "holo", name: "Holografik", desc: "Festival için", swatch: "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 50%, #FFE8B7 100%)" },
    { id: "kraft", name: "Kraft", desc: "Doğal, mat", swatch: "#C9A47A" },
  ];
  const finishes = [
    { id: "parlak", name: "Parlak", desc: "Canlı renkler" },
    { id: "mat", name: "Mat", desc: "Yansımasız" },
    { id: "glitter", name: "Simli", desc: "Parıltı katmanı" },
  ];

  const tiers = [50, 100, 250, 500, 1000, 2500];
  const tierBase = (q) => {
    // unit drops as q rises
    const u = q <= 50 ? 7.0 : q <= 100 ? 5.5 : q <= 250 ? 4.2 : q <= 500 ? 3.5 : q <= 1000 ? 2.9 : 2.4;
    const matMult = { vinil: 1, transparan: 1.1, holo: 1.4, kraft: 0.95 }[material];
    const finMult = { parlak: 1, mat: 1.05, glitter: 1.25 }[finish];
    const sizeMult = (size / 75) ** 1.4;
    return u * matMult * finMult * sizeMult;
  };
  const baseUnit = tierBase(50);
  const currentUnit = tierBase(tier);
  const total = currentUnit * tier;
  const savings = Math.round((1 - currentUnit / baseUnit) * 100);

  const fmt = (n) => Math.round(n).toLocaleString("tr-TR");
  const fmtUnit = (n) => n.toFixed(2).replace(".", ",");

  return (
    <div className="fade-up" style={{
      background: "linear-gradient(180deg, #FFF6F2 0%, #FFFFFF 30%, #FFFFFF 100%)",
      minHeight: "calc(100vh - 64px)"
    }}>
      {/* breadcrumb */}
      <div style={{borderBottom: "1px solid var(--gri-200)", background: "rgba(255,255,255,0.8)"}}>
        <div className="container" style={{padding: "16px 32px", display: "flex", alignItems: "center", gap: 8, fontSize: 14}}>
          <button className="btn-ghost small" onClick={() => go("home")} style={{padding: "4px 8px", borderRadius: 6}}>Anasayfa</button>
          <ChevR size={14}/>
          <span style={{fontWeight: 600}}>Sticker konfigüre et</span>
        </div>
      </div>

      <div className="container" style={{padding: "32px 32px 80px"}}>
        <div style={{display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 28}}>
          <div style={{flex: 1}}>
            <div className="pill" style={{background: "var(--turuncu)", color: "white", marginBottom: 10}}>
              <Sparkle size={12}/> 25 adetten başlar
            </div>
            <h1 className="h1" style={{margin: 0}}>Sticker'ını konfigüre et</h1>
            <p className="body muted" style={{marginTop: 8, maxWidth: 480}}>
              Kampanya, hediye, kişisel — sticker küçük adette de tadından yenmiyor.
            </p>
          </div>
          <Pim pose="excited" size={120} bob={true}/>
        </div>

        <div style={{display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 24}}>
          {/* LEFT — preview */}
          <div style={{position: "sticky", top: 80}}>
            <StickerPreview shape={shape} material={material} finish={finish} size={size}/>
            <div className="small muted" style={{textAlign: "center", marginTop: 12}}>Anlık önizleme — her seçim canlı</div>
          </div>

          {/* RIGHT — config */}
          <div style={{display: "flex", flexDirection: "column", gap: 16}}>
            {/* Step: shape */}
            <FormSection title="Şekil">
              <div style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10}}>
                {shapes.map(s => (
                  <SelectableCard key={s.id} selected={shape === s.id} onClick={() => setShape(s.id)}
                    style={{textAlign: "center"}}>
                    <ShapeIcon id={s.id} active={shape === s.id}/>
                    <div className="tiny" style={{marginTop: 8, color: "var(--gri-700)"}}>{s.name}</div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            {/* Step: material */}
            <FormSection title="Malzeme">
              <div style={{display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10}}>
                {materials.map(m => (
                  <SelectableCard key={m.id} selected={material === m.id} onClick={() => setMaterial(m.id)}
                    padding={12}
                    style={{display: "flex", gap: 12, alignItems: "center"}}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: m.swatch.startsWith("linear") ? m.swatch : m.swatch,
                      backgroundImage: m.swatch.startsWith("linear") ? m.swatch : undefined,
                      border: "1px solid rgba(31,41,55,0.06)",
                    }}/>
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontWeight: 600, fontSize: 14}}>{m.name}</div>
                      <div className="small muted">{m.desc}</div>
                    </div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            {/* Step: finish */}
            <FormSection title="Yüzey">
              <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10}}>
                {finishes.map(f => (
                  <SelectableCard key={f.id} selected={finish === f.id} onClick={() => setFinish(f.id)}
                    padding={12}>
                    <div style={{fontWeight: 600, fontSize: 14}}>{f.name}</div>
                    <div className="small muted">{f.desc}</div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            {/* Step: size */}
            <FormSection title="Boyut">
              <div style={{display: "flex", alignItems: "center", gap: 16}}>
                {[50, 75, 100, 150].map(s => (
                  <SelectableCard key={s} selected={size === s} onClick={() => setSize(s)}
                    style={{flex: 1, textAlign: "center"}}>
                    <div style={{
                      width: s * 0.4, height: s * 0.4, maxWidth: 60, maxHeight: 60,
                      borderRadius: shape === "circle" ? "50%" : 8,
                      background: "var(--pim-mercan-tint)",
                      border: "1.5px dashed var(--pim-mercan-soft)",
                      margin: "0 auto 8px",
                    }}/>
                    <div className="small" style={{fontWeight: 600}}>{s} mm</div>
                  </SelectableCard>
                ))}
              </div>
            </FormSection>

            {/* Step: tier cards */}
            <FormSection title="Adet — kademen, fiyatın">
              <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12}}>
                {tiers.map((q, i) => {
                  const u = tierBase(q);
                  const t = u * q;
                  const sav = Math.round((1 - u / baseUnit) * 100);
                  const popular = q === 250;
                  const selected = tier === q;
                  return (
                    <button key={q} onClick={() => setTier(q)}
                      style={{
                        position: "relative",
                        padding: "20px 16px",
                        borderRadius: "var(--r-md)",
                        background: selected ? "var(--krem)" : "white",
                        border: selected ? "2px solid var(--pim-mercan)" : "2px solid var(--gri-200)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "transform 120ms, border 120ms, background 200ms",
                        transform: selected ? "translateY(-2px)" : "none",
                        boxShadow: selected ? "var(--sh-mercan-lg)" : "none",
                      }}>
                      {popular && !selected && (
                        <div className="pill pill-lacivert" style={{position: "absolute", top: -10, left: 16, height: 22, fontSize: 11}}>
                          Popüler
                        </div>
                      )}
                      {selected && (
                        <div className="pill" style={{position: "absolute", top: -10, left: 16, height: 22, fontSize: 11, background: "var(--pim-mercan)", color: "white"}}>
                          <Check size={10}/> Seçildi
                        </div>
                      )}
                      <div className="tiny muted">ADET</div>
                      <div style={{fontWeight: 700, fontSize: 28, lineHeight: 1}}>{q}</div>
                      <div style={{fontWeight: 700, fontSize: 22, marginTop: 14, color: "var(--lacivert)"}}>{fmt(t)} TL</div>
                      <div className="small muted" style={{marginTop: 2}}>{fmtUnit(u)} TL/adet</div>
                      {sav > 0 && (
                        <div className="pill pill-yesil" style={{marginTop: 10, fontSize: 11, height: 22}}>
                          %{sav} tasarruf 🎯
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </FormSection>

            {/* Final price card + cta */}
            <PriceCard
              variant="bold"
              topLabel="SEÇİMİN"
              total={total}
              unitPrice={`${tier} adet × ${fmtUnit(currentUnit)} TL · KDV dahil`}
              savingsLabel={savings > 0 ? `%${savings} tasarruf` : null}
              deliveryDate="22 Mayıs 2026"
              ctaLabel="Sepete ekle"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ShapeIcon = ({ id, active }) => {
  const c = active ? "#FF6B5B" : "#1F2937";
  if (id === "circle") return <svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill={`${c}22`} stroke={c} strokeWidth="2"/></svg>;
  if (id === "square") return <svg width="36" height="36" viewBox="0 0 36 36"><rect x="4" y="4" width="28" height="28" fill={`${c}22`} stroke={c} strokeWidth="2"/></svg>;
  if (id === "rounded") return <svg width="36" height="36" viewBox="0 0 36 36"><rect x="4" y="4" width="28" height="28" rx="8" fill={`${c}22`} stroke={c} strokeWidth="2"/></svg>;
  return <svg width="36" height="36" viewBox="0 0 36 36"><path d="M18 4 Q26 4 28 12 Q34 14 32 22 Q34 30 24 30 Q18 34 12 30 Q4 30 6 22 Q2 14 8 12 Q10 4 18 4 Z" fill={`${c}22`} stroke={c} strokeWidth="2" strokeDasharray="3 2"/></svg>;
};

const StickerPreview = ({ shape, material, finish, size }) => {
  const matBg = {
    vinil: "white",
    transparan: "rgba(255,255,255,0.5)",
    holo: "linear-gradient(135deg,#FFB7E5 0%, #B7E8FF 35%, #FFE8B7 65%, #B7FFD9 100%)",
    kraft: "#D9B889",
  }[material];
  const finishOverlay = {
    parlak: "radial-gradient(80% 60% at 30% 20%, rgba(255,255,255,0.7) 0%, transparent 60%)",
    mat: "transparent",
    glitter: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1.5px)",
  }[finish];
  const radius = shape === "circle" ? "50%" : shape === "rounded" ? 24 : shape === "die" ? 0 : 4;
  const dieClip = shape === "die" ? "polygon(20% 0, 80% 5%, 100% 30%, 95% 75%, 70% 100%, 25% 95%, 0 65%, 5% 25%)" : "none";

  const px = size * 2.4;

  return (
    <div style={{
      position: "relative",
      borderRadius: "var(--r-xl)",
      background: "linear-gradient(135deg, #FFF1EE 0%, #FFD9D2 100%)",
      padding: 32,
      minHeight: 540,
      overflow: "hidden",
      boxShadow: "var(--sh-1)",
    }}>
      {/* dot pattern */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(31,41,55,0.06) 1px, transparent 1.5px)",
        backgroundSize: "20px 20px",
      }}/>
      <div className="pill" style={{position: "absolute", top: 20, left: 20, background: "white", boxShadow: "var(--sh-1)"}}>
        <div style={{width: 8, height: 8, borderRadius: "50%", background: "var(--yesil)"}}/>
        <span>Canlı</span>
      </div>

      {/* sticker */}
      <div style={{position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-6deg)"}}>
        <div style={{
          position: "relative",
          width: px, height: px,
          background: matBg,
          borderRadius: radius,
          clipPath: dieClip,
          boxShadow: "0 16px 40px rgba(31,41,55,0.18), 0 4px 8px rgba(31,41,55,0.1)",
          padding: 4,
          display: "grid", placeItems: "center",
        }}>
          {/* white border (sticker margin) */}
          <div style={{
            width: "94%", height: "94%",
            borderRadius: shape === "circle" ? "50%" : shape === "rounded" ? 20 : 0,
            background: material === "transparan" ? "transparent" : (material === "holo" ? "rgba(255,255,255,0.2)" : "transparent"),
            display: "grid", placeItems: "center",
            border: material === "transparan" ? "2px dashed rgba(31,41,55,0.3)" : "none",
          }}>
            <div style={{textAlign: "center"}}>
              <div style={{
                fontSize: px * 0.16,
                fontWeight: 800,
                color: "#FF6B5B",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}>PİM</div>
              <div style={{fontSize: px * 0.07, fontWeight: 700, color: "#1F2937", marginTop: 8, letterSpacing: "0.15em"}}>2026</div>
            </div>
          </div>
          {/* finish overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: finishOverlay,
            backgroundSize: finish === "glitter" ? "8px 8px" : "auto",
            borderRadius: radius,
            clipPath: dieClip,
            mixBlendMode: "screen",
            pointerEvents: "none",
            opacity: finish === "mat" ? 0 : 1,
          }}/>
        </div>
      </div>

      {/* size badge */}
      <div style={{
        position: "absolute", bottom: 20, left: 20,
        padding: "8px 12px", background: "white", borderRadius: "var(--r-sm)",
        boxShadow: "var(--sh-1)",
      }}>
        <div className="tiny muted">BOYUT</div>
        <div style={{fontWeight: 600, fontSize: 14}}>{size} × {size} mm</div>
      </div>

      <div style={{position: "absolute", bottom: 20, right: 20}}>
        <div style={{
          background: "white", borderRadius: "var(--r-md)", padding: 10,
          boxShadow: "var(--sh-2)", display: "flex", gap: 8, alignItems: "center", maxWidth: 200,
        }}>
          <window.PimMini pose="happy" size={32}/>
          <div className="small" style={{fontWeight: 500, fontSize: 12}}>
            <strong>Pim:</strong> Holografik festivale gider 🎉
          </div>
        </div>
      </div>
    </div>
  );
};

window.Sticker = Sticker;
