import { useEffect, useState, useMemo, useRef } from 'react'
import { getSortimento, getMetas } from '../api'
import RelatorioCadastro from './RelatorioCadastro'
import GerarPedido from './GerarPedido'

// ─── Configuração ──────────────────────────────────────────────────────────────
const BU = {
  LMP_CASA: { label: 'Home Care',          short: 'HC', cor: '#3b82f6', corClaro: '#dbeafe', badge: 'bg-blue-100 text-blue-700',   borda: 'border-blue-200',   anel: 'ring-blue-300' },
  AL_NUT:   { label: 'Nutrição',           short: 'NT', cor: '#22c55e', corClaro: '#dcfce7', badge: 'bg-green-100 text-green-700', borda: 'border-green-200',  anel: 'ring-green-300' },
  LMP_CUPE: { label: 'Personal Care',      short: 'PC', cor: '#ec4899', corClaro: '#fce7f3', badge: 'bg-pink-100 text-pink-700',   borda: 'border-pink-200',   anel: 'ring-pink-300' },
  HGPER_BB: { label: 'Beleza & Bem-Estar', short: 'BW', cor: '#a855f7', corClaro: '#f3e8ff', badge: 'bg-purple-100 text-purple-700',borda: 'border-purple-200', anel: 'ring-purple-300' },
}

const STATUS = {
  positivado:    { label: 'Positivado',    cor: '#10b981', pill: 'bg-emerald-100 text-emerald-800', borda: 'border-l-emerald-500' },
  em_progresso:  { label: 'Em Progresso',  cor: '#f59e0b', pill: 'bg-amber-100 text-amber-800',    borda: 'border-l-amber-400' },
  pendente:      { label: 'Pendente',      cor: '#94a3b8', pill: 'bg-slate-100 text-slate-700',    borda: 'border-l-slate-300' },
  nunca_comprou: { label: 'Nunca Comprou', cor: '#8b5cf6', pill: 'bg-violet-100 text-violet-800',  borda: 'border-l-violet-500' },
}

const CURVA_ABC_CFG = {
  A: 'bg-emerald-600 text-white',
  B: 'bg-amber-500 text-white',
  C: 'bg-gray-400 text-white',
}

function CurvaAbcBadge({ curva }) {
  if (!curva) return null
  return (
    <span title={`Curva ABC: ${curva}`}
      className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold shrink-0 ${CURVA_ABC_CFG[curva] || 'bg-gray-300 text-gray-700'}`}>
      {curva}
    </span>
  )
}

// ─── Barra de progresso animada ────────────────────────────────────────────────
function Bar({ valor, total, cor, h = 'h-2' }) {
  const [w, setW] = useState(0)
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0
  useEffect(() => { const t = setTimeout(() => setW(pct), 80); return () => clearTimeout(t) }, [pct])
  return (
    <div className={`w-full bg-gray-100 rounded-full ${h} overflow-hidden`}>
      <div className={`${h} rounded-full`} style={{ width: `${w}%`, backgroundColor: cor, transition: 'width 0.7s ease' }} />
    </div>
  )
}

function MiniBar({ vendido, minimo }) {
  const pct = minimo > 0 ? Math.min(100, (vendido / minimo) * 100) : 0
  const cor = pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : '#e2e8f0'
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 bg-gray-100 rounded-full h-1.5 overflow-hidden flex-shrink-0">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
      <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
        {vendido.toLocaleString('pt-BR')}/{minimo}
      </span>
    </div>
  )
}

// ─── Card de BU (apenas visão geral + filtro) ──────────────────────────────────
function BUCard({ buKey, stats, ativo, onFiltrar, meta }) {
  const cfg = BU[buKey]
  if (!cfg || stats.total === 0) return null
  const pct = Math.round((stats.positivado / stats.total) * 100)
  const pctCor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'
  const metaPct = meta ? Math.min(100, Math.round((stats.positivado / meta) * 100)) : null
  const metaAtingida = meta && stats.positivado >= meta

  return (
    <button
      onClick={onFiltrar}
      title={`${ativo ? 'Remover filtro' : 'Filtrar por'} ${cfg.label}`}
      className={`w-full text-left rounded-xl border-2 bg-white p-4 transition-all focus:outline-none focus:ring-2 ${cfg.anel} ${
        ativo ? `${cfg.borda} shadow-md` : 'border-transparent hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg.badge}`}>{cfg.short}</span>
          <p className="text-sm font-semibold text-gray-700 mt-1">{cfg.label}</p>
        </div>
        <span className="text-2xl font-bold" style={{ color: pctCor }}>{pct}%</span>
      </div>
      <Bar valor={stats.positivado} total={stats.total} cor={pctCor} />
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span className="font-medium" style={{ color: pctCor }}>{stats.positivado} positivados</span>
        <span>{stats.total} EANs</span>
      </div>

      {/* Barra de meta */}
      {meta && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500 font-medium">Meta</span>
            <span className={`font-bold ${metaAtingida ? 'text-emerald-600' : 'text-amber-600'}`}>
              {stats.positivado}/{meta} EANs {metaAtingida ? '✓' : `(faltam ${meta - stats.positivado})`}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: `${metaPct}%`, backgroundColor: metaAtingida ? '#10b981' : '#f59e0b' }} />
          </div>
        </div>
      )}

      {ativo && (
        <div className="mt-2 text-xs font-medium text-center py-1 rounded-lg" style={{ backgroundColor: cfg.corClaro, color: cfg.cor }}>
          Filtro ativo — clique para remover
        </div>
      )}
    </button>
  )
}

// ─── Chip de filtro ativo ──────────────────────────────────────────────────────
function FilterChip({ label, cor, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border"
      style={{ backgroundColor: cor + '20', borderColor: cor + '50', color: cor }}>
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity ml-0.5 font-bold leading-none">×</button>
    </span>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function Portfolio({ session, periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metasBU, setMetasBU] = useState({}) // { cd_secao: meta_eans }

  const [filtroStatus, setFiltroStatus] = useState('ALL')
  const [filtroBU, setFiltroBU] = useState(new Set()) // Set vazio = todas as BUs
  const [filtroDestaque, setFiltroDestaque] = useState('ALL') // 'ALL' | 'sortimento' | 'novo'
  const [filtroAbc, setFiltroAbc] = useState('ALL') // 'ALL' | 'A' | 'B' | 'C'
  const [busca, setBusca] = useState('')

  // Seleção como Set de EANs
  const [sel, setSel] = useState(new Set())

  // 'lista' | 'pedido' | 'cadastro'
  const [vista, setVista] = useState('lista')

  const buscaRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    setSel(new Set())
    setFiltroStatus('ALL')
    setFiltroBU(new Set())
    setFiltroDestaque('ALL')
    setFiltroAbc('ALL')
    setBusca('')
    setVista('lista')
    Promise.all([
      getSortimento(session.cd_cliens, session.total_lojas, periodo),
      getMetas(periodo),
    ]).then(([rSort, rMetas]) => {
      setData(rSort.data)
      setMetasBU(rMetas.data)
    }).catch(e => setError(e.response?.data?.detail || 'Erro ao carregar portfólio'))
      .finally(() => setLoading(false))
  }, [periodo.mes, periodo.ano])

  const itens = data?.itens || []

  const totais = useMemo(() => {
    const t = { positivado: 0, em_progresso: 0, pendente: 0, nunca_comprou: 0, total: 0 }
    itens.forEach(i => { t[i.status]++; t.total++ })
    return t
  }, [itens])

  const statsBU = useMemo(() => {
    const s = {}
    itens.forEach(i => {
      if (!s[i.cd_secao]) s[i.cd_secao] = { positivado: 0, em_progresso: 0, pendente: 0, nunca_comprou: 0, total: 0 }
      s[i.cd_secao][i.status]++
      s[i.cd_secao].total++
    })
    return s
  }, [itens])

  const itensFiltrados = useMemo(() => itens.filter(i => {
    if (filtroStatus !== 'ALL' && i.status !== filtroStatus) return false
    if (filtroBU.size > 0 && !filtroBU.has(i.cd_secao.trim())) return false
    if (filtroDestaque === 'sortimento' && !i.is_sortimento) return false
    if (filtroDestaque === 'novo' && !i.is_novo) return false
    if (filtroAbc !== 'ALL' && i.curva_abc !== filtroAbc) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (!(i.produto || '').toLowerCase().includes(q) && !(i.ean || '').includes(busca)) return false
    }
    return true
  }), [itens, filtroStatus, filtroBU, filtroDestaque, filtroAbc, busca])

  const contagemAbc = useMemo(() => ({
    A: itens.filter(i => i.curva_abc === 'A').length,
    B: itens.filter(i => i.curva_abc === 'B').length,
    C: itens.filter(i => i.curva_abc === 'C').length,
  }), [itens])

  const contagemDestaque = useMemo(() => ({
    sortimento: itens.filter(i => i.is_sortimento).length,
    novo: itens.filter(i => i.is_novo).length,
  }), [itens])

  // ── Seleção helpers ───────────────────────────────────────────────────────────
  const toggleItem = ean => setSel(prev => { const n = new Set(prev); n.has(ean) ? n.delete(ean) : n.add(ean); return n })

  // Nunca comprou só entra na seleção via clique individual na linha.
  // ⊕ e checkbox do cabeçalho só selecionam pendente + em_progresso (a menos que o filtro de status seja explicitamente outro).
  const STATUS_PEDIDO = ['pendente', 'em_progresso']

  const isSelecionavel = (item) => {
    if (filtroStatus !== 'ALL') return item.status === filtroStatus
    return STATUS_PEDIDO.includes(item.status)
  }

  const selecionarBU = buKey => {
    const eansDoBU = itens.filter(i => {
      if (i.cd_secao.trim() !== buKey) return false
      if (!isSelecionavel(i)) return false
      if (busca) {
        const q = busca.toLowerCase()
        if (!(i.produto || '').toLowerCase().includes(q) && !(i.ean || '').includes(busca)) return false
      }
      return true
    }).map(i => i.ean)
    setSel(prev => {
      const n = new Set(prev)
      const todosMarcados = eansDoBU.length > 0 && eansDoBU.every(e => n.has(e))
      if (todosMarcados) eansDoBU.forEach(e => n.delete(e))
      else eansDoBU.forEach(e => n.add(e))
      return n
    })
  }

  // Sugestão de compra: seleciona apenas os EANs do sortimento (is_sortimento) não positivados da BU.
  // Itens fora do sortimento só entram na seleção se o usuário clicar manualmente.
  const sugerirCompraBU = buKey => {
    const eansDoBU = itens
      .filter(i => i.cd_secao.trim() === buKey && i.status !== 'positivado' && i.is_sortimento)
      .map(i => i.ean)
    setSel(prev => {
      const n = new Set(prev)
      eansDoBU.forEach(e => n.add(e))
      return n
    })
  }

  // Toggle cabeçalho: respeita a mesma regra — nunca_comprou não entra a menos que explicitamente filtrado
  const toggleTodosVisiveis = () => {
    const eans = itensFiltrados.filter(isSelecionavel).map(i => i.ean)
    setSel(prev => {
      const n = new Set(prev)
      const todos = eans.length > 0 && eans.every(e => n.has(e))
      if (todos) eans.forEach(e => n.delete(e))
      else eans.forEach(e => n.add(e))
      return n
    })
  }

  const itensSel = useMemo(() => itens.filter(i => sel.has(i.ean)), [itens, sel])
  const itensSelOcultos = useMemo(() => itensSel.filter(i => !itensFiltrados.find(f => f.ean === i.ean)), [itensSel, itensFiltrados])
  const nuncaComprouSel = itensSel.filter(i => i.status === 'nunca_comprou')

  const itensFiltradosSelecionaveis = itensFiltrados.filter(isSelecionavel)
  const todosFiltradosSel = itensFiltradosSelecionaveis.length > 0 && itensFiltradosSelecionaveis.every(i => sel.has(i.ean))
  const algumFiltradoSel = itensFiltrados.some(i => sel.has(i.ean))

  const temFiltro = filtroStatus !== 'ALL' || filtroBU.size > 0 || filtroDestaque !== 'ALL' || filtroAbc !== 'ALL' || busca !== ''

  const toggleBU = bu => setFiltroBU(prev => {
    const n = new Set(prev)
    n.has(bu) ? n.delete(bu) : n.add(bu)
    return n
  })

  const limparFiltros = () => { setFiltroStatus('ALL'); setFiltroBU(new Set()); setFiltroDestaque('ALL'); setFiltroAbc('ALL'); setBusca('') }

  // Contagem de selecionados por BU
  const selPorBU = useMemo(() => {
    const m = {}
    itensSel.forEach(i => { m[i.cd_secao] = (m[i.cd_secao] || 0) + 1 })
    return m
  }, [itensSel])

  // ── Vistas alternativas ───────────────────────────────────────────────────────
  if (vista === 'pedido') return <GerarPedido itens={itensSel} onVoltar={() => setVista('lista')} />
  if (vista === 'cadastro') return <RelatorioCadastro itens={nuncaComprouSel} onVoltar={() => setVista('lista')} />

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]" />
      <p className="text-sm text-gray-400">Carregando portfólio...</p>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">{error}</div>
  )

  const pctGeral = totais.total > 0 ? Math.round((totais.positivado / totais.total) * 100) : 0

  return (
    <div className="space-y-4">

      {/* ── 1. Cards de BU — visão geral + filtro ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.keys(BU).map(bu =>
          statsBU[bu] ? (
            <BUCard
              key={bu}
              buKey={bu}
              stats={statsBU[bu]}
              ativo={filtroBU.has(bu)}
              onFiltrar={() => toggleBU(bu)}
              meta={metasBU[bu]}
            />
          ) : null
        )}
      </div>

      {/* ── 2. Barra de progresso geral ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#1e3a5f]">{pctGeral}%</span>
            <span className="text-sm text-gray-500">positivado</span>
          </div>
          <div className="text-xs text-gray-400 text-right">
            <strong className="text-emerald-600">{totais.positivado.toLocaleString('pt-BR')}</strong>
            {' de '}
            <strong>{totais.total.toLocaleString('pt-BR')}</strong>
            {' EANs · mín. '}
            <strong>{data?.n_lojas} × 3 = {data?.minimo} un</strong>
          </div>
        </div>
        <Bar valor={totais.positivado} total={totais.total} cor="#10b981" h="h-3" />
        <div className="flex flex-wrap gap-5 mt-3">
          {Object.entries(STATUS).map(([key, s]) => (
            <button key={key} onClick={() => setFiltroStatus(filtroStatus === key ? 'ALL' : key)}
              className={`flex items-center gap-1.5 text-xs transition-all rounded px-1 py-0.5 ${filtroStatus === key ? 'ring-2 ring-offset-1' : 'hover:opacity-70'}`}
              style={filtroStatus === key ? { ringColor: s.cor } : {}}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.cor }} />
              <span className="text-gray-600">{s.label}</span>
              <strong className="text-gray-800">{totais[key]}</strong>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Painel de filtros ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 space-y-3">

        {/* BU: pills + botão ⊕ para selecionar todos da BU */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">BU</span>
          <button onClick={() => setFiltroBU(new Set())}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroBU.size === 0 ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            Todas
          </button>
          {Object.entries(BU).map(([key, cfg]) => {
            if (!statsBU[key]) return null
            const qtdSel = selPorBU[key] || 0
            // Total selecionável desta BU (excluindo nunca_comprou quando sem filtro explícito)
            const totalSelecionavel = itens.filter(i => i.cd_secao.trim() === key && isSelecionavel(i)).length
            const todosSelBU = totalSelecionavel > 0 && qtdSel >= totalSelecionavel
            const ativoBU = filtroBU.has(key)
            return (
              <div key={key} className="flex items-center gap-0.5">
                <button
                  onClick={() => toggleBU(key)}
                  className={`px-3 py-1.5 rounded-l-full text-xs font-medium border-y border-l transition-colors ${ativoBU ? 'text-white border-transparent' : `${cfg.badge} border-transparent hover:opacity-80`}`}
                  style={ativoBU ? { backgroundColor: cfg.cor, borderColor: cfg.cor } : {}}
                >
                  {cfg.short} · {statsBU[key]?.positivado}/{statsBU[key]?.total}
                </button>
                <button
                  onClick={() => selecionarBU(key)}
                  title={todosSelBU ? `Desmarcar todos de ${cfg.label}` : `Selecionar todos de ${cfg.label}`}
                  className={`px-2 py-1.5 border-y text-xs font-bold transition-all ${
                    todosSelBU ? 'text-white' : qtdSel > 0 ? 'text-white' : 'text-gray-500 hover:text-gray-700'
                  } ${ativoBU ? 'border-transparent' : `${cfg.borda} border`}`}
                  style={qtdSel > 0 ? { backgroundColor: cfg.cor, borderColor: cfg.cor } : ativoBU ? { backgroundColor: cfg.cor + '40', borderColor: 'transparent' } : {}}
                >
                  {qtdSel > 0 ? qtdSel : '⊕'}
                </button>
                <button
                  onClick={() => sugerirCompraBU(key)}
                  title={`Sugerir compra: seleciona os EANs do sortimento ainda não positivados de ${cfg.label}`}
                  className={`px-2 py-1.5 rounded-r-full border-y border-r text-xs font-bold transition-all text-amber-600 hover:bg-amber-50 ${
                    ativoBU ? 'border-transparent' : `${cfg.borda} border`
                  }`}
                >
                  💡
                </button>
              </div>
            )
          })}
        </div>

        {/* Status: pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">Status</span>
          <button onClick={() => setFiltroStatus('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroStatus === 'ALL' ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            Todos ({totais.total})
          </button>
          {Object.entries(STATUS).map(([key, s]) => (
            <button key={key}
              onClick={() => setFiltroStatus(filtroStatus === key ? 'ALL' : key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroStatus === key ? 'text-white border-transparent' : `${s.pill} border-transparent hover:opacity-80`}`}
              style={filtroStatus === key ? { backgroundColor: s.cor } : {}}
            >
              {s.label} ({totais[key]})
            </button>
          ))}
        </div>

        {/* Destaque: pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">Destaque</span>
          <button onClick={() => setFiltroDestaque(filtroDestaque === 'sortimento' ? 'ALL' : 'sortimento')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtroDestaque === 'sortimento' ? 'bg-violet-500 text-white border-violet-500' : 'bg-violet-50 text-violet-700 border-transparent hover:opacity-80'
            }`}>
            Sortimento ({contagemDestaque.sortimento})
          </button>
          <button onClick={() => setFiltroDestaque(filtroDestaque === 'novo' ? 'ALL' : 'novo')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filtroDestaque === 'novo' ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-700 border-transparent hover:opacity-80'
            }`}>
            Produtos Novos ({contagemDestaque.novo})
          </button>
        </div>

        {/* Curva ABC: pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">Curva ABC</span>
          {[
            { key: 'A', ativoCls: 'bg-emerald-500 text-white border-emerald-500', inativoCls: 'bg-emerald-50 text-emerald-700' },
            { key: 'B', ativoCls: 'bg-amber-500 text-white border-amber-500',     inativoCls: 'bg-amber-50 text-amber-700' },
            { key: 'C', ativoCls: 'bg-gray-500 text-white border-gray-500',       inativoCls: 'bg-gray-100 text-gray-700' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltroAbc(filtroAbc === f.key ? 'ALL' : f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filtroAbc === f.key ? f.ativoCls : `${f.inativoCls} border-transparent hover:opacity-80`
              }`}>
              Curva {f.key} ({contagemAbc[f.key]})
            </button>
          ))}
        </div>

        {/* Busca + limpar */}
        <div className="flex gap-2 items-center">
          <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">Busca</span>
          <div className="relative max-w-sm flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input ref={buscaRef} type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Produto ou EAN..." className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30" />
            {busca && (
              <button onClick={() => { setBusca(''); buscaRef.current?.focus() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            )}
          </div>
          {temFiltro && (
            <button onClick={limparFiltros}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpar filtros
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
            {itensFiltrados.length} de {itens.length} EANs
          </span>
        </div>

        {/* Chips de filtros ativos */}
        {temFiltro && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-50">
            <span className="text-xs text-gray-400">Filtros ativos:</span>
            {filtroStatus !== 'ALL' && (
              <FilterChip
                label={STATUS[filtroStatus]?.label}
                cor={STATUS[filtroStatus]?.cor}
                onRemove={() => setFiltroStatus('ALL')}
              />
            )}
            {[...filtroBU].map(bu => (
              <FilterChip
                key={bu}
                label={BU[bu]?.label}
                cor={BU[bu]?.cor}
                onRemove={() => toggleBU(bu)}
              />
            ))}
            {filtroDestaque !== 'ALL' && (
              <FilterChip
                label={filtroDestaque === 'sortimento' ? 'Sortimento' : 'Produtos Novos'}
                cor={filtroDestaque === 'sortimento' ? '#8b5cf6' : '#f97316'}
                onRemove={() => setFiltroDestaque('ALL')}
              />
            )}
            {filtroAbc !== 'ALL' && (
              <FilterChip
                label={`Curva ${filtroAbc}`}
                cor={filtroAbc === 'A' ? '#059669' : filtroAbc === 'B' ? '#d97706' : '#6b7280'}
                onRemove={() => setFiltroAbc('ALL')}
              />
            )}
            {busca && (
              <FilterChip
                label={`"${busca}"`}
                cor="#64748b"
                onRemove={() => setBusca('')}
              />
            )}
          </div>
        )}
      </div>

      {/* ── 4. Barra de ação flutuante ───────────────────────────────────────── */}
      {sel.size > 0 && (
        <div className="sticky bottom-4 z-20">
          <div className="bg-[#1e3a5f] text-white rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-4 border border-white/10 backdrop-blur">
            {/* Contagem + BUs */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">
                {sel.size} produto{sel.size > 1 ? 's' : ''} selecionado{sel.size > 1 ? 's' : ''}
                {itensSelOcultos.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-yellow-300">
                    ⚠ {itensSelOcultos.length} oculto{itensSelOcultos.length > 1 ? 's' : ''} pelo filtro
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {Object.entries(BU).map(([buKey, cfg]) => {
                  const n = selPorBU[buKey] || 0
                  return n > 0 ? (
                    <span key={buKey} className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: cfg.cor + '30', color: '#fff' }}>
                      {cfg.short} {n}
                    </span>
                  ) : null
                })}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {itensSelOcultos.length > 0 && (
                <button onClick={limparFiltros}
                  className="text-yellow-300 hover:text-yellow-100 text-xs border border-yellow-300/40 px-2.5 py-1.5 rounded-lg transition-colors">
                  Mostrar todos
                </button>
              )}
              <button onClick={() => setSel(new Set())}
                className="text-white bg-white/20 hover:bg-white/30 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium border border-white/30">
                ✕ Limpar seleção
              </button>
              {nuncaComprouSel.length > 0 && (
                <button onClick={() => setVista('cadastro')}
                  className="bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Cadastro ({nuncaComprouSel.length})
                </button>
              )}
              <button onClick={() => setVista('pedido')}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Gerar Pedido ({sel.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Tabela ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-3 py-3 w-10">
                  <div onClick={toggleTodosVisiveis}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer mx-auto transition-all ${
                      todosFiltradosSel ? 'bg-[#1e3a5f] border-[#1e3a5f]' :
                      algumFiltradoSel ? 'bg-slate-300 border-slate-300' : 'border-gray-300 hover:border-[#1e3a5f]'
                    }`}>
                    {todosFiltradosSel && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                    {!todosFiltradosSel && algumFiltradoSel && <div className="w-2 h-0.5 bg-white rounded"/>}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">EAN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Produto</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">BU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Vendido / Mínimo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {itensFiltrados.map(item => {
                const s = STATUS[item.status]
                const buCfg = BU[item.cd_secao]
                const checked = sel.has(item.ean)
                return (
                  <tr key={item.ean} onClick={() => toggleItem(item.ean)}
                    className={`border-l-4 cursor-pointer select-none transition-colors ${s.borda} ${
                      checked ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                    }`}>
                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked} onChange={() => toggleItem(item.ean)}
                        className="rounded border-gray-300 text-[#1e3a5f] focus:ring-[#1e3a5f] cursor-pointer" />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.ean}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-1.5">
                        {(item.is_novo || item.is_sortimento) && (
                          <span className="flex items-center gap-0.5 shrink-0" title={
                            item.is_novo && item.is_sortimento ? 'Produto novo + Sortimento' :
                            item.is_novo ? 'Produto novo (cadastrado há < 2 meses)' : 'Produto do Sortimento'
                          }>
                            {item.is_novo && <span className="w-1.5 h-4 rounded-full bg-orange-500" />}
                            {item.is_sortimento && <span className="w-1.5 h-4 rounded-full bg-violet-500" />}
                          </span>
                        )}
                        <CurvaAbcBadge curva={item.curva_abc} />
                        <div className="truncate font-medium text-gray-800" title={item.produto}>{item.produto}</div>
                      </div>
                      {item.fator_caixa > 1 && <div className="text-xs text-gray-400 mt-0.5">{item.fator_caixa} un/cx</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {buCfg && <span className={`px-2 py-0.5 rounded text-xs font-bold ${buCfg.badge}`}>{buCfg.short}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <MiniBar vendido={item.unidades_vendidas} minimo={item.minimo} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.pill}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.cor }} />
                        {s.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {itensFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="text-4xl text-gray-200 mb-3">◎</div>
                    <div className="text-gray-400 font-medium">Nenhum produto encontrado</div>
                    {temFiltro && (
                      <button onClick={limparFiltros} className="mt-3 text-sm text-[#1e3a5f] hover:underline font-medium">
                        Limpar filtros
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-400 flex justify-between items-center">
          <span>
            {itensFiltrados.length} de {itens.length} EANs exibidos
            {sel.size > 0 && <> · <strong className="text-[#1e3a5f]">{sel.size} selecionados</strong></>}
          </span>
          <span className="text-gray-300 hidden md:block">
            Clique na linha ou no ⊕ da BU para selecionar
          </span>
        </div>
      </div>
    </div>
  )
}
