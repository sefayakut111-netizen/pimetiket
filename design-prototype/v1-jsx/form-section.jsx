/* Pim Etiket — FormSection
   Konfigürasyon adımı sarıcısı. number prop'u verilirse numaralı rozet
   gösterir (etiket akışı), verilmezse numarasız sade başlık gösterir
   (sticker akışı). Önceden ayrı tanımlı olan Step ve Section
   component'larını birleştirir.
*/

const FormSection = ({ number, title, hint, children }) => (
  <div className="card" style={{padding: 20}}>
    <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 14}}>
      {number != null && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--lacivert)", color: "white",
          display: "grid", placeItems: "center",
          fontWeight: 700, fontSize: 13,
          flexShrink: 0,
        }}>{number}</div>
      )}
      <div style={{flex: 1}}>
        <div style={{fontWeight: 600, fontSize: number != null ? 16 : 15}}>{title}</div>
        {hint && <div className="small muted" style={{marginTop: 2}}>{hint}</div>}
      </div>
    </div>
    {children}
  </div>
);

window.FormSection = FormSection;
