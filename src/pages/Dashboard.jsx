import { useState } from 'react'
import Portfolio from '../components/Portfolio'
import FaturamentoDashboard from '../components/FaturamentoDashboard'

const MESES_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const hoje = new Date()

const TABS = [
  { key: 'portfolio', label: 'Portfólio' },
  { key: 'faturamento', label: 'Faturamento' },
]

export default function Dashboard({ session, onLogout }) {
  const [tab, setTab] = useState('portfolio')
  const [periodo, setPeriodo] = useState({
    mes: hoje.getMonth() + 1,
    ano: hoje.getFullYear(),
  })

  const mesAnterior = () => {
    setPeriodo(p =>
      p.mes === 1 ? { mes: 12, ano: p.ano - 1 } : { ...p, mes: p.mes - 1 }
    )
  }

  const mesProximo = () => {
    const ehAtual =
      periodo.mes === hoje.getMonth() + 1 && periodo.ano === hoje.getFullYear()
    if (ehAtual) return
    setPeriodo(p =>
      p.mes === 12 ? { mes: 1, ano: p.ano + 1 } : { ...p, mes: p.mes + 1 }
    )
  }

  const isAtual =
    periodo.mes === hoje.getMonth() + 1 && periodo.ano === hoje.getFullYear()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold leading-tight">{session.nome}</h1>
            <p className="text-blue-300 text-xs mt-0.5">
              {session.segmento} · {session.total_lojas}{' '}
              {session.total_lojas === 1 ? 'loja' : 'lojas'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-white/10 rounded-xl p-1 gap-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-sm px-3 py-1 rounded-lg font-medium transition-all ${
                    tab === t.key
                      ? 'bg-white text-[#1e3a5f]'
                      : 'text-white/70 hover:text-white'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Seletor de período — só no portfólio */}
            {tab === 'portfolio' && (
              <div className="flex items-center gap-1 bg-white/10 rounded-xl px-3 py-1.5">
                <button onClick={mesAnterior}
                  className="text-blue-200 hover:text-white transition-colors w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-lg leading-none">
                  ‹
                </button>
                <span className="text-sm font-medium min-w-[130px] text-center">
                  {MESES_FULL[periodo.mes - 1]} {periodo.ano}
                </span>
                <button onClick={mesProximo} disabled={isAtual}
                  className={`w-6 h-6 flex items-center justify-center rounded text-lg leading-none transition-colors ${
                    isAtual ? 'text-white/25 cursor-not-allowed' : 'text-blue-200 hover:text-white hover:bg-white/10'
                  }`}>
                  ›
                </button>
              </div>
            )}

            <button onClick={onLogout}
              className="text-blue-200 hover:text-white text-sm flex items-center gap-1.5 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {tab === 'portfolio'    && <Portfolio session={session} periodo={periodo} />}
        {tab === 'faturamento'  && <FaturamentoDashboard session={session} />}
      </main>
    </div>
  )
}
