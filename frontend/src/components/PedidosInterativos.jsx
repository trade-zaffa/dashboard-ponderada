import { useEffect, useState, useMemo, useCallback } from 'react'
import { getPedidos, getPedidoItens } from '../api'

// ─── Etapas do workflow ────────────────────────────────────────────────────────
const ETAPAS = {
  FATU: { label: 'Pronto para Faturar', short: 'Faturamento', cor: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', borda: 'border-emerald-200', header: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', icone: '✅' },
  EXPE: { label: 'Em Expedição',        short: 'Expedição',   cor: '#3b82f6', bg: 'bg-blue-50',    text: 'text-blue-700',    borda: 'border-blue-200',    header: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',    icone: '🚚' },
  MACL: { label: 'Aguardando Confirm.', short: 'Aguard. Conf.',cor: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-700',  borda: 'border-violet-200',  header: 'bg-violet-50 border-violet-200',  dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700',  icone: '⏳' },
  CRED: { label: 'Análise de Crédito',  short: 'Crédito',     cor: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-700',   borda: 'border-amber-200',   header: 'bg-amber-50 border-amber-200',   dot: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700',   icone: '💳' },
  ERPV: { label: 'Erro no Pedido',      short: 'Erro',        cor: '#ef4444', bg: 'bg-red-50',     text: 'text-red-700',     borda: 'border-red-200',     header: 'bg-red-50 border-red-200',     dot: 'bg-red-500',     badge: 'bg-red-100 text-red-700',     icone: '❌' },
  SEM:  { label: 'Processando',         short: 'Processando', cor: '#94a3b8', bg: 'bg-slate-50',   text: 'text-slate-600',   borda: 'border-slate-200',   header: 'bg-slate-50 border-slate-200',   dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600',  icone: '🔄' },
  FATURADO: { label: 'Faturado · Aguardando Baixa', short: 'Faturado', cor: '#0ea5e9', bg: 'bg-sky-50', text: 'text-sky-700', borda: 'border-sky-200', header: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500', badge: 'bg-sky-100 text-sky-700', icone: '🧾' },
}

// "FATURADO" tem prioridade sobre as demais: já existe nota emitida no ERP,
// mesmo que o pedido/fila ainda não tenha sido baixado (ver getEtapas).
const ORDEM_ETAPAS = ['ERPV', 'CRED', 'FATURADO', 'FATU', 'EXPE', 'MACL', 'SEM']

const BU = {
  LMP_CASA: { short: 'HC', badge: 'bg-blue-100 text-blue-700' },
  AL_NUT:   { short: 'NT', badge: 'bg-green-100 text-green-700' },
  LMP_CUPE: { short: 'PC', badge: 'bg-pink-100 text-pink-700' },
  HGPER_BB: { short: 'BW', badge: 'bg-purple-100 text-purple-700' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = iso => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function getEtapas(pedido) {
  // Nota fiscal já emitida no ERP: a fila interna (evento) ainda pode não ter
  // sido baixada, mas o que importa pro cliente/admin é que já faturou.
  if (pedido.ja_faturado) return ['FATURADO']

  const cdFilas = pedido.cd_filas
  if (!cdFilas) return ['SEM']
  const filas = cdFilas.split(',').map(s => s.trim())
  const encontradas = ORDEM_ETAPAS.filter(e => filas.includes(e))
  return encontradas.length > 0 ? encontradas : ['SEM']
}

function getEtapaPrincipal(pedido) {
  return getEtapas(pedido)[0]
}

// ─── Badge de etapa ────────────────────────────────────────────────────────────
function EtapaBadge({ etapa }) {
  const cfg = ETAPAS[etapa] || ETAPAS.SEM
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.short}
    </span>
  )
}

// ─── Linha de item de pedido ────────────────────────────────────────────────────
function ItemRow({ item }) {
  const buCfg = BU[item.cd_secao]
  return (
    <tr className="hover:bg-gray-50 text-xs">
      <td className="px-3 py-2 font-mono text-gray-400">{item.ean}</td>
      <td className="px-3 py-2 text-gray-700 max-w-[260px]">
        <div className="truncate" title={item.produto}>{item.produto}</div>
      </td>
      <td className="px-3 py-2 text-center">
        {buCfg && <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${buCfg.badge}`}>{buCfg.short}</span>}
      </td>
      <td className="px-3 py-2 text-center text-gray-600 font-mono">
        {Number.isInteger(item.qtde_caixas) ? item.qtde_caixas : item.qtde_caixas.toFixed(1)} {(item.unid_ped || 'un').toLowerCase()}
      </td>
      <td className="px-3 py-2 text-center font-semibold text-gray-800">
        {item.total_unidades.toLocaleString('pt-BR')}
      </td>
      <td className="px-3 py-2 text-right font-mono text-gray-700">{fmt(item.valor_item)}</td>
    </tr>
  )
}

// ─── Card de pedido ────────────────────────────────────────────────────────────
function PedidoRow({ pedido, cdCliens, expandido, onToggle }) {
  const [itens, setItens] = useState(null)
  const [loadingItens, setLoadingItens] = useState(false)

  const etapas = getEtapas(pedido)
  const principalEtapa = etapas[0]
  const cfg = ETAPAS[principalEtapa] || ETAPAS.SEM

  const handleToggle = useCallback(async () => {
    onToggle(pedido.nu_ped)
    if (!expandido && itens === null && !loadingItens) {
      setLoadingItens(true)
      try {
        const r = await getPedidoItens(pedido.nu_ped, cdCliens)
        setItens(r.data)
      } catch {
        setItens([])
      } finally {
        setLoadingItens(false)
      }
    }
  }, [expandido, itens, loadingItens, pedido.nu_ped, cdCliens, onToggle])

  const itensPorBU = useMemo(() => {
    if (!itens) return {}
    const g = {}
    itens.forEach(i => {
      if (!g[i.cd_secao]) g[i.cd_secao] = []
      g[i.cd_secao].push(i)
    })
    return g
  }, [itens])

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expandido ? `${cfg.borda} shadow-md` : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'} bg-white`}>
      <button onClick={handleToggle} className="w-full text-left px-4 py-3.5 flex items-center gap-4">
        {/* Número + data */}
        <div className="flex-shrink-0 min-w-[100px]">
          <div className="text-sm font-bold text-[#1e3a5f] font-mono">#{pedido.nu_ped}</div>
          <div className="text-xs text-gray-400 mt-0.5">{fmtData(pedido.dt_pedido)}</div>
        </div>

        {/* Etapas */}
        <div className="flex flex-wrap gap-1 flex-1">
          {etapas.map(e => <EtapaBadge key={e} etapa={e} />)}
        </div>

        {/* Valor + counts */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-xs text-gray-400">Produtos</div>
            <div className="text-sm font-semibold text-gray-700">{pedido.qtd_produtos}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Valor est.</div>
            <div className="text-sm font-bold text-gray-800">{fmt(pedido.valor_estimado)}</div>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandido ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expandido && (
        <div className="border-t border-gray-100">
          {loadingItens ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1e3a5f]" />
            </div>
          ) : !itens || itens.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">Nenhum produto Unilever neste pedido.</div>
          ) : (
            <div>
              {/* Metadados */}
              <div className="px-4 py-2.5 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500 border-b border-gray-100">
                <span>CFOP: <strong>{pedido.cfop}</strong></span>
                <span>Tipo: <strong>{pedido.tp_ped}</strong></span>
                <span>Fatura: <strong>{pedido.inicio_fatura ? 'Iniciada' : 'Não iniciada'}</strong></span>
                {pedido.ja_faturado && (
                  <span className="text-sky-700">
                    Nota fiscal: <strong>já emitida no ERP</strong> — pendente de baixa/confirmação da fila
                  </span>
                )}
                <span className="ml-auto font-medium text-gray-700">
                  {pedido.total_unidades.toLocaleString('pt-BR')} un · {fmt(pedido.valor_estimado)}
                </span>
              </div>

              {/* Itens por BU */}
              {Object.entries(itensPorBU).map(([bu, buItens]) => {
                const buCfg = BU[bu]
                const totalBU = buItens.reduce((s, i) => s + i.valor_item, 0)
                return (
                  <div key={bu} className="border-t border-gray-50">
                    <div className="px-4 py-2 flex items-center gap-2 bg-gray-50/50">
                      {buCfg && <span className={`px-2 py-0.5 rounded text-xs font-bold ${buCfg.badge}`}>{buCfg.short}</span>}
                      <span className="text-xs text-gray-500">
                        {buItens.length} produto{buItens.length > 1 ? 's' : ''} · {fmt(totalBU)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-50">
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">EAN</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Produto</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">BU</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Qtde</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-400">Unidades</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {buItens.map(item => <ItemRow key={item.ean} item={item} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}

              {/* Rodapé total */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-5 text-sm">
                <span className="text-gray-500">{pedido.qtd_produtos} produtos</span>
                <span className="text-gray-500">{pedido.total_unidades.toLocaleString('pt-BR')} un</span>
                <span className="font-bold text-gray-800">{fmt(pedido.valor_estimado)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Seção de etapa (swimlane) ─────────────────────────────────────────────────
function SecaoEtapa({ etapa, pedidos, cdCliens, expandidos, onToggle, aberta, onToggleSecao }) {
  const cfg = ETAPAS[etapa] || ETAPAS.SEM
  const total = pedidos.reduce((s, p) => s + p.valor_estimado, 0)

  return (
    <div className={`rounded-xl border overflow-hidden ${cfg.borda}`}>
      {/* Header da seção */}
      <button
        onClick={onToggleSecao}
        className={`w-full px-4 py-3 flex items-center gap-3 border-b ${cfg.header} transition-opacity ${!aberta ? 'opacity-90' : ''}`}
      >
        <span className="text-lg">{cfg.icone}</span>
        <div className="flex-1 text-left">
          <span className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</span>
          <span className={`ml-2 text-xs ${cfg.text} opacity-70`}>
            {pedidos.length} pedido{pedidos.length > 1 ? 's' : ''} · {fmt(total)}
          </span>
        </div>
        <svg className={`w-4 h-4 ${cfg.text} transition-transform ${aberta ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Pedidos */}
      {aberta && (
        <div className={`${cfg.bg} p-3 space-y-2`}>
          {pedidos.map(p => (
            <PedidoRow
              key={p.nu_ped}
              pedido={p}
              cdCliens={cdCliens}
              expandido={expandidos.has(p.nu_ped)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function PedidosInterativos({ session }) {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandidos, setExpandidos] = useState(new Set())
  const [secoesAbertas, setSecoesAbertas] = useState(new Set(['FATU', 'ERPV', 'CRED']))
  const [busca, setBusca] = useState('')

  useEffect(() => {
    getPedidos(session.cd_cliens)
      .then(r => setPedidos(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar pedidos'))
      .finally(() => setLoading(false))
  }, [])

  const toggleExpandido = useCallback(nu_ped => {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(nu_ped) ? next.delete(nu_ped) : next.add(nu_ped)
      return next
    })
  }, [])

  const toggleSecao = useCallback(etapa => {
    setSecoesAbertas(prev => {
      const next = new Set(prev)
      next.has(etapa) ? next.delete(etapa) : next.add(etapa)
      return next
    })
  }, [])

  // Agrupar pedidos por etapa principal
  const pedidosPorEtapa = useMemo(() => {
    const grupos = {}
    ORDEM_ETAPAS.forEach(e => grupos[e] = [])

    pedidos
      .filter(p => {
        if (!busca) return true
        return String(p.nu_ped).includes(busca)
      })
      .forEach(p => {
        const etapa = getEtapaPrincipal(p)
        grupos[etapa].push(p)
      })
    return grupos
  }, [pedidos, busca])

  // KPIs
  const kpis = useMemo(() => {
    const totalValor = pedidos.reduce((s, p) => s + p.valor_estimado, 0)
    const por = {}
    ORDEM_ETAPAS.forEach(e => {
      por[e] = pedidos.filter(p => getEtapaPrincipal(p) === e).length
    })
    return { totalValor, por, total: pedidos.length }
  }, [pedidos])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]" />
      <p className="text-sm text-gray-400">Carregando pedidos...</p>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">{error}</div>
  )

  if (pedidos.length === 0) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-12 text-center">
      <div className="text-4xl mb-3">✅</div>
      <div className="text-lg font-semibold text-emerald-700">Nenhum pedido em aberto</div>
      <div className="text-sm mt-1 text-emerald-600">Todos os pedidos Unilever foram faturados.</div>
    </div>
  )

  const etapasComPedidos = ORDEM_ETAPAS.filter(e => pedidosPorEtapa[e]?.length > 0)

  return (
    <div className="space-y-4">

      {/* ── KPI pills ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 col-span-2 md:col-span-1 lg:col-span-2">
          <div className="text-xl font-bold text-[#1e3a5f]">{fmt(kpis.totalValor)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total em aberto · {kpis.total} pedidos</div>
        </div>

        {/* Por etapa */}
        {['FATURADO','FATU','EXPE','MACL','CRED','ERPV'].map(e => {
          const cfg = ETAPAS[e]
          const count = kpis.por[e]
          return (
            <button key={e}
              onClick={() => {
                if (count === 0) return
                setSecoesAbertas(prev => {
                  const next = new Set(prev)
                  next.has(e) ? next.delete(e) : next.add(e)
                  return next
                })
              }}
              disabled={count === 0}
              className={`rounded-xl px-4 py-3 text-left border transition-all ${
                count > 0
                  ? `${cfg.borda} ${cfg.bg} cursor-pointer hover:shadow-sm`
                  : 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
              }`}
            >
              <div className={`text-xl font-bold ${cfg.text}`}>{count}</div>
              <div className={`text-xs font-medium mt-0.5 ${cfg.text}`}>{cfg.short}</div>
            </button>
          )
        })}
      </div>

      {/* ── Busca ───────────────────────────────────────────────────────────────── */}
      <div className="relative max-w-xs">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nº do pedido..."
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">×</button>
        )}
      </div>

      {/* ── Pedidos por etapa ─────────────────────────────────────────────────── */}
      {etapasComPedidos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Nenhum pedido encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {etapasComPedidos.map(etapa => (
            <SecaoEtapa
              key={etapa}
              etapa={etapa}
              pedidos={pedidosPorEtapa[etapa]}
              cdCliens={session.cd_cliens}
              expandidos={expandidos}
              onToggle={toggleExpandido}
              aberta={secoesAbertas.has(etapa)}
              onToggleSecao={() => toggleSecao(etapa)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
