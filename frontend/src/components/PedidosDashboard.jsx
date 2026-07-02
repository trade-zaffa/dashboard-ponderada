import { useEffect, useState } from 'react'
import { getPedidosAbertos, getPedidos, getPedidoItens } from '../api'

const BU = {
  LMP_CASA: { short: 'HC', label: 'Home Care',          cor: '#3b82f6', fundo: '#eff6ff' },
  AL_NUT:   { short: 'NT', label: 'Nutrição',           cor: '#22c55e', fundo: '#f0fdf4' },
  LMP_CUPE: { short: 'PC', label: 'Personal Care',      cor: '#ec4899', fundo: '#fdf2f8' },
  HGPER_BB: { short: 'BW', label: 'Beleza & Bem-Estar', cor: '#a855f7', fundo: '#faf5ff' },
}

function fmtR(v) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}K`
  return `R$ ${v.toFixed(2)}`
}

function fmtFull(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(s) {
  if (!s) return '-'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// ── Modal de itens do pedido ──────────────────────────────────────────────────
function ModalItens({ pedido, session, onClose }) {
  const [itens, setItens] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPedidoItens(pedido.nu_ped, session.cd_cliens)
      .then(r => setItens(r.data))
      .finally(() => setLoading(false))
  }, [pedido.nu_ped])

  const total = itens ? itens.reduce((s, i) => s + i.valor_item, 0) : 0

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <p className="font-bold text-gray-800">Pedido #{pedido.nu_ped}</p>
            <p className="text-xs text-gray-400">{fmtDate(pedido.dt_pedido)} · {pedido.tp_ped} · {pedido.etapas || 'sem etapa'}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-xl leading-none">
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-2" />
            Carregando itens...
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Produto</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">BU</th>
                  <th className="text-right px-3 py-3 text-gray-500 font-medium">Cx</th>
                  <th className="text-right px-3 py-3 text-gray-500 font-medium">Un</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => {
                  const bu = BU[it.cd_secao]
                  return (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-800 leading-tight">{it.produto}</p>
                        <p className="text-xs text-gray-400">{it.ean}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {bu && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: bu.cor }}>{bu.short}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{it.qtde_caixas}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{it.total_unidades}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                        {fmtFull(it.valor_item)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{fmtFull(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lista de pedidos ──────────────────────────────────────────────────────────
function ListaPedidos({ session, filtroBU }) {
  const [pedidos, setPedidos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pedidoSel, setPedidoSel] = useState(null)

  useEffect(() => {
    getPedidos(session.cd_cliens)
      .then(r => setPedidos(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-2" />
      Carregando pedidos...
    </div>
  )

  if (!pedidos?.length) return (
    <div className="text-center py-10 text-gray-400">Nenhum pedido em aberto</div>
  )

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Pedido</th>
              <th className="text-left px-3 py-3 text-gray-500 font-medium">Data</th>
              <th className="text-left px-3 py-3 text-gray-500 font-medium">Etapa</th>
              <th className="text-right px-3 py-3 text-gray-500 font-medium">Produtos</th>
              <th className="text-right px-4 py-3 text-gray-500 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map(p => (
              <tr key={p.nu_ped}
                className="border-t border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => setPedidoSel(p)}>
                <td className="px-4 py-3 font-semibold text-[#1e3a5f]">#{p.nu_ped}</td>
                <td className="px-3 py-3 text-gray-500">{fmtDate(p.dt_pedido)}</td>
                <td className="px-3 py-3 text-gray-600 text-xs max-w-[200px] truncate">{p.etapas || '—'}</td>
                <td className="px-3 py-3 text-right text-gray-600">{p.qtd_produtos}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">{fmtFull(p.valor_estimado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pedidoSel && (
        <ModalItens pedido={pedidoSel} session={session} onClose={() => setPedidoSel(null)} />
      )}
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PedidosDashboard({ session }) {
  const [resumo, setResumo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [aba, setAba] = useState('resumo')

  useEffect(() => {
    getPedidosAbertos(session.cd_cliens)
      .then(r => setResumo(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <div className="w-6 h-6 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-3" />
      Carregando pedidos...
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
  )

  const totalFat = resumo.reduce((s, r) => s + r.vl_faturado, 0)
  const totalAbe = resumo.reduce((s, r) => s + r.vl_aberto, 0)
  const totalPed = resumo.reduce((s, r) => s + r.qtd_pedidos, 0)

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* ── Totalizador ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] rounded-2xl p-5 text-white col-span-1">
          <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Faturado em {mesAtual}</p>
          <p className="text-3xl font-bold mt-1">{fmtR(totalFat)}</p>
          <p className="text-xs text-white/50 mt-1">{fmtFull(totalFat)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Em aberto (a faturar)</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">{fmtR(totalAbe)}</p>
          <p className="text-xs text-gray-400 mt-1">{fmtFull(totalAbe)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Pedidos em aberto</p>
          <p className="text-3xl font-bold mt-1 text-gray-800">{totalPed}</p>
          <p className="text-xs text-gray-400 mt-1">pedidos Unilever</p>
        </div>
      </div>

      {/* ── Cards por BU ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {resumo.map(row => {
          const bu = BU[row.cd_secao]
          if (!bu) return null
          return (
            <div key={row.cd_secao}
              className="rounded-xl border border-gray-100 shadow-sm p-4"
              style={{ backgroundColor: bu.fundo }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: bu.cor }}>{bu.short}</span>
                <span className="text-xs text-gray-500">{bu.label}</span>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Faturado</p>
                  <p className="text-base font-bold text-gray-800">{fmtR(row.vl_faturado)}</p>
                </div>
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Em aberto</p>
                  <p className="text-base font-bold text-amber-600">{fmtR(row.vl_aberto)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{row.qtd_pedidos} pedidos</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Abas ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex border-b border-gray-100 px-4 pt-4 gap-4">
          {[
            { key: 'resumo', label: 'Resumo por BU' },
            { key: 'pedidos', label: 'Lista de Pedidos' },
          ].map(a => (
            <button key={a.key} onClick={() => setAba(a.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                aba === a.key
                  ? 'border-[#1e3a5f] text-[#1e3a5f]'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {a.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {aba === 'resumo' && (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 text-gray-400 font-medium">BU</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Faturado {mesAtual}</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Em aberto</th>
                  <th className="text-right py-2 text-gray-400 font-medium">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {resumo.map(row => {
                  const bu = BU[row.cd_secao]
                  return (
                    <tr key={row.cd_secao} className="border-t border-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: bu?.cor }}>{bu?.short}</span>
                          <span className="text-gray-700">{bu?.label}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right font-medium text-gray-800">
                        {fmtFull(row.vl_faturado)}
                      </td>
                      <td className="py-3 text-right font-medium text-amber-600">
                        {fmtFull(row.vl_aberto)}
                      </td>
                      <td className="py-3 text-right text-gray-500">{row.qtd_pedidos}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <td className="py-3 font-semibold text-gray-700">Total</td>
                  <td className="py-3 text-right font-bold text-gray-900">{fmtFull(totalFat)}</td>
                  <td className="py-3 text-right font-bold text-amber-700">{fmtFull(totalAbe)}</td>
                  <td className="py-3 text-right font-bold text-gray-900">{totalPed}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {aba === 'pedidos' && <ListaPedidos session={session} />}
        </div>
      </div>

    </div>
  )
}
