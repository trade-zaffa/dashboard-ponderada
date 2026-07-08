import { useEffect, useState, useMemo } from 'react'
import { adminGetClientes, adminGetSortimentoResumo, adminGetMetas, getSortimento, adminGetSenhas, adminSetSenha, adminDeleteSenha, adminGetProgramaExecucao, adminSetProgramaExecucao, adminGetProgramaResumo, getPrograma, adminGetPedidosAbertosMes, adminGetPedidosFaturadosMes, adminGetEstoque, adminGetSortimentoEans, adminAddSortimentoEans, adminDeleteSortimentoEan } from '../api'
import * as XLSX from 'xlsx'
import PedidosInterativos from '../components/PedidosInterativos'
import GerarPedido from '../components/GerarPedido'
import RelatorioCadastro from '../components/RelatorioCadastro'
import MetasAdmin from '../components/MetasAdmin'

const BU_LABELS = { AL_NUT: 'NT', HGPER_BB: 'BW', LMP_CASA: 'HC', LMP_CUPE: 'PC' }
const BU_FULL = { AL_NUT: 'Nutrição', HGPER_BB: 'Beleza e Bem-Estar', LMP_CASA: 'Cuidados Dom.', LMP_CUPE: 'Cuidados Pessoais' }
const BU_FULL_LONG = { AL_NUT: 'NT - Nutrição', HGPER_BB: 'BW - Beleza e Bem-Estar', LMP_CASA: 'HC - Cuidados Dom.', LMP_CUPE: 'PC - Cuidados Pessoais' }
const BUS = ['AL_NUT', 'HGPER_BB', 'LMP_CASA', 'LMP_CUPE']

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const STATUS_META = {
  positivado:    { label: 'Positivado',    cor: 'bg-emerald-500', texto: 'text-emerald-700', fundo: 'bg-emerald-50' },
  em_progresso:  { label: 'Em Progresso',  cor: 'bg-amber-400',   texto: 'text-amber-700',   fundo: 'bg-amber-50' },
  pendente:      { label: 'Pendente',      cor: 'bg-gray-400',    texto: 'text-gray-600',    fundo: 'bg-gray-50' },
  nunca_comprou: { label: 'Nunca Comprou', cor: 'bg-purple-500',  texto: 'text-purple-700',  fundo: 'bg-purple-50' },
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

function AlertaDiasBadge({ dias, alerta }) {
  if (!alerta) return null
  const cfg = alerta === 'vermelho'
    ? { icone: '🔴', cls: 'bg-red-100 text-red-700' }
    : { icone: '🟡', cls: 'bg-amber-100 text-amber-700' }
  return (
    <span title={`${dias} dias sem comprar este item`}
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${cfg.cls}`}>
      {cfg.icone} {dias}d
    </span>
  )
}

function PctColor(pct) {
  if (pct >= 70) return 'text-emerald-600'
  if (pct >= 40) return 'text-amber-600'
  return 'text-red-500'
}

function BarColor(pct) {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-amber-400'
  return 'bg-red-400'
}

function exportarExcel(itens, nomeCliente) {
  const dados = itens.map(i => ({
    EAN: i.ean,
    'Cód. Fabricante': i.cod_fabricante || '',
    DUN: i.dun || '',
    NCM: i.ncm || '',
    Produto: i.produto,
    BU: i.cd_secao,
    'Fator/Caixa': i.fator_caixa,
    'Vendido (un)': i.unidades_vendidas,
    'Mínimo (un)': i.minimo,
    Status: STATUS_META[i.status]?.label || i.status,
  }))
  const ws = XLSX.utils.json_to_sheet(dados)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sortimento')
  XLSX.writeFile(wb, `Sortimento_${nomeCliente.replace(/\s+/g, '_')}.xlsx`)
}

function exportarPedidoCompra(itens, nomeCliente) {
  const naoComprou = itens.filter(i => i.status === 'nunca_comprou' || i.status === 'pendente')
  const dados = naoComprou.map(i => ({
    EAN: i.ean,
    'Cód. Fabricante': i.cod_fabricante || '',
    DUN: i.dun || '',
    NCM: i.ncm || '',
    Produto: i.produto,
    BU: i.cd_secao,
    'Fator/Caixa': i.fator_caixa,
    'Qtde Mínima (un)': i.minimo,
    'Qtde Sugerida (cx)': Math.ceil(i.minimo / (i.fator_caixa || 1)),
    Status: STATUS_META[i.status]?.label || i.status,
  }))
  const ws = XLSX.utils.json_to_sheet(dados)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido de Compra')
  XLSX.writeFile(wb, `Pedido_Compra_${nomeCliente.replace(/\s+/g, '_')}.xlsx`)
}


// ─── Detalhe completo do cliente (Sortimento + Programa) ──────────────────
const BU_COR_D  = { LMP_CASA: '#3b82f6', AL_NUT: '#22c55e', LMP_CUPE: '#ec4899', HGPER_BB: '#a855f7' }
const BU_SHORT_D = { LMP_CASA: 'HC', AL_NUT: 'NT', LMP_CUPE: 'PC', HGPER_BB: 'BW' }
const BU_NOME_D  = { LMP_CASA: 'Home Care', AL_NUT: 'Nutrição', LMP_CUPE: 'Personal Care', HGPER_BB: 'Beleza' }

function ProgramaClienteAdmin({ cliente, periodo }) {
  const [dados, setDados]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro]       = useState('')

  useEffect(() => {
    setLoading(true)
    setErro('')
    getPrograma(cliente.cd_cliens, cliente.cnpj_raiz, periodo.mes, periodo.ano)
      .then(r => setDados(r.data))
      .catch(e => setErro(e.response?.data?.detail || 'Erro ao carregar programa'))
      .finally(() => setLoading(false))
  }, [cliente, periodo])

  const fmtR = (v) => {
    if (!v) return 'R$ 0'
    if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(2)}M`
    if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(1)}K`
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-8 text-gray-400 justify-center">
      <div className="w-4 h-4 border-2 border-[#c9a227] border-t-transparent rounded-full animate-spin" />
      Calculando Programa...
    </div>
  )
  if (erro) return <p className="text-red-500 text-sm py-4">{erro}</p>
  if (!dados) return null

  const META_PCT = dados.crescimento_pct

  const totalMetaFat = dados.bus.reduce((s, b) => s + b.meta_fat, 0)

  return (
    <div className="space-y-4">
      {/* KPIs do programa */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">Meta total (todas BUs)</p>
          <p className="text-white text-xl font-bold">{fmtR(totalMetaFat)}</p>
          <p className="text-gray-500 text-[10px] mt-1">base {periodo.ano - 1} + 15%</p>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">Potencial máximo (2,5%)</p>
          <p className="text-gray-300 text-xl font-bold">{fmtR(dados.total_potencial)}</p>
          <p className="text-gray-500 text-[10px] mt-1">= 2,5% × {fmtR(totalMetaFat)}</p>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">Ganho estimado</p>
          <p className="text-[#c9a227] text-xl font-bold">{fmtR(dados.total_ganho)}</p>
          <p className="text-gray-500 text-[10px] mt-1">
            {totalMetaFat > 0 ? (dados.total_ganho / totalMetaFat * 100).toFixed(2) : '0,00'}% da meta total
          </p>
        </div>
        <div className="bg-[#1a1a2e] rounded-xl p-4 text-center">
          <p className="text-gray-400 text-xs mb-1">Ponto Extra · Planograma</p>
          <p className={`text-xl font-bold ${dados.ponto_extra && dados.planograma ? 'text-emerald-400' : 'text-amber-400'}`}>
            {dados.ponto_extra ? '✓' : '○'} PE &nbsp; {dados.planograma ? '✓' : '○'} Plan.
          </p>
          <p className="text-gray-500 text-[10px] mt-1">0,50% cada</p>
        </div>
      </div>

      {/* Tabela por BU */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Acompanhamento por BU — {MESES[periodo.mes-1]} {periodo.ano}</p>
        </div>
        <div className="divide-y divide-gray-50">
          {dados.bus.map(bu => {
            const fatColor = bu.fat_pct >= 100 ? '#22c55e' : bu.fat_pct >= 70 ? '#f59e0b' : '#ef4444'
            const sortColor = bu.sort_pct >= 92 ? '#22c55e' : bu.sort_pct >= 70 ? '#f59e0b' : '#ef4444'
            return (
              <div key={bu.cd_secao} className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: BU_COR_D[bu.cd_secao] }}>
                      {BU_SHORT_D[bu.cd_secao]}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">{BU_NOME_D[bu.cd_secao]}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#c9a227]">{fmtR(bu.ganho_bu)}</span>
                    <span className="text-xs text-gray-400 ml-1">ganho</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Faturamento */}
                  <div className="grid grid-cols-[70px_1fr_80px_120px] items-center gap-3">
                    <span className="text-xs text-gray-500 font-medium">Faturamento</span>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, bu.fat_pct)}%`, backgroundColor: fatColor }} />
                    </div>
                    <span className="text-sm font-bold text-right" style={{ color: fatColor }}>{bu.fat_pct}%</span>
                    <span className="text-xs text-gray-400 text-right">
                      {fmtR(bu.fat_atual)} / {fmtR(bu.meta_fat)}
                    </span>
                  </div>

                  {/* Sortimento */}
                  <div className="grid grid-cols-[70px_1fr_80px_120px] items-center gap-3">
                    <span className="text-xs text-gray-500 font-medium">Sortimento</span>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, bu.sort_pct)}%`, backgroundColor: sortColor }} />
                      <div className="absolute top-0 h-full w-px bg-amber-400 opacity-60" style={{ left: '70%' }} title="Meta 70%" />
                      <div className="absolute top-0 h-full w-px bg-emerald-500 opacity-60" style={{ left: '92%' }} title="Meta 92%" />
                    </div>
                    <span className="text-sm font-bold text-right" style={{ color: sortColor }}>{bu.sort_pct}%</span>
                    <span className="text-xs text-gray-400 text-right">
                      {bu.sort_positivado} / {bu.meta_eans || bu.sort_total} EANs (meta)
                    </span>
                  </div>

                  {/* Meta base */}
                  <p className="text-[10px] text-gray-400 pl-[82px]">
                    Base: {fmtR(bu.fat_ano_anterior)} ({periodo.ano - 1}) + {META_PCT}% → meta {fmtR(bu.meta_fat)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DetalheCliente({ cliente, periodo, token, onVoltar }) {
  const [abaDetalhe, setAbaDetalhe] = useState('sortimento')
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1e3a5f] text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={onVoltar}
            className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm transition-colors">
            ← Voltar
          </button>
          <span className="text-lg font-bold">{cliente.nome}</span>
          <span className="ml-auto text-blue-200 text-sm">{MESES[periodo.mes - 1]} {periodo.ano}</span>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0">
          {[['sortimento', 'Sortimento'], ['programa', 'Programa Ponderada']].map(([id, label]) => (
            <button key={id} onClick={() => setAbaDetalhe(id)}
              className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                abaDetalhe === id ? 'bg-gray-50 text-[#1e3a5f]' : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}>{label}</button>
          ))}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {abaDetalhe === 'sortimento' && (
          <SortimentoCliente cliente={cliente} periodo={periodo} onVoltar={onVoltar} hideHeader />
        )}
        {abaDetalhe === 'programa' && (
          <ProgramaClienteAdmin cliente={cliente} periodo={periodo} />
        )}
      </main>
    </div>
  )
}

// ─── Relatório de Sortimento de um Cliente ─────────────────────────────────
function SortimentoCliente({ cliente, periodo, onVoltar, hideHeader }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subTab, setSubTab] = useState('sortimento')
  const [filtroBU, setFiltroBU] = useState('ALL')
  const [filtroStatus, setFiltroStatus] = useState('ALL')
  const [filtroDestaque, setFiltroDestaque] = useState('ALL') // 'ALL' | 'sortimento' | 'novo'
  const [filtroAbc, setFiltroAbc] = useState('ALL') // 'ALL' | 'A' | 'B' | 'C'
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState(new Set())
  const [vista, setVista] = useState('lista') // 'lista' | 'pedido' | 'cadastro'

  useEffect(() => {
    setLoading(true)
    setError('')
    getSortimento(cliente.cd_cliens, cliente.total_lojas, periodo)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [cliente, periodo])

  const itens = data?.itens || []

  const contagem = useMemo(() => {
    const c = { positivado: 0, em_progresso: 0, pendente: 0, nunca_comprou: 0 }
    itens.forEach(i => { if (c[i.status] !== undefined) c[i.status]++ })
    return c
  }, [itens])

  const contagemBU = useMemo(() => {
    const c = {}
    BUS.forEach(bu => { c[bu] = { total: 0, positivado: 0 } })
    itens.forEach(i => {
      if (c[i.cd_secao]) {
        c[i.cd_secao].total++
        if (i.status === 'positivado') c[i.cd_secao].positivado++
      }
    })
    return c
  }, [itens])

  const itensFiltrados = useMemo(() => itens.filter(i => {
    if (filtroBU !== 'ALL' && i.cd_secao.trim() !== filtroBU) return false
    if (filtroStatus !== 'ALL' && i.status !== filtroStatus) return false
    if (filtroDestaque === 'sortimento' && !i.is_sortimento) return false
    if (filtroDestaque === 'novo' && !i.is_novo) return false
    if (filtroAbc !== 'ALL' && i.curva_abc !== filtroAbc) return false
    if (busca && !(i.produto || '').toLowerCase().includes(busca.toLowerCase()) && !(i.ean || '').includes(busca)) return false
    return true
  }), [itens, filtroBU, filtroStatus, filtroDestaque, filtroAbc, busca])

  const contagemAbc = useMemo(() => ({
    A: itens.filter(i => i.curva_abc === 'A').length,
    B: itens.filter(i => i.curva_abc === 'B').length,
    C: itens.filter(i => i.curva_abc === 'C').length,
  }), [itens])

  const contagemDestaque = useMemo(() => ({
    sortimento: itens.filter(i => i.is_sortimento).length,
    novo: itens.filter(i => i.is_novo).length,
  }), [itens])

  const itensSel = itens.filter(i => sel.has(i.ean))
  const itensSelOcultos = itensSel.filter(i => !itensFiltrados.find(f => f.ean === i.ean))
  const temFiltro = filtroBU !== 'ALL' || filtroStatus !== 'ALL' || filtroDestaque !== 'ALL' || filtroAbc !== 'ALL' || busca !== ''

  const limparFiltros = () => { setFiltroBU('ALL'); setFiltroStatus('ALL'); setFiltroDestaque('ALL'); setFiltroAbc('ALL'); setBusca('') }

  const todosSelecionados = itensFiltrados.length > 0 && itensFiltrados.every(i => sel.has(i.ean))

  const toggleTodos = () => {
    setSel(prev => {
      const next = new Set(prev)
      if (todosSelecionados) itensFiltrados.forEach(i => next.delete(i.ean))
      else itensFiltrados.forEach(i => next.add(i.ean))
      return next
    })
  }

  const toggleItem = (ean) => {
    setSel(prev => {
      const next = new Set(prev)
      if (next.has(ean)) next.delete(ean)
      else next.add(ean)
      return next
    })
  }

  const selecionarBU = (buKey) => {
    const buItens = itens.filter(i => i.cd_secao.trim() === buKey)
    const todosSelBU = buItens.length > 0 && buItens.every(i => sel.has(i.ean))
    setSel(prev => {
      const next = new Set(prev)
      if (todosSelBU) buItens.forEach(i => next.delete(i.ean))
      else buItens.forEach(i => next.add(i.ean))
      return next
    })
  }

  const buBreakdown = {}
  itensSel.forEach(i => {
    const short = BU_LABELS[i.cd_secao] || i.cd_secao
    buBreakdown[short] = (buBreakdown[short] || 0) + 1
  })

  const BU_BADGE = {
    LMP_CASA: 'bg-blue-100 text-blue-700',
    AL_NUT:   'bg-green-100 text-green-700',
    LMP_CUPE: 'bg-pink-100 text-pink-700',
    HGPER_BB: 'bg-purple-100 text-purple-700',
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]"></div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-8 text-center">
      {error}
      <button onClick={onVoltar} className="block mx-auto mt-4 text-sm underline">← Voltar</button>
    </div>
  )

  if (vista === 'pedido') return (
    <GerarPedido itens={itensSel} onVoltar={() => setVista('lista')} />
  )
  if (vista === 'cadastro') {
    const itensCadastro = itensSel.filter(i => i.status === 'nunca_comprou')
    return <RelatorioCadastro itens={itensCadastro} onVoltar={() => setVista('lista')} />
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      {!hideHeader && (
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{cliente.nome}</h2>
          <p className="text-gray-500 text-sm">
            {cliente.total_lojas} lojas · mínimo {data?.minimo} un/EAN ·{' '}
            <span className="font-medium text-[#1e3a5f]">
              {MESES[(periodo?.mes || new Date().getMonth() + 1) - 1]} {periodo?.ano || new Date().getFullYear()}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportarExcel(itensFiltrados, cliente.nome)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            📊 Excel
          </button>
          <button onClick={() => window.print()}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            🖨 PDF
          </button>
          <button onClick={onVoltar}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            ← Voltar
          </button>
        </div>
      </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 print:hidden">
        {[['sortimento', 'Sortimento'], ['pedidos', 'Pedidos em Aberto']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              subTab === id ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === 'pedidos' && (
        <PedidosInterativos session={{ cd_cliens: cliente.cd_cliens, nome: cliente.nome, total_lojas: cliente.total_lojas }} />
      )}

      {subTab === 'sortimento' && (
        <>
          {/* BU Cards */}
          <div className="grid grid-cols-4 gap-3 print:hidden">
            {BUS.map(bu => {
              const d = contagemBU[bu] || { total: 0, positivado: 0 }
              const pct = d.total > 0 ? Math.round(d.positivado / d.total * 100) : 0
              const ativo = filtroBU === bu
              return (
                <button key={bu} onClick={() => setFiltroBU(ativo ? 'ALL' : bu)}
                  className={`rounded-xl p-4 text-left border-2 transition-all cursor-pointer ${
                    ativo ? 'border-[#1e3a5f] shadow-md bg-white' : 'border-transparent hover:border-gray-200 bg-white shadow-sm'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${BU_BADGE[bu] || 'bg-gray-100 text-gray-600'}`}>
                      {BU_LABELS[bu]}
                    </span>
                    <span className={`text-sm font-bold ${PctColor(pct)}`}>{pct}%</span>
                  </div>
                  <div className="text-xs text-gray-400 mb-2 truncate">{BU_FULL[bu]}</div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${BarColor(pct)}`} style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5">{d.positivado}/{d.total} EANs</div>
                  {ativo && <div className="text-xs text-[#1e3a5f] mt-1 font-medium">Filtro ativo · clique para remover</div>}
                </button>
              )
            })}
          </div>

          {/* Painel de filtros */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 space-y-3 print:hidden">
            {/* Status pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-14 shrink-0">Status</span>
              {[
                { key: 'ALL',          label: 'Todos',        count: itens.length,          cls: 'bg-gray-100 text-gray-600' },
                { key: 'positivado',   label: 'Positivado',   count: contagem.positivado,   cls: 'bg-emerald-100 text-emerald-700' },
                { key: 'em_progresso', label: 'Em Progresso', count: contagem.em_progresso, cls: 'bg-amber-100 text-amber-700' },
                { key: 'pendente',     label: 'Pendente',     count: contagem.pendente,     cls: 'bg-slate-100 text-slate-600' },
                { key: 'nunca_comprou',label: 'Nunca Comprou',count: contagem.nunca_comprou,cls: 'bg-violet-100 text-violet-700' },
              ].map(f => (
                <button key={f.key}
                  onClick={() => setFiltroStatus(filtroStatus === f.key ? 'ALL' : f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border-2 ${
                    filtroStatus === f.key ? 'border-[#1e3a5f] shadow-sm' : 'border-transparent'
                  } ${f.cls}`}>
                  {f.label} <span className="opacity-60">({f.count})</span>
                </button>
              ))}
            </div>

            {/* Destaque pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-14 shrink-0">Destaque</span>
              {[
                { key: 'sortimento', label: 'Sortimento', count: contagemDestaque.sortimento, cls: 'bg-violet-100 text-violet-700' },
                { key: 'novo',       label: 'Produtos Novos', count: contagemDestaque.novo,    cls: 'bg-orange-100 text-orange-700' },
              ].map(f => (
                <button key={f.key}
                  onClick={() => setFiltroDestaque(filtroDestaque === f.key ? 'ALL' : f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border-2 ${
                    filtroDestaque === f.key ? 'border-[#1e3a5f] shadow-sm' : 'border-transparent'
                  } ${f.cls}`}>
                  {f.label} <span className="opacity-60">({f.count})</span>
                </button>
              ))}
            </div>

            {/* Curva ABC pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-14 shrink-0">Curva ABC</span>
              {[
                { key: 'A', cls: 'bg-emerald-100 text-emerald-700' },
                { key: 'B', cls: 'bg-amber-100 text-amber-700' },
                { key: 'C', cls: 'bg-gray-200 text-gray-700' },
              ].map(f => (
                <button key={f.key}
                  onClick={() => setFiltroAbc(filtroAbc === f.key ? 'ALL' : f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border-2 ${
                    filtroAbc === f.key ? 'border-[#1e3a5f] shadow-sm' : 'border-transparent'
                  } ${f.cls}`}>
                  Curva {f.key} <span className="opacity-60">({contagemAbc[f.key]})</span>
                </button>
              ))}
            </div>

            {/* Busca + seleção BU */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400 w-14 shrink-0">Busca</span>
              <div className="relative">
                <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="EAN ou produto..."
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] w-52 pr-7" />
                {busca && (
                  <button onClick={() => setBusca('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
                )}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-gray-400 mr-1">Sel. BU:</span>
                {BUS.map(bu => {
                  const buItens = itens.filter(i => i.cd_secao === bu)
                  const todosBU = buItens.length > 0 && buItens.every(i => sel.has(i.ean))
                  return (
                    <button key={bu} onClick={() => selecionarBU(bu)}
                      title={`Selecionar todos de ${BU_FULL[bu]}`}
                      className={`px-2 py-1 rounded text-xs font-bold border transition-colors ${
                        todosBU ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                      }`}>
                      {BU_LABELS[bu]} ⊕
                    </button>
                  )
                })}
                {temFiltro && (
                  <button onClick={limparFiltros} className="ml-2 text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap">
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {temFiltro && (
            <div className="flex gap-2 flex-wrap items-center print:hidden">
              {filtroBU !== 'ALL' && (
                <span className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-1.5 rounded-full">
                  BU: {BU_LABELS[filtroBU]}
                  <button onClick={() => setFiltroBU('ALL')} className="hover:text-blue-900 font-bold">✕</button>
                </span>
              )}
              {filtroStatus !== 'ALL' && (
                <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${STATUS_META[filtroStatus]?.fundo} ${STATUS_META[filtroStatus]?.texto}`}>
                  {STATUS_META[filtroStatus]?.label}
                  <button onClick={() => setFiltroStatus('ALL')} className="font-bold opacity-70 hover:opacity-100">✕</button>
                </span>
              )}
              {filtroDestaque !== 'ALL' && (
                <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
                  filtroDestaque === 'sortimento' ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-orange-50 border-orange-200 text-orange-700'
                }`}>
                  {filtroDestaque === 'sortimento' ? 'Sortimento' : 'Produtos Novos'}
                  <button onClick={() => setFiltroDestaque('ALL')} className="font-bold opacity-70 hover:opacity-100">✕</button>
                </span>
              )}
              {filtroAbc !== 'ALL' && (
                <span className="flex items-center gap-1.5 bg-gray-100 border border-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded-full">
                  Curva {filtroAbc}
                  <button onClick={() => setFiltroAbc('ALL')} className="font-bold opacity-70 hover:opacity-100">✕</button>
                </span>
              )}
              {busca && (
                <span className="flex items-center gap-1.5 bg-gray-100 border border-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded-full">
                  "{busca}"
                  <button onClick={() => setBusca('')} className="font-bold hover:text-gray-900">✕</button>
                </span>
              )}
              <span className="text-xs text-gray-400">{itensFiltrados.length} de {itens.length} EANs visíveis</span>
            </div>
          )}

          {/* Cabeçalho impressão */}
          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">{cliente.nome}</h1>
            <p className="text-gray-600">Sortimento Unilever — {new Date().toLocaleDateString('pt-BR')} · {cliente.total_lojas} lojas · mínimo {data?.minimo} un/EAN</p>
          </div>

          {/* Tabela */}
          <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border print:border-gray-300 ${sel.size > 0 ? 'mb-24' : ''}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-3 print:hidden">
                      <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos}
                        className="rounded border-gray-300 text-[#1e3a5f]" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">EAN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">BU</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Vendido</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Mín</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Cx</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estoque Matriz</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estoque Filial</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {itensFiltrados.map(item => {
                    const s = STATUS_META[item.status]
                    const isSel = sel.has(item.ean)
                    return (
                      <tr key={item.ean} onClick={() => toggleItem(item.ean)}
                        className={`transition-colors cursor-pointer border-l-2 ${
                          isSel
                            ? 'bg-blue-50 border-l-[#1e3a5f] hover:bg-blue-100'
                            : item.status === 'positivado'   ? 'border-l-emerald-400 hover:bg-gray-50'
                            : item.status === 'em_progresso' ? 'border-l-amber-400 hover:bg-gray-50'
                            : item.status === 'pendente'     ? 'border-l-gray-300 hover:bg-gray-50'
                            :                                  'border-l-violet-400 hover:bg-gray-50'
                        }`}>
                        <td className="px-3 py-2.5 print:hidden" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSel} onChange={() => toggleItem(item.ean)}
                            className="rounded border-gray-300 text-[#1e3a5f]" />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{item.ean}</td>
                        <td className="px-4 py-2.5 text-gray-800 max-w-xs">
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
                            <div className="truncate font-medium" title={item.produto}>{item.produto}</div>
                            <AlertaDiasBadge dias={item.dias_sem_comprar} alerta={item.alerta_estoque} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{BU_LABELS[item.cd_secao]} — {BU_FULL[item.cd_secao]}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs font-semibold text-gray-800">
                          {item.unidades_vendidas.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{item.minimo}</td>
                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{item.fator_caixa}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-gray-600">
                          {(item.estoque_matriz ?? 0).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-gray-600">
                          {(item.estoque_filial ?? 0).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s?.fundo} ${s?.texto}`}>
                            {s?.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {itensFiltrados.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">Nenhum item encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 print:hidden">
              {itensFiltrados.length} de {itens.length} EANs · {sel.size} selecionados
            </div>
          </div>

          {/* Floating Action Bar */}
          {sel.size > 0 && (
            <div className="fixed bottom-4 left-0 right-0 z-20 flex justify-center px-4 print:hidden">
              <div className="bg-[#1e3a5f] text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 max-w-3xl w-full">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">
                    {sel.size} produto{sel.size !== 1 ? 's' : ''} selecionado{sel.size !== 1 ? 's' : ''}
                  </div>
                  <div className="text-blue-300 text-xs mt-0.5 flex flex-wrap gap-1 items-center">
                    {Object.entries(buBreakdown).map(([k, v]) => (
                      <span key={k}>{k} {v}</span>
                    )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`dot-${i}`} className="opacity-40">·</span>, el], [])}
                    {itensSelOcultos.length > 0 && (
                      <span className="text-amber-300 ml-1">
                        · ⚠ {itensSelOcultos.length} oculto{itensSelOcultos.length !== 1 ? 's' : ''} pelo filtro{' '}
                        <button onClick={limparFiltros} className="underline hover:text-amber-200">mostrar todos</button>
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSel(new Set())}
                  className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm transition-colors shrink-0 font-medium border border-white/30">
                  ✕ Limpar seleção
                </button>
                {itensSel.some(i => i.status === 'nunca_comprou') && (
                  <button onClick={() => setVista('cadastro')}
                    className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium transition-colors shrink-0">
                    Cadastro ({itensSel.filter(i => i.status === 'nunca_comprou').length})
                  </button>
                )}
                <button onClick={() => setVista('pedido')}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors shrink-0">
                  Gerar Pedido ({sel.size})
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Gerenciamento do Programa ─────────────────────────────────────────────────
const BU_PROGRAMA = ['LMP_CASA', 'AL_NUT', 'LMP_CUPE', 'HGPER_BB']
const BU_LABELS_P = { LMP_CASA: 'HC · Home Care', AL_NUT: 'NT · Nutrição', LMP_CUPE: 'PC · Personal Care', HGPER_BB: 'BW · Beleza' }

function ProgramaAdmin({ token, clientes, periodo, onSelecionarCliente }) {
  const { mes, ano } = periodo
  const [execucao, setExecucao] = useState({})
  const [savingExec, setSavingExec] = useState({})
  const [resumo, setResumo] = useState([])
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [erroResumo, setErroResumo] = useState('')
  const [subTab, setSubTab] = useState('ranking')

  useEffect(() => {
    adminGetProgramaExecucao(token, mes, ano).then(r => setExecucao(r.data)).catch(() => {})
    setLoadingResumo(true)
    setErroResumo('')
    adminGetProgramaResumo(token, mes, ano)
      .then(r => setResumo(r.data))
      .catch(e => setErroResumo(e.response?.data?.detail || `Erro ${e.response?.status || ''}: ${e.message}`))
      .finally(() => setLoadingResumo(false))
  }, [token, mes, ano])

  const toggleExec = async (cnpj_raiz, campo) => {
    const atual = execucao[cnpj_raiz] || { ponto_extra: false, planograma: false }
    const novo = { ...atual, [campo]: !atual[campo] }
    setSavingExec(s => ({ ...s, [`${cnpj_raiz}-${campo}`]: true }))
    try {
      await adminSetProgramaExecucao(token, { cnpj_raiz, mes, ano, ...novo })
      setExecucao(e => ({ ...e, [cnpj_raiz]: novo }))
    } finally {
      setSavingExec(s => ({ ...s, [`${cnpj_raiz}-${campo}`]: false }))
    }
  }

  const nomeCliente = (cnpj_raiz) => {
    const c = clientes.find(c => c.cnpj_raiz === cnpj_raiz)
    return c ? c.nome : cnpj_raiz
  }

  const fmtR = (v) => {
    if (!v) return 'R$ 0'
    if (v >= 1_000_000) return `R$ ${(v/1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `R$ ${(v/1_000).toFixed(1)}K`
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const BU_COR = { LMP_CASA: '#3b82f6', AL_NUT: '#22c55e', LMP_CUPE: '#ec4899', HGPER_BB: '#a855f7' }
  const BU_SHORT = { LMP_CASA: 'HC', AL_NUT: 'NT', LMP_CUPE: 'PC', HGPER_BB: 'BW' }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm text-blue-700">
        Meta = faturamento de {ano - 1} no mesmo mês + 15%, calculada individualmente por cliente e BU.
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['ranking', 'Ranking de Ganho'], ['execucao', 'Ponto Extra & Planograma']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === id ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}>{label}</button>
        ))}
      </div>

      {/* ── Ranking de Ganho ──────────────────────────────────────────────── */}
      {subTab === 'ranking' && (
        loadingResumo ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-2" />
            Calculando programa para todos os clientes...
          </div>
        ) : erroResumo ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-sm">
            <p className="font-semibold mb-1">Erro ao carregar programa</p>
            <p className="font-mono text-xs">{erroResumo}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumo.map((r, idx) => {
              const nome = nomeCliente(r.cnpj_raiz)
              return (
                <div key={r.cnpj_raiz} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Cabeçalho do cliente */}
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-gray-50">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-100 text-gray-500' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'
                    }`}>{idx + 1}º</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{nome}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{r.cnpj_raiz}</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${r.ponto_extra ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-300'}`}>PE {r.ponto_extra ? '✓' : '○'}</span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${r.planograma ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-300'}`}>Planograma {r.planograma ? '✓' : '○'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-lg font-bold text-[#c9a227]">{fmtR(r.total_ganho)}</p>
                      <p className="text-xs text-gray-400">
                        potencial: {fmtR(r.total_potencial)} <span className="text-gray-300">({r.ating_pct}%)</span>
                      </p>
                      <p className="text-[10px] text-gray-400">2,5% × {fmtR(r.total_meta_fat)}</p>
                      {onSelecionarCliente && (() => {
                        const cli = clientes.find(c => c.cnpj_raiz === r.cnpj_raiz)
                        return cli ? (
                          <button onClick={() => onSelecionarCliente(cli)}
                            className="text-xs bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3 py-1 rounded-lg transition-colors mt-1">
                            Ver detalhes
                          </button>
                        ) : null
                      })()}
                    </div>
                  </div>

                  {/* Faturamento por BU */}
                  <div className="divide-y divide-gray-50">
                    {r.bus.map(bu => {
                      const fatColor = bu.fat_pct >= 100 ? '#22c55e' : bu.fat_pct >= 70 ? '#f59e0b' : '#ef4444'
                      const sortColor = bu.sort_pct >= 92 ? '#22c55e' : bu.sort_pct >= 70 ? '#f59e0b' : '#ef4444'
                      return (
                        <div key={bu.cd_secao} className="grid grid-cols-[80px_1fr_110px] items-center gap-4 px-5 py-3">
                          {/* BU label */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded text-white shrink-0"
                              style={{ backgroundColor: BU_COR[bu.cd_secao] }}>{BU_SHORT[bu.cd_secao]}</span>
                          </div>

                          {/* Barras Fat + Sort */}
                          <div className="space-y-1.5">
                            {/* Faturamento */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-7 shrink-0">Fat.</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, bu.fat_pct)}%`, backgroundColor: fatColor }} />
                              </div>
                              <span className="text-[11px] font-semibold w-9 text-right" style={{ color: fatColor }}>{bu.fat_pct}%</span>
                              <span className="text-[10px] text-gray-400 hidden sm:block">
                                {fmtR(bu.fat_atual)} / {fmtR(bu.meta_fat)}
                              </span>
                            </div>
                            {/* Sortimento */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-400 w-7 shrink-0">Sort.</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.min(100, bu.sort_pct)}%`, backgroundColor: sortColor }} />
                              </div>
                              <span className="text-[11px] font-semibold w-9 text-right" style={{ color: sortColor }}>{bu.sort_pct}%</span>
                              {bu.sort_positivado != null && (
                                <span className="text-[10px] text-gray-400 hidden sm:block">
                                  {bu.sort_positivado}/{bu.meta_eans || bu.sort_total}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Ganho desta BU */}
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-700">{fmtR(bu.ganho_bu)}</p>
                            <p className="text-[10px] text-gray-400">{fmtR(bu.fat_atual)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Rodapé: fat total vs meta total */}
                  <div className="px-5 py-2.5 bg-gray-50 flex items-center gap-3">
                    <span className="text-xs text-gray-500">Total faturado:</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#1e3a5f] transition-all"
                        style={{ width: `${Math.min(100, r.fat_pct_total)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-[#1e3a5f] w-10 text-right">{r.fat_pct_total}%</span>
                    <span className="text-xs text-gray-400">{fmtR(r.total_fat_atual)} / meta {fmtR(r.total_meta_fat)}</span>
                  </div>
                </div>
              )
            })}
            {resumo.length === 0 && (
              <p className="text-center text-gray-400 py-10">Nenhum dado encontrado para o período</p>
            )}
          </div>
        )
      )}

      {/* ── Ponto Extra e Planograma por cliente ─────────────────────────── */}
      {subTab === 'execucao' && (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-800">Execução por Cliente — {MESES[mes - 1]} {ano}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Marque os clientes que executaram Ponto Extra e/ou Planograma</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-purple-500 uppercase">Ponto Extra (+0,50%)</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-emerald-500 uppercase">Planograma (+0,50%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clientes.map(c => {
              const ex = execucao[c.cnpj_raiz] || { ponto_extra: false, planograma: false }
              return (
                <tr key={c.cnpj_raiz} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{c.nome}</p>
                    <p className="text-xs text-gray-400">{c.cnpj_raiz} · {c.total_lojas} {c.total_lojas === 1 ? 'loja' : 'lojas'}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleExec(c.cnpj_raiz, 'ponto_extra')}
                      disabled={savingExec[`${c.cnpj_raiz}-ponto_extra`]}
                      className={`w-10 h-6 rounded-full transition-all relative ${
                        ex.ponto_extra ? 'bg-purple-500' : 'bg-gray-200'
                      } disabled:opacity-50`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        ex.ponto_extra ? 'left-4' : 'left-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleExec(c.cnpj_raiz, 'planograma')}
                      disabled={savingExec[`${c.cnpj_raiz}-planograma`]}
                      className={`w-10 h-6 rounded-full transition-all relative ${
                        ex.planograma ? 'bg-emerald-500' : 'bg-gray-200'
                      } disabled:opacity-50`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        ex.planograma ? 'left-4' : 'left-0.5'
                      }`} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

// ─── Pedidos Admin ────────────────────────────────────────────────────────────
const BU_LABEL_P = { LMP_CASA: 'HC', AL_NUT: 'NT', LMP_CUPE: 'PC', HGPER_BB: 'BW' }
const BU_COR_P   = { LMP_CASA: '#3b82f6', AL_NUT: '#22c55e', LMP_CUPE: '#ec4899', HGPER_BB: '#a855f7' }

function PedidosAdmin({ token }) {
  const [subTab, setSubTab] = useState('abertos')
  const [dadosAbertos, setDadosAbertos] = useState(null)
  const [dadosFaturados, setDadosFaturados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    setLoading(true)
    setErro('')
    Promise.all([
      adminGetPedidosAbertosMes(token),
      adminGetPedidosFaturadosMes(token),
    ]).then(([ra, rf]) => {
      setDadosAbertos(ra.data)
      setDadosFaturados(rf.data)
    }).catch(e => setErro(e.response?.data?.detail || 'Erro ao carregar pedidos'))
      .finally(() => setLoading(false))
  }, [token])

  const fmtR = v => v == null ? 'R$ 0' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const downloadXLSX = (dados, nome, colunas) => {
    const ws = XLSX.utils.json_to_sheet(dados.map(r => {
      const obj = {}
      colunas.forEach(([key, label]) => { obj[label] = r[key] })
      return obj
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31))
    XLSX.writeFile(wb, `${nome}.xlsx`)
  }

  const downloadCSV = (dados, nome, colunas) => {
    const header = colunas.map(([, l]) => `"${l}"`).join(';')
    const linhas = dados.map(r =>
      colunas.map(([k]) => {
        const v = r[k]
        if (typeof v === 'string') return `"${v.replace(/"/g, '""')}"`
        return v ?? ''
      }).join(';')
    )
    const csv = [header, ...linhas].join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${nome}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const colsAbertos = [
    ['cliente', 'Cliente'], ['nu_ped', 'Pedido'], ['dt_pedido', 'Data'],
    ['cd_secao', 'BU'], ['ean', 'EAN'], ['produto', 'Produto'],
    ['qtde_cx', 'Qtde'], ['unid_ped', 'Unidade Pedida'], ['total_un', 'Total UN'], ['valor_item', 'Valor (R$)'], ['etapa', 'Etapa'],
  ]
  const colsFaturados = [
    ['cliente', 'Cliente'], ['nu_nf', 'NF'], ['dt_emissao', 'Emissão'],
    ['cd_secao', 'BU'], ['ean', 'EAN'], ['produto', 'Produto'],
    ['qtde_liquida', 'Qtde Líq.'], ['valor_liquido', 'Valor Líq. (R$)'],
  ]

  // Resumo agrupado por cliente para exibição
  const resumoAbertos = useMemo(() => {
    if (!dadosAbertos) return []
    const map = {}
    dadosAbertos.forEach(r => {
      if (!map[r.cliente]) map[r.cliente] = { cliente: r.cliente, pedidos: new Set(), valor: 0, buMap: {} }
      map[r.cliente].pedidos.add(r.nu_ped)
      map[r.cliente].valor += r.valor_item
      if (!map[r.cliente].buMap[r.cd_secao]) map[r.cliente].buMap[r.cd_secao] = 0
      map[r.cliente].buMap[r.cd_secao] += r.valor_item
    })
    return Object.values(map).sort((a, b) => b.valor - a.valor).map(m => ({
      ...m, qtd_pedidos: m.pedidos.size
    }))
  }, [dadosAbertos])

  const resumoFaturados = useMemo(() => {
    if (!dadosFaturados) return []
    const map = {}
    dadosFaturados.forEach(r => {
      if (!map[r.cliente]) map[r.cliente] = { cliente: r.cliente, notas: new Set(), valor: 0, buMap: {} }
      map[r.cliente].notas.add(r.nu_nf)
      map[r.cliente].valor += r.valor_liquido
      if (!map[r.cliente].buMap[r.cd_secao]) map[r.cliente].buMap[r.cd_secao] = 0
      map[r.cliente].buMap[r.cd_secao] += r.valor_liquido
    })
    return Object.values(map).sort((a, b) => b.valor - a.valor).map(m => ({
      ...m, qtd_notas: m.notas.size
    }))
  }, [dadosFaturados])

  const totalAbertos  = resumoAbertos.reduce((s, r) => s + r.valor, 0)
  const totalFaturado = resumoFaturados.reduce((s, r) => s + r.valor, 0)

  if (loading) return (
    <div className="flex items-center gap-2 py-16 text-gray-400 justify-center">
      <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      Carregando pedidos...
    </div>
  )
  if (erro) return <p className="text-red-500 text-sm py-4">{erro}</p>

  const dados    = subTab === 'abertos' ? dadosAbertos    : dadosFaturados
  const colunas  = subTab === 'abertos' ? colsAbertos     : colsFaturados
  const resumo   = subTab === 'abertos' ? resumoAbertos   : resumoFaturados
  const total    = subTab === 'abertos' ? totalAbertos    : totalFaturado
  const nomeDL   = subTab === 'abertos' ? 'Pedidos_Abertos' : 'Pedidos_Faturados'

  return (
    <div className="space-y-4">
      {/* Sub-tabs + download */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[['abertos', 'Em Aberto'], ['faturados', 'Faturado']].map(([id, label]) => (
            <button key={id} onClick={() => setSubTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                subTab === id ? 'bg-[#1e3a5f] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
        </div>
        {dados && (
          <div className="flex gap-2">
            <button
              onClick={() => downloadCSV(dados, nomeDL, colunas)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
            <button
              onClick={() => downloadXLSX(dados, nomeDL, colunas)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              XLSX
            </button>
          </div>
        )}
      </div>

      {/* Total */}
      {dados && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-[#1e3a5f]">{resumo.length}</p>
            <p className="text-xs text-gray-400 mt-1">Clientes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-[#1e3a5f]">
              {subTab === 'abertos'
                ? resumo.reduce((s, r) => s + r.qtd_pedidos, 0)
                : resumo.reduce((s, r) => s + r.qtd_notas, 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{subTab === 'abertos' ? 'Pedidos' : 'Notas Fiscais'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{fmtR(total)}</p>
            <p className="text-xs text-gray-400 mt-1">Total {subTab === 'abertos' ? 'em aberto' : 'faturado'}</p>
          </div>
        </div>
      )}

      {/* Tabela por cliente */}
      {resumo.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {subTab === 'abertos' ? 'Pedidos em Aberto — Mês Atual' : 'Faturamento — Mês Atual'}
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {resumo.map(r => (
              <div key={r.cliente} className="px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{r.cliente}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {subTab === 'abertos'
                        ? `${r.qtd_pedidos} pedido${r.qtd_pedidos !== 1 ? 's' : ''}`
                        : `${r.qtd_notas} NF${r.qtd_notas !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <p className="font-bold text-gray-700">{fmtR(r.valor)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(r.buMap).sort((a,b) => b[1]-a[1]).map(([bu, val]) => (
                    <span key={bu} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium"
                      style={{ backgroundColor: BU_COR_P[bu] || '#6b7280' }}>
                      {BU_LABEL_P[bu] || bu} · {fmtR(val)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Estoque ────────────────────────────────────────────────────────────────
function EstoqueAdmin({ token }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [filtroBU, setFiltroBU] = useState('ALL')
  const [busca, setBusca] = useState('')
  const [somenteRuptura, setSomenteRuptura] = useState(false)

  useEffect(() => {
    setLoading(true)
    setErro('')
    adminGetEstoque(token)
      .then(r => setDados(r.data))
      .catch(e => setErro(e.response?.data?.detail || 'Erro ao carregar estoque'))
      .finally(() => setLoading(false))
  }, [token])

  const itens = dados || []

  const itensFiltrados = useMemo(() => itens.filter(i => {
    if (filtroBU !== 'ALL' && i.cd_secao !== filtroBU) return false
    if (somenteRuptura && (i.estoque_matriz > 0 || i.estoque_filial > 0)) return false
    if (busca && !(i.produto || '').toLowerCase().includes(busca.toLowerCase()) && !(i.ean || '').includes(busca)) return false
    return true
  }), [itens, filtroBU, busca, somenteRuptura])

  if (loading) return (
    <div className="flex items-center gap-2 py-16 text-gray-400 justify-center">
      <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
      Carregando estoque...
    </div>
  )
  if (erro) return <p className="text-red-500 text-sm py-4">{erro}</p>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {['ALL', ...BUS].map(bu => (
            <button key={bu} onClick={() => setFiltroBU(bu)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtroBU === bu ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {bu === 'ALL' ? 'Todas BUs' : BU_LABELS[bu]}
            </button>
          ))}
        </div>
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="EAN ou produto..."
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] w-52" />
        <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto cursor-pointer">
          <input type="checkbox" checked={somenteRuptura} onChange={e => setSomenteRuptura(e.target.checked)}
            className="rounded border-gray-300 text-[#1e3a5f]" />
          Apenas rupturas (estoque zerado)
        </label>
        <span className="text-xs text-gray-400">{itensFiltrados.length} de {itens.length} EANs</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">EAN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">BU</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Cx</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estoque Matriz</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estoque Filial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {itensFiltrados.map(item => (
                <tr key={item.cd_prod} className={`hover:bg-gray-50 ${item.estoque_matriz <= 0 && item.estoque_filial <= 0 ? 'bg-red-50/50' : ''}`}>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{item.ean}</td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-md">
                    <div className="flex items-center gap-1.5">
                      <CurvaAbcBadge curva={item.curva_abc} />
                      <div className="truncate font-medium" title={item.produto}>{item.produto}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${BU_COR_P[item.cd_secao] ? '' : 'bg-gray-100 text-gray-600'}`}
                      style={BU_COR_P[item.cd_secao] ? { backgroundColor: BU_COR_P[item.cd_secao], color: 'white' } : {}}>
                      {BU_LABELS[item.cd_secao]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{item.fator_caixa}</td>
                  <td className={`px-4 py-2.5 text-center font-mono text-xs font-semibold ${item.estoque_matriz <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {item.estoque_matriz.toLocaleString('pt-BR')}
                  </td>
                  <td className={`px-4 py-2.5 text-center font-mono text-xs font-semibold ${item.estoque_filial <= 0 ? 'text-red-400' : 'text-gray-700'}`}>
                    {item.estoque_filial.toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
              {itensFiltrados.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Nenhum item encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Sortimento (lista manual de EANs) ─────────────────────────────────────────
function SortimentoEansAdmin({ token }) {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(false)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [busca, setBusca] = useState('')

  const carregar = () => {
    setLoading(true)
    adminGetSortimentoEans(token).then(r => setLista(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { carregar() }, [token])

  const handleAdicionar = async () => {
    const eans = texto.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean)
    if (eans.length === 0) return
    setSalvando(true)
    setMsg('')
    try {
      const r = await adminAddSortimentoEans(token, eans)
      setMsg(`${r.data.inseridos} EAN(s) processado(s)`)
      setTexto('')
      carregar()
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const handleRemover = async (ean) => {
    await adminDeleteSortimentoEan(token, ean)
    setLista(l => l.filter(i => i.ean !== ean))
  }

  const listaFiltrada = lista.filter(i => i.ean.includes(busca))

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm text-blue-700">
        EANs cadastrados aqui aparecem com barra roxa no relatório de Sortimento do cliente. Produtos cadastrados no ERP há menos de 2 meses aparecem com barra laranja (e ambas se for dos dois casos).
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-gray-800">Adicionar EANs</h3>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Cole os EANs aqui (um por linha, ou separados por vírgula/espaço)"
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] font-mono"
        />
        <div className="flex items-center gap-3">
          <button onClick={handleAdicionar} disabled={salvando || !texto.trim()}
            className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Adicionar à lista'}
          </button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {lista.length} EAN{lista.length !== 1 ? 's' : ''} no sortimento
          </p>
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar EAN..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] w-52" />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <div className="w-5 h-5 border-2 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mr-2" />
            Carregando...
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {listaFiltrada.map(item => (
              <div key={item.ean} className="px-5 py-2.5 flex items-center justify-between hover:bg-gray-50">
                <span className="font-mono text-sm text-gray-700 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-violet-500" />
                  {item.ean}
                </span>
                <button onClick={() => handleRemover(item.ean)}
                  className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors">
                  Remover
                </button>
              </div>
            ))}
            {listaFiltrada.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">Nenhum EAN cadastrado</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Gerenciamento de Senhas ───────────────────────────────────────────────────
function SenhasAdmin({ token, clientes }) {
  const [senhasSet, setSenhasSet] = useState(new Set())
  const [busca, setBusca] = useState('')
  const [senhaForm, setSenhaForm] = useState({}) // cnpj_raiz -> valor digitado
  const [salvando, setSalvando] = useState({})
  const [msg, setMsg] = useState({})

  useEffect(() => {
    adminGetSenhas(token).then(r => {
      setSenhasSet(new Set(r.data.map(s => s.cnpj_raiz)))
    })
  }, [token])

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) || c.cnpj_raiz.includes(busca)
  )

  const handleSalvar = async (cnpj_raiz) => {
    const senha = senhaForm[cnpj_raiz] || ''
    if (senha.length < 4) {
      setMsg(m => ({ ...m, [cnpj_raiz]: { tipo: 'erro', txt: 'Mínimo 4 caracteres' } }))
      return
    }
    setSalvando(s => ({ ...s, [cnpj_raiz]: true }))
    try {
      await adminSetSenha(token, cnpj_raiz, senha)
      setSenhasSet(s => new Set([...s, cnpj_raiz]))
      setSenhaForm(f => ({ ...f, [cnpj_raiz]: '' }))
      setMsg(m => ({ ...m, [cnpj_raiz]: { tipo: 'ok', txt: 'Senha salva!' } }))
      setTimeout(() => setMsg(m => ({ ...m, [cnpj_raiz]: null })), 2500)
    } catch {
      setMsg(m => ({ ...m, [cnpj_raiz]: { tipo: 'erro', txt: 'Erro ao salvar' } }))
    } finally {
      setSalvando(s => ({ ...s, [cnpj_raiz]: false }))
    }
  }

  const handleRemover = async (cnpj_raiz) => {
    if (!confirm('Remover senha? O cliente não conseguirá mais entrar.')) return
    await adminDeleteSenha(token, cnpj_raiz)
    setSenhasSet(s => { const n = new Set(s); n.delete(cnpj_raiz); return n })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Senhas de Acesso</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {senhasSet.size} de {clientes.length} clientes com senha cadastrada
          </p>
        </div>
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente..."
          autoComplete="off"
          className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] w-60" />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">CNPJ Raiz</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nova Senha</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {clientesFiltrados.map(c => {
              const temSenha = senhasSet.has(c.cnpj_raiz)
              const m = msg[c.cnpj_raiz]
              return (
                <tr key={c.cnpj_raiz} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{c.nome}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-gray-400">{c.cnpj_raiz}</td>
                  <td className="px-4 py-3 text-center">
                    {temSenha ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                        ✓ Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        Sem senha
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder={temSenha ? 'Alterar senha...' : 'Definir senha...'}
                        value={senhaForm[c.cnpj_raiz] || ''}
                        onChange={e => setSenhaForm(f => ({ ...f, [c.cnpj_raiz]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleSalvar(c.cnpj_raiz)}
                        autoComplete="new-password"
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] w-44"
                      />
                      {m && (
                        <span className={`text-xs font-medium ${m.tipo === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {m.txt}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSalvar(c.cnpj_raiz)}
                        disabled={salvando[c.cnpj_raiz]}
                        className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                        {salvando[c.cnpj_raiz] ? '...' : 'Salvar'}
                      </button>
                      {temSenha && (
                        <button
                          onClick={() => handleRemover(c.cnpj_raiz)}
                          className="text-red-400 hover:text-red-600 text-xs px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Dashboard Admin Principal ─────────────────────────────────────────────────
export default function AdminDashboard({ token, onLogout }) {
  const hoje = new Date()
  const [periodo, setPeriodo] = useState({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() })
  const [clientes, setClientes] = useState([])
  const [resumo, setResumo] = useState({})
  const [metasMap, setMetasMap] = useState({}) // { cnpj_raiz: { cd_secao: meta_eans } }
  const [loading, setLoading] = useState(true)
  const [loadingResumo, setLoadingResumo] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('ranking')
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [busca, setBusca] = useState('')
  const [ordenar, setOrdenar] = useState('pct_desc')

  // Carrega clientes apenas uma vez
  useEffect(() => {
    adminGetClientes(token)
      .then(r => setClientes(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [token])

  // Carrega resumo e metas sempre que o período mudar
  useEffect(() => {
    if (loading) return
    setLoadingResumo(true)
    Promise.all([
      adminGetSortimentoResumo(token, periodo),
      adminGetMetas(token, periodo),
    ]).then(([rResumo, rMetas]) => {
      setResumo(rResumo.data)
      const map = {}
      rMetas.data.forEach(m => {
        if (!map[m.cnpj_raiz]) map[m.cnpj_raiz] = {}
        map[m.cnpj_raiz][m.cd_secao] = m.meta_eans
      })
      setMetasMap(map)
    }).catch(() => {}).finally(() => setLoadingResumo(false))
  }, [token, periodo, loading])

  const ranking = useMemo(() => {
    return clientes.map(c => {
      const r = resumo[c.cnpj_raiz]?.bus || {}
      let totalPos = 0, totalEans = 0, totalProg = 0
      BUS.forEach(bu => {
        if (r[bu]) { totalPos += r[bu].positivado; totalEans += r[bu].total; totalProg += r[bu].em_progresso }
      })
      const pct = totalEans > 0 ? Math.round(totalPos / totalEans * 100) : 0
      return { ...c, totalPos, totalEans, totalProg, pct, bus: r }
    }).filter(c =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) || c.cnpj_raiz.includes(busca)
    ).sort((a, b) => {
      if (ordenar === 'pct_desc') return b.pct - a.pct
      if (ordenar === 'pct_asc') return a.pct - b.pct
      if (ordenar === 'nome') return a.nome.localeCompare(b.nome)
      if (ordenar === 'lojas') return b.total_lojas - a.total_lojas
      return 0
    })
  }, [clientes, resumo, busca, ordenar])

  const totais = useMemo(() => {
    let pos = 0, total = 0, prog = 0
    ranking.forEach(c => { pos += c.totalPos; total += c.totalEans; prog += c.totalProg })
    return { pos, total, prog, pct: total > 0 ? Math.round(pos / total * 100) : 0 }
  }, [ranking])

  // Anos disponíveis para seleção (atual + 2 anteriores)
  const anosDisponiveis = [hoje.getFullYear(), hoje.getFullYear() - 1, hoje.getFullYear() - 2]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-8 text-center">{error}</div>
    </div>
  )

  if (clienteSelecionado) return (
    <DetalheCliente
      cliente={clienteSelecionado}
      periodo={periodo}
      token={token}
      onVoltar={() => setClienteSelecionado(null)}
    />
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-white/10 rounded-lg px-2 py-1 text-xs font-bold tracking-widest">ADMIN</span>
            <div>
              <h1 className="text-lg font-bold">Painel Ponderada</h1>
              <p className="text-blue-200 text-xs">Zaffalon · Unilever</p>
            </div>
          </div>

          {/* Seletor de período */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <select
                value={periodo.mes}
                onChange={e => setPeriodo(p => ({ ...p, mes: Number(e.target.value) }))}
                className="bg-transparent text-white text-sm focus:outline-none cursor-pointer"
              >
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1} className="text-gray-800 bg-white">{m}</option>
                ))}
              </select>
              <select
                value={periodo.ano}
                onChange={e => setPeriodo(p => ({ ...p, ano: Number(e.target.value) }))}
                className="bg-transparent text-white text-sm focus:outline-none cursor-pointer"
              >
                {anosDisponiveis.map(a => (
                  <option key={a} value={a} className="text-gray-800 bg-white">{a}</option>
                ))}
              </select>
              {loadingResumo && (
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <button onClick={onLogout} className="text-blue-200 hover:text-white text-sm transition-colors">Sair</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0">
          {[['ranking', 'Ranking'], ['clientes', 'Clientes'], ['metas', '🎯 Metas'], ['programa', '🏆 Programa'], ['pedidos', '📦 Pedidos'], ['estoque', '📊 Estoque'], ['sortimento_eans', '🟣 Sortimento'], ['senhas', '🔑 Senhas']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${tab === id ? 'bg-gray-50 text-[#1e3a5f]' : 'text-blue-200 hover:text-white hover:bg-white/10'}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Grupos Ponderada', valor: clientes.length, sub: `${clientes.reduce((s,c)=>s+c.total_lojas,0)} lojas`, cor: 'text-[#1e3a5f]' },
            { label: 'EANs Positivados', valor: `${totais.pct}%`, sub: `${totais.pos} de ${totais.total}`, cor: PctColor(totais.pct) },
            { label: 'Em Progresso', valor: totais.prog, sub: 'compraram abaixo do mínimo', cor: 'text-amber-600' },
            { label: 'Sem Compra', valor: totais.total - totais.pos - totais.prog, sub: 'pendente ou nunca comprou', cor: 'text-gray-500' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className={`text-3xl font-bold ${k.cor}`}>{k.valor}</div>
              <div className="text-sm text-gray-500 mt-1">{k.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>

        {tab === 'ranking' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar cliente..."
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] w-64" />
              <select value={ordenar} onChange={e => setOrdenar(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]">
                <option value="pct_desc">Maior positivação</option>
                <option value="pct_asc">Menor positivação</option>
                <option value="nome">Nome A-Z</option>
                <option value="lojas">Mais lojas</option>
              </select>
              <span className="text-sm text-gray-400 ml-auto">{ranking.length} clientes</span>
            </div>

            <div className="space-y-3">
              {ranking.map((c, idx) => (
                <div key={c.cnpj_raiz}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-100 text-gray-600' :
                      idx === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-50 text-gray-400'
                    }`}>
                      {idx + 1}º
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800">{c.nome}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.segmento.includes('REDE') ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {c.segmento.replace('PONDERADA - ', '')}
                        </span>
                        <span className="text-xs text-gray-400">{c.total_lojas} {c.total_lojas === 1 ? 'loja' : 'lojas'}</span>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-3 relative overflow-hidden">
                          <div className={`h-3 rounded-full transition-all ${BarColor(c.pct)}`}
                            style={{ width: `${c.pct}%` }}></div>
                          {c.totalProg > 0 && (
                            <div className="absolute top-0 h-3 bg-amber-300 opacity-50 rounded-full"
                              style={{ left: `${c.pct}%`, width: `${Math.round(c.totalProg / c.totalEans * 100)}%` }}></div>
                          )}
                        </div>
                        <span className={`text-xl font-bold w-14 text-right ${PctColor(c.pct)}`}>{c.pct}%</span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {BUS.map(bu => {
                          const d = c.bus[bu]
                          const p = d && d.total > 0 ? Math.round(d.positivado / d.total * 100) : 0
                          return (
                            <div key={bu} className="bg-gray-50 rounded-lg px-2 py-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-gray-500">{BU_LABELS[bu]}</span>
                                <span className={`text-xs font-bold ${PctColor(p)}`}>{p}%</span>
                              </div>
                              <div className="bg-gray-200 rounded-full h-1 mt-1 relative">
                                <div className={`h-1 rounded-full ${BarColor(p)}`} style={{ width: `${p}%` }}></div>
                                {/* Marcador de meta */}
                                {metasMap[c.cnpj_raiz]?.[bu] && d?.total > 0 && (
                                  <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-[#1e3a5f] rounded-full"
                                    style={{ left: `${Math.min(100, Math.round(metasMap[c.cnpj_raiz][bu] / d.total * 100))}%` }} />
                                )}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 flex justify-between">
                                <span>{d?.positivado || 0}/{d?.total || 0}</span>
                                {metasMap[c.cnpj_raiz]?.[bu] && (
                                  <span className={`font-medium ${(d?.positivado || 0) >= metasMap[c.cnpj_raiz][bu] ? 'text-emerald-600' : 'text-amber-500'}`}>
                                    meta {metasMap[c.cnpj_raiz][bu]}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <button onClick={() => setClienteSelecionado(c)}
                      className="flex-shrink-0 bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Relatório
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'metas' && (
          <MetasAdmin token={token} periodo={periodo} />
        )}

        {tab === 'programa' && (
          <ProgramaAdmin token={token} clientes={clientes} periodo={periodo} onSelecionarCliente={setClienteSelecionado} />
        )}

        {tab === 'pedidos' && (
          <PedidosAdmin token={token} />
        )}

        {tab === 'estoque' && (
          <EstoqueAdmin token={token} />
        )}

        {tab === 'sortimento_eans' && (
          <SortimentoEansAdmin token={token} />
        )}

        {tab === 'senhas' && (
          <SenhasAdmin token={token} clientes={clientes} />
        )}

        {tab === 'clientes' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Todos os Clientes Ponderada</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Segmento</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">CNPJ Raiz</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Lojas</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Positivação</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Relatório</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ranking.map(c => (
                    <tr key={c.cnpj_raiz} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">{c.nome}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.segmento.includes('REDE') ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {c.segmento.replace('PONDERADA - ', '')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center font-mono text-xs text-gray-500">{c.cnpj_raiz}</td>
                      <td className="px-4 py-4 text-center text-gray-700 font-semibold">{c.total_lojas}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${BarColor(c.pct)}`} style={{ width: `${c.pct}%` }}></div>
                          </div>
                          <span className={`text-xs font-bold w-8 ${PctColor(c.pct)}`}>{c.pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => setClienteSelecionado(c)}
                          className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
