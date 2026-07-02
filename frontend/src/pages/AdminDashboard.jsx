import { useEffect, useState, useMemo } from 'react'
import { adminGetClientes, adminGetSortimentoResumo, adminGetMetas, getSortimento, adminGetSenhas, adminSetSenha, adminDeleteSenha, adminGetProgramaExecucao, adminSetProgramaExecucao } from '../api'
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


// ─── Relatório de Sortimento de um Cliente ─────────────────────────────────
function SortimentoCliente({ cliente, periodo, onVoltar }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subTab, setSubTab] = useState('sortimento')
  const [filtroBU, setFiltroBU] = useState('ALL')
  const [filtroStatus, setFiltroStatus] = useState('ALL')
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
    if (busca && !(i.produto || '').toLowerCase().includes(busca.toLowerCase()) && !(i.ean || '').includes(busca)) return false
    return true
  }), [itens, filtroBU, filtroStatus, busca])

  const itensSel = itens.filter(i => sel.has(i.ean))
  const itensSelOcultos = itensSel.filter(i => !itensFiltrados.find(f => f.ean === i.ean))
  const temFiltro = filtroBU !== 'ALL' || filtroStatus !== 'ALL' || busca !== ''

  const limparFiltros = () => { setFiltroBU('ALL'); setFiltroStatus('ALL'); setBusca('') }

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
                          <div className="truncate font-medium" title={item.produto}>{item.produto}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{BU_LABELS[item.cd_secao]} — {BU_FULL[item.cd_secao]}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs font-semibold text-gray-800">
                          {item.unidades_vendidas.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{item.minimo}</td>
                        <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{item.fator_caixa}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s?.fundo} ${s?.texto}`}>
                            {s?.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {itensFiltrados.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Nenhum item encontrado</td></tr>
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

function ProgramaAdmin({ token, clientes, periodo }) {
  const { mes, ano } = periodo
  const [execucao, setExecucao] = useState({})
  const [savingExec, setSavingExec] = useState({})

  useEffect(() => {
    adminGetProgramaExecucao(token, mes, ano).then(r => setExecucao(r.data))
  }, [mes, ano])

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

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700">
        A meta de faturamento é calculada automaticamente: faturamento do mesmo mês de {ano - 1} + 15% por BU, individualmente para cada cliente.
      </div>

      {/* ── Ponto Extra e Planograma por cliente ─────────────────────────── */}
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1e3a5f] text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="bg-white/10 rounded-lg px-2 py-1 text-xs font-bold tracking-widest">ADMIN</span>
          <span className="text-lg font-bold">Relatório de Sortimento</span>
          <span className="ml-auto text-blue-200 text-sm">
            {MESES[periodo.mes - 1]} {periodo.ano}
          </span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <SortimentoCliente
          cliente={clienteSelecionado}
          periodo={periodo}
          onVoltar={() => setClienteSelecionado(null)}
        />
      </main>
    </div>
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
          {[['ranking', 'Ranking'], ['clientes', 'Clientes'], ['metas', '🎯 Metas'], ['programa', '🏆 Programa'], ['senhas', '🔑 Senhas']].map(([id, label]) => (
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
          <ProgramaAdmin token={token} clientes={clientes} periodo={periodo} />
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
