/* Pim Etiket — App shell + top nav + page router */

const App = () => {
  const [page, setPage] = React.useState(() => location.hash.replace("#", "") || "home");

  React.useEffect(() => {
    location.hash = page;
    window.scrollTo({top: 0, behavior: "instant"});
  }, [page]);

  React.useEffect(() => {
    const onHash = () => setPage(location.hash.replace("#", "") || "home");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (p) => setPage(p);
  const { Search, Cart, User } = window.Icon;

  return (
    <div>
      {/* Top bar */}
      <div className="topbar">
        <div className="container topbar-inner">
          <button onClick={() => go("home")} className="wordmark">
            <span className="wordmark-dot"/>
            Pim Etiket
          </button>
          <div className="nav-links" style={{flex: 1}}>
            <button className={`nav-link ${page === "home" ? "active" : ""}`} onClick={() => go("home")}>Anasayfa</button>
            <button className={`nav-link ${page === "etiket" ? "active" : ""}`} onClick={() => go("etiket")}>Etiket</button>
            <button className={`nav-link ${page === "sticker" ? "active" : ""}`} onClick={() => go("sticker")}>Sticker</button>
            <button className={`nav-link ${page === "dashboard" ? "active" : ""}`} onClick={() => go("dashboard")}>Panelim</button>
            <button className="nav-link">Hakkımızda</button>
          </div>
          <div style={{display: "flex", gap: 4, alignItems: "center"}}>
            <button className="nav-link" style={{padding: 10}}><Search size={18}/></button>
            <button className="nav-link" style={{padding: 10, position: "relative"}}>
              <Cart size={18}/>
              <span style={{
                position: "absolute", top: 4, right: 4,
                width: 16, height: 16, borderRadius: "50%",
                background: "var(--pim-mercan)", color: "white",
                fontSize: 10, fontWeight: 700,
                display: "grid", placeItems: "center",
              }}>2</span>
            </button>
            <button className="btn btn-sm btn-secondary" style={{marginLeft: 6}}>
              <User size={14}/> Ahmet
            </button>
          </div>
        </div>
      </div>

      {/* Pages */}
      {page === "home" && <window.Home go={go}/>}
      {page === "etiket" && <window.Etiket go={go}/>}
      {page === "sticker" && <window.Sticker go={go}/>}
      {page === "dashboard" && <window.Dashboard go={go}/>}

      {/* Footer (only on home) */}
      {page === "home" && (
        <footer className="footer">
          <div className="container">
            <div style={{display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 32, marginBottom: 48}}>
              <div>
                <div className="wordmark" style={{color: "white", marginBottom: 16}}>
                  <span className="wordmark-dot"/>
                  Pim Etiket
                </div>
                <p className="small" style={{maxWidth: 280, color: "rgba(255,255,255,0.65)", lineHeight: 1.6}}>
                  Türkiye'nin akıllı dijital baskı atölyesi. Bursa'dan, küçük markalar için.
                </p>
              </div>
              {[
                { t: "Ürün", links: ["Etiket", "Sticker", "Malzemeler", "Yaldız galerisi"] },
                { t: "Şirket", links: ["Hakkımızda", "Üretim ortakları", "Kariyer", "Basın"] },
                { t: "Destek", links: ["SSS", "Kargo", "İade", "Sözleşmeler"] },
                { t: "İletişim", links: ["WhatsApp", "Mail", "Bursa atölyesi", "Pim'le konuş"] },
              ].map((g, i) => (
                <div key={i}>
                  <div className="tiny" style={{marginBottom: 14, color: "rgba(255,255,255,0.5)"}}>{g.t}</div>
                  <div style={{display: "flex", flexDirection: "column", gap: 10}}>
                    {g.links.map((l, j) => <a key={j} className="small" style={{color: "rgba(255,255,255,0.85)", cursor: "pointer"}}>{l}</a>)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.1)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 13, color: "rgba(255,255,255,0.55)",
            }}>
              <div>© 2026 Pim Etiket A.Ş. — Bursa</div>
              <div style={{display: "flex", gap: 20}}>
                <a style={{cursor: "pointer"}}>KVKK</a>
                <a style={{cursor: "pointer"}}>Gizlilik</a>
                <a style={{cursor: "pointer"}}>Kullanım</a>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Pim chat — every page */}
      <window.PimChat/>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
