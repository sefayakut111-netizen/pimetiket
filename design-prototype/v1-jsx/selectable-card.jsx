/* Pim Etiket — SelectableCard
   Material / coating / shape gibi seçim kartları için ortak component.
   .selectable CSS class'ını kullanır (design.css'te tanımlı).
   Padding ve style prop'u ile esneklik sağlar (sticker'daki şekil/boyut
   kartları gibi center-aligned veya flex-row düzenler için).
*/

const SelectableCard = ({ selected, onClick, children, padding = 14, style = {} }) => (
  <button onClick={onClick}
    className={`selectable ${selected ? "is-selected" : ""}`}
    style={{padding, textAlign: "left", ...style}}>
    {children}
    <div className="tick"><window.Icon.Check size={11}/></div>
  </button>
);

window.SelectableCard = SelectableCard;
