const GRID: (string | null)[][] = [
  ['top_left', 'top_center', 'top_right'],
  ['left', 'center', 'right'],
  ['bottom_left', 'bottom_center', 'bottom_right'],
];

export function AnchorPicker({ value, placement, onChange }: { value: string; placement: string; onChange: (v: string) => void }) {
  return (
    <div className="anchor-picker" role="radiogroup" aria-label="Label anchor">
      <div className={`anchor-box ${placement}`}>
        {GRID.flat().map((a) =>
          a ? (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={value === a}
              className={`anchor-cell ${value === a ? 'active' : ''}`}
              onClick={() => onChange(a)}
              title={a.replace('_', ' ')}
              aria-label={a}
            >
              <span />
            </button>
          ) : (
            <span key="blank" />
          ),
        )}
      </div>
      <div className="anchor-name mono">{value.replace('_', ' ')}</div>
    </div>
  );
}
