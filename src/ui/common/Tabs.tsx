export type TabDef<T extends string> = { id: T; label: string; disabled?: boolean };

export function Tabs<T extends string>({
  tabs, value, onChange,
}: { tabs: TabDef<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={t.id === value ? 'active' : ''}
          disabled={t.disabled}
          onClick={() => !t.disabled && onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
