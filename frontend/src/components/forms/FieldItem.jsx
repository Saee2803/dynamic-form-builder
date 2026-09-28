export default function FieldItem({ field, index, count, selected, onSelect, onMove, onDelete }) {
  return (
    <article className={`field-item ${selected ? 'field-item-selected' : ''}`}>
      <button className="field-item-main" onClick={onSelect} aria-pressed={selected}>
        <span className="drag-grip" aria-hidden="true">⠿</span>
        <span className="field-item-copy">
          <span className="field-item-label">{field.label || 'Untitled field'}</span>
          <span className="field-item-meta">{field.type} <span>·</span> {field.name || 'unnamed'}{field.required ? <b>Required</b> : null}</span>
        </span>
      </button>
      <div className="field-item-actions">
        <button className="icon-button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${field.label} up`} title="Move up">↑</button>
        <button className="icon-button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${field.label} down`} title="Move down">↓</button>
        <button className="icon-button icon-danger" onClick={onDelete} aria-label={`Delete ${field.label}`} title="Delete field">×</button>
      </div>
    </article>
  )
}