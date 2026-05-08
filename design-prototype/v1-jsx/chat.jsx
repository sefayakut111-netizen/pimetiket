/* Pim Etiket — Chatbot widget (sağ alt köşe, her sayfada) */

const PimChat = () => {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [msgs, setMsgs] = React.useState([
    { from: "pim", t: "Merhaba! Ben Pim, Etiket Profesörü. Sana nasıl yardımcı olabilirim?", pose: "wave" },
  ]);

  const send = (text) => {
    if (!text.trim()) return;
    const u = { from: "user", t: text };
    setMsgs(m => [...m, u]);
    setInput("");
    setTimeout(() => {
      const reply = guess(text);
      setMsgs(m => [...m, reply]);
    }, 600);
  };
  const guess = (q) => {
    const lower = q.toLowerCase();
    if (lower.includes("kozmet") || lower.includes("sabun"))
      return { from: "pim", pose: "think", t: "Kozmetik için ben kraft + mat selefon öneririm — doğal ve premium duruyor. Sıcak yaldızla logoyu ön plana çıkarabilirsin." };
    if (lower.includes("fiyat") || lower.includes("ne kadar"))
      return { from: "pim", pose: "happy", t: "1000 etiket için 60×80mm, kraft + mat selefon kombinasyonu yaklaşık 2.150 TL tutuyor. Konfigüratörden anlık görebilirsin." };
    if (lower.includes("sipariş") || lower.includes("durum"))
      return { from: "pim", pose: "inspect", t: "Sipariş PE-2026-1182 şu an provayı bekliyor — 3 gün içinde onaylaman gerekiyor. Detayını dashboard'da görebilirsin." };
    return { from: "pim", pose: "chat", t: "Anladım. Daha detay vermek için bir konfigürasyon başlatalım mı?" };
  };

  const quick = ["Kozmetik etiketi öner", "Fiyat hesapla", "Sipariş durumum"];

  return (
    <>
      {/* trigger */}
      {!open && (
        <button onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 100,
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--pim-mercan)",
            boxShadow: "0 8px 24px rgba(255,107,91,0.4), 0 2px 6px rgba(31,41,55,0.15)",
            display: "grid", placeItems: "center",
            cursor: "pointer",
            overflow: "hidden",
          }}>
          <div style={{transform: "translateY(8px) scale(1.5)"}}>
            <Pim pose="wave" size={56} bob={false}/>
          </div>
        </button>
      )}

      {/* panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          width: 380, maxWidth: "calc(100vw - 32px)",
          height: 540, maxHeight: "calc(100vh - 48px)",
          background: "white", borderRadius: 20,
          boxShadow: "0 24px 60px rgba(31,41,55,0.25), 0 4px 12px rgba(31,41,55,0.1)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "fadeUp 240ms ease-out",
        }}>
          {/* header */}
          <div style={{
            padding: "14px 16px",
            background: "var(--lacivert)",
            color: "white",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <window.PimMini pose="happy" size={36}/>
            <div style={{flex: 1}}>
              <div style={{fontWeight: 700, fontSize: 14}}>Pim</div>
              <div style={{fontSize: 11, opacity: 0.7, display: "flex", alignItems: "center", gap: 6}}>
                <div style={{width: 6, height: 6, borderRadius: "50%", background: "var(--yesil)"}}/>
                Etiket Profesörü · çevrimiçi
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              width: 32, height: 32, borderRadius: 8,
              color: "white", display: "grid", placeItems: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
            </button>
          </div>

          {/* messages */}
          <div style={{flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, background: "var(--gri-50)"}}>
            {msgs.map((m, i) => m.from === "user" ? (
              <div key={i} style={{alignSelf: "flex-end", maxWidth: "78%"}}>
                <div style={{
                  background: "var(--lacivert)", color: "white",
                  padding: "10px 14px", borderRadius: "16px 16px 4px 16px",
                  fontSize: 14, fontWeight: 500,
                }}>{m.t}</div>
              </div>
            ) : (
              <div key={i} style={{display: "flex", gap: 8, alignItems: "flex-end", maxWidth: "85%"}}>
                <window.PimMini pose={m.pose || "chat"} size={28}/>
                <div style={{
                  background: "white",
                  padding: "10px 14px", borderRadius: "16px 16px 16px 4px",
                  fontSize: 14, fontWeight: 500,
                  boxShadow: "var(--sh-1)",
                }}>{m.t}</div>
              </div>
            ))}

            {msgs.length === 1 && (
              <div style={{marginTop: 8, display: "flex", flexDirection: "column", gap: 6}}>
                <div className="tiny muted" style={{paddingLeft: 4}}>HIZLI BAŞLANGIÇ</div>
                {quick.map((q, i) => (
                  <button key={i} onClick={() => send(q)} style={{
                    padding: "10px 14px",
                    background: "white",
                    border: "1px solid var(--gri-200)",
                    borderRadius: 10,
                    textAlign: "left",
                    fontSize: 13, fontWeight: 500,
                    cursor: "pointer",
                  }}>{q}</button>
                ))}
              </div>
            )}
          </div>

          {/* input */}
          <div style={{padding: 12, borderTop: "1px solid var(--gri-200)", background: "white", display: "flex", gap: 8}}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send(input)}
              placeholder="Pim'e yaz…"
              style={{
                flex: 1, height: 40, padding: "0 14px",
                borderRadius: 999, border: "1px solid var(--gri-200)",
                fontSize: 14, fontWeight: 500,
                outline: "none",
              }}
              onFocus={e => e.target.style.borderColor = "var(--pim-mercan)"}
              onBlur={e => e.target.style.borderColor = "var(--gri-200)"}/>
            <button onClick={() => send(input)} style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "var(--pim-mercan)", color: "white",
              display: "grid", placeItems: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

window.PimChat = PimChat;
