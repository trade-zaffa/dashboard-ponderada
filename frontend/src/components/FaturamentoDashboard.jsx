import { useEffect, useState } from 'react'
import { getFaturamento } from '../api'

const BU = {
  LMP_CASA: { short: 'HC', label: 'Home Care',         cor: '#3b82f6', fundo: '#eff6ff' },
  AL_NUT:   { short: 'NT', label: 'Nutrição',          cor: '#22c55e', fundo: '#f0fdf4' },
  LMP_CUPE: { short: 'PC', label: 'Personal Care',     cor: '#ec4899', fundo: '#fdf2f8' },
  HGPER_BB: { short: 'BW', label: 'Beleza & Bem-Estar',cor: '#a855f7', fundo: '#faf5ff' },
}
const BU_KEYS = Object.keys(BU)

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmt(v) {
  if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(1)}K`
  return `R$ ${v.toFixed(2)}`
}

function fmtFull(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FaturamentoDashboard({ session }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [filtroBU, setFiltroBU] = useState('ALL')

  useEffect(() => {
    setLoading(true)
    getFaturamento(session.cd_cliens)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar faturamento'))
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

  if (!data) return null

  // ── KPIs por BU ────────────────────────────────────────────────────────────
  const kpiMap = {}
  data.kpis.forEach(k => { kpiMap[k.cd_secao] = k })

  const totalAtual    = data.kpis.reduce((s, k) => s + k.vl_mes_atual, 0)
  const totalAnterior = data.kpis.reduce((s, k) => s + k.vl_mes_anterior, 0)
  const varTotal      = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : null

  // ── Histórico para gráfico ─────────────────────────────────────────────────
  // Agrupa por ano/mes, soma BUs filtradas
  const mesesMap = {}
  data.historico.forEach(h => {
    if (filtroBU !== 'ALL' && h.cd_secao !== filtroBU) return
    const key = `${h.ano}-${String(h.mes).padStart(2,'0')}`
    if (!mesesMap[key]) mesesMap[key] = { ano: h.ano, mes: h.mes, total: 0 }
    mesesMap[key].total += h.vl_faturado
  })
  const mesesOrdenados = Object.values(mesesMap).sort((a,b) =>
    a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
  )
  const maxValor = Math.max(...mesesOrdenados.map(m => m.total), 1)

  // Mês de referência (último mês com dados)
  const mesRef = mesesOrdenados.length > 0 ? mesesOrdenados[mesesOrdenados.length - 1] : null
  const mesRefLabel = mesRef ? `${MESES[mesRef.mes - 1]}/${mesRef.ano}` : ''

  return (
    <div className="space-y-6">

      {/* ── KPI Total ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] rounded-2xl p-6 text-white">
        <p className="text-sm text-white/70 font-medium">Faturamento Unilever · Últimas compras</p>
        <p className="text-4xl font-bold mt-1">{fmtFull(totalAnterior)}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-white/60">Mês em curso: {fmtFull(totalAtual)}</span>
          {varTotal !== null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              varTotal >= 0 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300'
            }`}>
              {varTotal >= 0 ? '▲' : '▼'} {Math.abs(varTotal).toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* ── Cards por BU ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {BU_KEYS.map(bu => {
          const cfg = BU[bu]
          const kpi = kpiMap[bu] || { vl_mes_atual: 0, vl_mes_anterior: 0 }
          const var_ = kpi.vl_mes_anterior > 0
            ? ((kpi.vl_mes_atual - kpi.vl_mes_anterior) / kpi.vl_mes_anterior) * 100
            : null
          const ativo = filtroBU === bu
          return (
            <button key={bu} onClick={() => setFiltroBU(filtroBU === bu ? 'ALL' : bu)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                ativo ? 'border-current shadow-md' : 'border-transparent hover:border-gray-200'
              }`}
              style={{ backgroundColor: cfg.fundo, borderColor: ativo ? cfg.cor : undefined }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: cfg.cor }}>{cfg.short}</span>
                <span className="text-xs text-gray-500 truncate">{cfg.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{fmt(kpi.vl_mes_anterior)}</p>
              <p className="text-xs text-gray-400 mt-0.5">últ. mês completo</p>
              {var_ !== null && (
                <p className={`text-xs font-medium mt-1 ${var_ >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {var_ >= 0 ? '▲' : '▼'} {Math.abs(var_).toFixed(1)}% vs mês anterior
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Gráfico de barras — evolução mensal ──────────────────────────── */}
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
            return (
              <div key={`${m.ano}-${m.mes}`} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full flex justify-center">
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {MESES[m.mes-1]}/{m.ano}: {fmtFull(m.total)}
                  </div>
                  <div className="w-full rounded-t transition-all"
                    style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: cor, minHeight: '4px', maxHeight: '100%' }} />
                </div>
                <span className="text-[10px] text-gray-400">{MESES[m.mes-1]}</span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
