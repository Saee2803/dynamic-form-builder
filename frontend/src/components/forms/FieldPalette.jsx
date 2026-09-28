const fieldGroups = [
  { title: 'Input', types: [['text', 'Text'], ['textarea', 'Textarea'], ['number', 'Number'], ['email', 'Email'], ['mobile', 'Mobile'], ['date', 'Date']] },
  { title: 'Choice', types: [['radio', 'Radio'], ['select', 'Select'], ['multiselect', 'Multiselect'], ['checkbox', 'Checkbox']] },
  { title: 'Content', types: [['heading', 'Heading'], ['paragraph', 'Paragraph'], ['file', 'File']] },
]

export default function FieldPalette({ onAdd }) {
  return (
    <aside className="builder-sidebar palette-sidebar" aria-label="Field palette">
      <div className="sidebar-heading">
        <p className="eyebrow">Build</p>
        <h2>Add a field</h2>
      </div>
      {fieldGroups.map((group) => (
        <section className="palette-group" key={group.title}>
          <h3>{group.title}</h3>
          <div className="palette-buttons">
            {group.types.map(([type, label], index) => (
              <button className="palette-button" key={type} onClick={() => onAdd(type)}>
                <span className={`field-glyph glyph-${index % 4}`} aria-hidden="true">{label.slice(0, 1)}</span>
                {label}
                <span className="palette-add" aria-hidden="true">＋</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  )
}