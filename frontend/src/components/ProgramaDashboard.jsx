import { useEffect, useState } from 'react'
import { getPrograma } from '../api'

const BU = {
  LMP_CASA: { short: 'HC', label: 'Home Care',          cor: '#3b82f6' },
  AL_NUT:   { short: 'NT', label: 'Nutrição',           cor: '#22c55e' },
  LMP_CUPE: { short: 'PC', label: 'Personal Care',      cor: '#ec4899' },
  HGPER_BB: { short: 'BW', label: 'Beleza & Bem-Estar', cor: '#a855f7' },
}

const MESES_FULL = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

function fmtR(v) {
  if (!v) return 'R$ 0'
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}K`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtFull(v) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function PctBar({ pct, cor, label }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: cor }} />
      </div>
      <p className="text-xs text-gray-500">{pct.toFixed(1)}%</p>
    </div>
  )
}

function PilarBadge({ ativo, label, peso }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
      ativo ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
          ativo ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
        }`}>
          {ativo ? '✓' : '·'}
        </div>
        <span className={`text-xs font-medium ${ativo ? 'text-emerald-700' : 'text-gray-400'}`}>
          {label}
        </span>
      </div>
      <span className={`text-xs font-bold ${ativo ? 'text-emerald-600' : 'text-gray-300'}`}>
        {ativo ? `+${peso}%` : `${peso}%`}
      </span>
    </div>
  )
}

// ── Card por BU ──────────────────────────────────────────────────────────────
function BUCard({ bu, data }) {
  const cfg = BU[bu]
  if (!cfg) return null

  const totalPotencial = 2.50

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header BU */}
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold px-2 py-1 rounded text-white"
            style={{ backgroundColor: cfg.cor }}>{cfg.short}</span>
          <span className="font-semibold text-gray-800">{cfg.label}</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{fmtFull(data.ganho_bu)}</p>
          <p className="text-[10px] text-gray-400">de {fmtFull(data.potencial_bu)} potencial</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Barra de atingimento total */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-600">Atingimento do programa</span>
            <span className="text-sm font-bold" style={{ color: cfg.cor }}>
              {data.potencial_bu > 0
                ? ((data.ganho_bu / data.potencial_bu) * 100).toFixed(1)
                : '0.0'}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${data.potencial_bu > 0 ? Math.min(100, data.ganho_bu / data.potencial_bu * 100) : 0}%`,
                backgroundColor: cfg.cor,
              }} />
          </div>
        </div>

        {/* Meta de faturamento desta BU */}
        {data.meta_fat > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Meta desta BU</p>
              <p className="text-sm font-bold text-gray-800">{fmtFull(data.meta_fat)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                base {new Date().getFullYear() - 1}: {fmtFull(data.fat_ano_anterior)} + 15%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Potencial (2,5%)</p>
              <p className="text-sm font-bold text-[#c9a227]">{fmtFull(data.potencial_bu)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">= 2,5% × meta</p>
            </div>
          </div>
        )}

        {/* 4 Pilares */}
        <div className="grid grid-cols-2 gap-2">
          {/* Sortimento */}
          <div className={`rounded-xl border p-3 col-span-2 ${
            data.sort_peso > 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">SORTIMENTO</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {data.sort_positivado} de {data.meta_eans} EANs meta · {data.sort_pct}% atingido
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${data.sort_peso > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                  {data.sort_peso > 0 ? `+${data.sort_peso}%` : '0%'}
                </p>
                <p className="text-[10px] text-gray-400">peso máx 0,50%</p>
              </div>
            </div>
            <div className="h-1.5 bg-white rounded-full overflow-hidden border border-gray-100">
              <div className="h-full rounded-full transition-all duration-700 bg-blue-500"
                style={{ width: `${Math.min(100, data.sort_pct)}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-gray-400">
              <span>0%</span>
              <span className="text-amber-500">70% (+0,25%)</span>
              <span className="text-emerald-500">92% (+0,50%)</span>
            </div>
          </div>

          {/* Faturamento */}
          <div className={`rounded-xl border p-3 col-span-2 ${
            data.fat_peso > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">FATURAMENTO</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {fmtFull(data.fat_atual)} de {fmtFull(data.meta_fat)} meta · {data.fat_pct}% atingido
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${data.fat_peso > 0 ? 'text-amber-700' : 'text-gray-300'}`}>
                  +{(data.fat_peso).toFixed(2)}%
                </p>
                <p className="text-[10px] text-gray-400">peso máx 1,00%</p>
              </div>
            </div>
            <div className="h-1.5 bg-white rounded-full overflow-hidden border border-gray-100">
              <div className="h-full rounded-full transition-all duration-700 bg-amber-500"
                style={{ width: `${Math.min(100, data.fat_pct)}%` }} />
            </div>
          </div>

          {/* Ponto Extra */}
          <div className={`rounded-xl border p-3 ${
            data.ponto_extra ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                data.ponto_extra ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {data.ponto_extra ? '✓' : '○'}
              </div>
              <p className="text-xs font-semibold text-gray-700">PONTO EXTRA</p>
            </div>
            <p className={`text-sm font-bold ${data.ponto_extra ? 'text-purple-700' : 'text-gray-300'}`}>
              {data.ponto_extra ? '+0,50%' : '0,50%'}
            </p>
            {!data.ponto_extra && <p className="text-[10px] text-gray-400 mt-0.5">Em apuração</p>}
          </div>

          {/* Planograma */}
          <div className={`rounded-xl border p-3 ${
            data.planograma ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                data.planograma ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {data.planograma ? '✓' : '○'}
              </div>
              <p className="text-xs font-semibold text-gray-700">PLANOGRAMA</p>
            </div>
            <p className={`text-sm font-bold ${data.planograma ? 'text-emerald-700' : 'text-gray-300'}`}>
              {data.planograma ? '+0,50%' : '0,50%'}
            </p>
            {!data.planograma && <p className="text-[10px] text-gray-400 mt-0.5">Em apuração</p>}
          </div>
        </div>

        {/* Ganho calculado desta BU */}
        {data.meta_fat > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">Ganho apurado ({(data.total_peso).toFixed(2)}% × {fmtR(data.meta_fat)})</span>
            <span className="text-sm font-bold text-gray-800">{fmtFull(data.ganho_bu)}</span>
          </div>
        )}
        {data.meta_fat === 0 && (
          <p className="text-xs text-gray-300 text-center pt-2">Meta de faturamento não definida pelo admin</p>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ProgramaDashboard({ session }) {
  const hoje = new Date()
  // Abre no último mês completo (mês atual tem poucos dados nos primeiros dias)
  const mesInicial = hoje.getDate() <= 5
    ? (hoje.getMonth() === 0 ? 12 : hoje.getMonth())
    : hoje.getMonth() + 1
  const anoInicial = hoje.getDate() <= 5 && hoje.getMonth() === 0
    ? hoje.getFullYear() - 1
    : hoje.getFullYear()
  const [mes, setMes]     = useState(mesInicial)
  const [ano, setAno]     = useState(anoInicial)
  const [data, setData]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const carregar = (m, a) => {
    setLoading(true)
    setError(null)
    getPrograma(session.cd_cliens, session.cnpj_raiz, m, a)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregar(mes, ano) }, [mes, ano])

  const mudarMes = (delta) => {
    let nm = mes + delta, na = ano
    if (nm < 1) { nm = 12; na-- }
    if (nm > 12) { nm = 1; na++ }
    const ehFuturo = na > hoje.getFullYear() || (na === hoje.getFullYear() && nm > hoje.getMonth() + 1)
    if (ehFuturo) return
    setMes(nm); setAno(na)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-3" />
      Calculando programa...
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
  )

  const atingPct = data.total_potencial > 0
    ? (data.total_ganho / data.total_potencial * 100)
    : 0

  return (
    <div className="space-y-6">

      {/* ── Header com seletor de período ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Programa Ponderada</h2>
          <p className="text-sm text-gray-400">Acompanhe seu ganho por pilar e BU</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => mudarMes(-1)}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 text-lg">‹</button>
          <span className="text-sm font-medium min-w-[140px] text-center text-gray-700">
            {MESES_FULL[mes - 1]} {ano}
          </span>
          <button onClick={() => mudarMes(1)}
            disabled={mes === hoje.getMonth() + 1 && ano === hoje.getFullYear()}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30 text-lg">›</button>
        </div>
      </div>

      {/* ── KPI Total ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-widest font-medium">Ganho Total Estimado</p>
            <p className="text-5xl font-bold mt-2 text-[#c9a227]">{fmtFull(data.total_ganho)}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-sm text-white/40">de {fmtFull(data.total_potencial)} potencial</p>
              <p className="text-xs text-white/25">(2,5% × {fmtFull(data.bus.reduce((s,b)=>s+b.meta_fat,0))} meta total)</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[#c9a227]">{atingPct.toFixed(1)}%</p>
            <p className="text-xs text-white/40 mt-1">do potencial</p>
          </div>
        </div>
        {/* Barra geral */}
        <div className="mt-5 h-3 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[#c9a227] transition-all duration-700"
            style={{ width: `${Math.min(100, atingPct)}%` }} />
        </div>
        {/* Legenda dos 4 pilares */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'SORTIMENTO',  peso: '0,50%', cor: '#3b82f6' },
            { label: 'PONTO EXTRA', peso: '0,50%', cor: '#a855f7' },
            { label: 'PLANOGRAMA',  peso: '0,50%', cor: '#22c55e' },
            { label: 'FATURAMENTO', peso: '1,00%', cor: '#f59e0b' },
          ].map(p => (
            <div key={p.label} className="text-center">
              <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{p.label}</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: p.cor }}>{p.peso}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards por BU ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {data.bus.map(buData => (
          <BUCard key={buData.cd_secao} bu={buData.cd_secao} data={buData} />
        ))}
      </div>

      {/* ── Tabela resumo ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-800">Resumo por BU</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">BU</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Sort.</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Ponto Extra</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Planograma</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-400 uppercase">Fat.</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Ganho</th>
            </tr>
          </thead>
          <tbody>
            {data.bus.map(row => {
              const bu = BU[row.cd_secao]
              return (
                <tr key={row.cd_secao} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: bu?.cor }}>{bu?.short}</span>
                      <span className="text-gray-700">{bu?.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-semibold ${row.sort_peso > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                      +{row.sort_peso}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.ponto_extra
                      ? <span className="text-xs font-semibold text-purple-600">+0,50%</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.planograma
                      ? <span className="text-xs font-semibold text-emerald-600">+0,50%</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-semibold ${row.fat_peso > 0 ? 'text-amber-600' : 'text-gray-300'}`}>
                      +{(row.fat_peso).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800">
                    {fmtFull(row.ganho_bu)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td colSpan={5} className="px-5 py-3 font-semibold text-gray-700">Total</td>
              <td className="px-5 py-3 text-right font-bold text-lg text-gray-900">
                {fmtFull(data.total_ganho)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  )
}
