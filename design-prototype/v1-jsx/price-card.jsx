/* Pim Etiket — PriceCard
   Sepete ekle CTA + toplam fiyat kartı. İki bilinçli varyant:
   - "quiet": beyaz card + 4px gradient top stripe (etiket — profesyonel sakin)
   - "bold":  lacivert gradient + mercan accent (sticker — enerjik premium)

   Aynı API, farklı tema. Her sayfada inline yazılan price card kodu
   buraya taşındı.
*/

const PriceCard = ({
  variant = "quiet",     // "quiet" | "bold"
  topLabel,              // "TOPLAM" | "SEÇİMİN"
  total,                 // sayı
  unitPrice,             // ReactNode — strong'lu metin için JSX kabul eder
  savingsLabel,          // string | null — "%4 adet indirimi"
  upsell,                // { msg, onClick } | null — sadece quiet'ta gösterilir
  deliveryDate,          // string — "22 Mayıs 2026"
  ctaLabel,              // string — "Sepete ekle"
  onCta,                 // function | undefined
  footnote,              // string | null
}) => {
  const fmt = (n) => Math.round(n).toLocaleString("tr-TR");
  const { ArrowR, Calendar } = window.Icon;

  if (variant === "bold") {
    return (
      <div style={{
        background: "linear-gradient(135deg, var(--lacivert) 0%, #2C3849 100%)",
        color: "white",
        borderRadius: "var(--r-xl)",
        padding: 24,
        position: "relative",
        overflow: "hidden",
        marginTop: 8,
      }}>
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 140, height: 140, borderRadius: "50%",
          background: "var(--pim-mercan)", opacity: 0.15,
        }}/>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, position: "relative"}}>
          <div>
            <div className="tiny" style={{color: "rgba(255,255,255,0.6)"}}>{topLabel}</div>
            <div style={{fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4}}
              key={Math.round(total)} className="count-pulse">
              {fmt(total)} <span style={{fontSize: 18, opacity: 0.7}}>TL</span>
            </div>
            <div className="small" style={{color: "rgba(255,255,255,0.7)", marginTop: 4}}>
              {unitPrice}
            </div>
          </div>
          {savingsLabel && (
            <div className="pill" style={{
              background: "var(--pim-mercan)", color: "white",
              height: 32, padding: "0 14px", fontSize: 13,
            }}>{savingsLabel}</div>
          )}
        </div>

        <div style={{
          marginTop: 16, padding: "10px 14px",
          background: "rgba(255,255,255,0.08)", borderRadius: "var(--r-sm)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, position: "relative",
        }}>
          <Calendar size={14}/>
          Tahmini teslim: <strong>{deliveryDate}</strong>
        </div>

        <button onClick={onCta} className="btn btn-lg btn-block" style={{
          marginTop: 16,
          background: "var(--pim-mercan)", color: "white",
          position: "relative",
        }}>
          {ctaLabel} <ArrowR/>
        </button>
        {footnote && (
          <div className="small" style={{
            textAlign: "center", marginTop: 10,
            color: "rgba(255,255,255,0.6)", position: "relative",
          }}>{footnote}</div>
        )}
      </div>
    );
  }

  // quiet (default)
  return (
    <div className="card" style={{
      padding: 24, background: "white", marginTop: 8,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 4,
        background: "linear-gradient(90deg, var(--pim-mercan), var(--turuncu))",
      }}/>

      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-end", gap: 16, marginBottom: 16,
      }}>
        <div>
          <div className="tiny muted">{topLabel}</div>
          <div style={{fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1}}
            key={Math.round(total)} className="count-pulse">
            {fmt(total)} <span style={{fontSize: 22, fontWeight: 600, color: "var(--gri-700)"}}>TL</span>
          </div>
          <div className="small muted" style={{marginTop: 6}}>{unitPrice}</div>
        </div>
        {savingsLabel && (
          <div style={{textAlign: "right"}}>
            <div className="pill pill-yesil" style={{marginBottom: 6}}>{savingsLabel}</div>
          </div>
        )}
      </div>

      {upsell && (
        <button onClick={upsell.onClick}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "12px 14px", borderRadius: "var(--r-sm)",
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
        borderRadius: "var(--r-sm)", marginBottom: 16,
      }}>
        <Calendar size={16}/>
        <div className="small">Tahmini teslim: <strong>{deliveryDate}</strong></div>
      </div>

      <button onClick={onCta} className="btn btn-primary btn-lg btn-block">
        {ctaLabel} <ArrowR/>
      </button>
      {footnote && <div className="small dim" style={{textAlign: "center", marginTop: 10}}>{footnote}</div>}
    </div>
  );
};

window.PriceCard = PriceCard;
