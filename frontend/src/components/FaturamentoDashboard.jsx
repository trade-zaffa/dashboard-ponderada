import { useEffect, useState } from 'react'
import { getFaturamento, getPrograma } from '../api'

const BU = {
  LMP_CASA: { short: 'HC', label: 'Home Care',          cor: '#3b82f6', fundo: '#eff6ff' },
  AL_NUT:   { short: 'NT', label: 'Nutrição',           cor: '#22c55e', fundo: '#f0fdf4' },
  LMP_CUPE: { short: 'PC', label: 'Personal Care',      cor: '#ec4899', fundo: '#fdf2f8' },
  HGPER_BB: { short: 'BW', label: 'Beleza & Bem-Estar', cor: '#a855f7', fundo: '#faf5ff' },
}
const BU_KEYS = Object.keys(BU)
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmt(v) {
  if (!v) return 'R$ 0'
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(1)}K`
  return `R$ ${v.toFixed(2)}`
}

function fmtFull(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FaturamentoDashboard({ session }) {
  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

  const [fat, setFat]         = useState(null)
  const [prog, setProg]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [filtroBU, setFiltroBU] = useState('ALL')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getFaturamento(session.cd_cliens),
      getPrograma(session.cd_cliens, session.cnpj_raiz, mesAtual, anoAtual),
    ])
      .then(([rFat, rProg]) => { setFat(rFat.data); setProg(rProg.data) })
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-3" />
      Carregando faturamento...
    </div>
  )
  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
  )
  if (!fat) return null

  // ── KPIs do mês atual (em curso) ───────────────────────────────────────────
  const kpiMap = {}
  fat.kpis.forEach(k => { kpiMap[k.cd_secao] = k })

  const totalAtual    = fat.kpis.reduce((s, k) => s + k.vl_mes_atual, 0)
  const totalAnterior = fat.kpis.reduce((s, k) => s + k.vl_mes_anterior, 0)

  // Meta por BU vinda do programa (mês atual × ano anterior × 1.15)
  const metaMap = {}
  if (prog) {
    prog.bus.forEach(b => { metaMap[b.cd_secao] = { meta: b.meta_fat, base: b.fat_ano_anterior } })
  }
  const totalMeta = Object.values(metaMap).reduce((s, m) => s + m.meta, 0)
  const totalFalta = Math.max(0, totalMeta - totalAtual)
  const totalPct = totalMeta > 0 ? Math.min(100, totalAtual / totalMeta * 100) : 0

  // ── Histórico para gráfico ─────────────────────────────────────────────────
  const mesesMap = {}
  fat.historico.forEach(h => {
    if (filtroBU !== 'ALL' && h.cd_secao !== filtroBU) return
    const key = `${h.ano}-${String(h.mes).padStart(2,'0')}`
    if (!mesesMap[key]) mesesMap[key] = { ano: h.ano, mes: h.mes, total: 0 }
    mesesMap[key].total += h.vl_faturado
  })
  const mesesOrdenados = Object.values(mesesMap).sort((a,b) =>
    a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
  )
  const maxValor = Math.max(...mesesOrdenados.map(m => m.total), 1)

  const fatColor = totalPct >= 100 ? '#22c55e' : totalPct >= 70 ? '#f59e0b' : '#3b82f6'

  return (
    <div className="space-y-5">

      {/* ── KPI Total do mês ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-widest font-medium">
              Faturamento Unilever · {MESES_FULL[mesAtual - 1]} {anoAtual}
            </p>
            <p className="text-4xl font-bold mt-1">{fmtFull(totalAtual)}</p>
            {totalMeta > 0 && (
              <p className="text-sm text-white/50 mt-1">
                meta: {fmtFull(totalMeta)} · falta: {fmtFull(totalFalta)}
              </p>
            )}
          </div>
          {totalMeta > 0 && (
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: totalPct >= 100 ? '#4ade80' : '#fbbf24' }}>
                {totalPct.toFixed(1)}%
              </p>
              <p className="text-xs text-white/40 mt-1">da meta</p>
            </div>
          )}
        </div>
        {totalMeta > 0 && (
          <div className="mt-4">
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${totalPct}%`, backgroundColor: totalPct >= 100 ? '#4ade80' : '#fbbf24' }} />
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-white/30">
              <span>R$ 0</span>
              <span>Meta: {fmt(totalMeta)}</span>
            </div>
          </div>
        )}
        <div className="mt-3 text-xs text-white/30">
          Últ. mês completo: {fmtFull(totalAnterior)}
        </div>
      </div>

      {/* ── Cards por BU com meta ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {BU_KEYS.map(bu => {
          const cfg   = BU[bu]
          const kpi   = kpiMap[bu] || { vl_mes_atual: 0, vl_mes_anterior: 0 }
          const meta  = metaMap[bu]
          const atual = kpi.vl_mes_atual
          const pct   = meta?.meta > 0 ? Math.min(100, atual / meta.meta * 100) : null
          const falta = meta?.meta > 0 ? Math.max(0, meta.meta - atual) : null
          const ativo = filtroBU === bu
          const barCor = pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : cfg.cor

          return (
            <button key={bu} onClick={() => setFiltroBU(filtroBU === bu ? 'ALL' : bu)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                ativo ? 'shadow-md' : 'border-transparent hover:border-gray-200'
              }`}
              style={{
                backgroundColor: cfg.fundo,
                borderColor: ativo ? cfg.cor : undefined,
              }}>
              {/* BU label */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: cfg.cor }}>{cfg.short}</span>
                <span className="text-xs text-gray-500 truncate">{cfg.label}</span>
              </div>

              {/* Faturado no mês */}
              <p className="text-xl font-bold text-gray-800">{fmt(atual)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">faturado em {MESES[mesAtual-1]}</p>

              {/* Barra vs meta */}
              {meta?.meta > 0 ? (
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: barCor }} />
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="font-semibold" style={{ color: barCor }}>{pct.toFixed(1)}% da meta</span>
                    <span className="text-gray-400">meta {fmt(meta.meta)}</span>
                  </div>
                  {falta > 0 && (
                    <p className="text-[10px] text-gray-400">falta {fmt(falta)}</p>
                  )}
                  {falta === 0 && (
                    <p className="text-[10px] text-emerald-600 font-medium">Meta atingida!</p>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-[11px] text-gray-400">últ. mês: {fmt(kpi.vl_mes_anterior)}</p>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Gráfico evolução mensal ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Evolução Mensal</h3>
          <div className="flex gap-1">
            <button onClick={() => setFiltroBU('ALL')}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                filtroBU === 'ALL' ? 'bg-[#1e3a5f] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>Todas</button>
            {BU_KEYS.map(bu => (
              <button key={bu} onClick={() => setFiltroBU(filtroBU === bu ? 'ALL' : bu)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                  filtroBU === bu ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
                style={filtroBU === bu ? { backgroundColor: BU[bu].cor } : {}}>
                {BU[bu].short}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-1 h-40">
          {mesesOrdenados.map(m => {
            const pct = (m.total / maxValor) * 100
            const cor = filtroBU !== 'ALL' ? BU[filtroBU]?.cor : '#1e3a5f'
            const isCurrent = m.mes === mesAtual && m.ano === anoAtual
            return (
              <div key={`${m.ano}-${m.mes}`} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full flex justify-center">
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {MESES[m.mes-1]}/{m.ano}: {fmtFull(m.total)}
                  </div>
                  <div className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      backgroundColor: isCurrent ? '#f59e0b' : cor,
                      minHeight: '4px',
                      maxHeight: '100%',
                      opacity: isCurrent ? 0.9 : 1,
                    }} />
                </div>
                <span className={`text-[10px] ${isCurrent ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>
                  {MESES[m.mes-1]}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-amber-500 mt-2">● Mês atual (em curso)</p>
      </div>

    </div>
  )
}
