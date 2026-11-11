import type { TabId } from '../types'

const TABS: { id: TabId; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'system', label: '系統' },
  { id: 'sync', label: '更新' },
]

type Props = {
  active: TabId
  onChange: (tab: TabId) => void
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="主要導覽">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? 'nav-item is-active' : 'nav-item'}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
