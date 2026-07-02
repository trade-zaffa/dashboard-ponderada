import { useEffect, useState, useMemo } from 'react'
import { getSortimento } from '../api'
import RelatorioCadastro from './RelatorioCadastro'

const BU_LABELS = {
  AL_NUT: 'NT - Nutrição',
  HGPER_BB: 'BW - Beleza e Bem-Estar',
  LMP_CASA: 'HC - Cuidados Domiciliares',
  LMP_CUPE: 'PC - Cuidados Pessoais',
}

const STATUS = {
  positivado:    { label: 'Positivado',    bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  em_progresso:  { label: 'Em Progresso',  bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  pendente:      { label: 'Pendente',      bg: 'bg-gray-100',    text: 'text-gray-500',    dot: 'bg-gray-400' },
  nunca_comprou: { label: 'Nunca Comprou', bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500' },
}

export default function Sortimento({ session }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [buAtiva, setBuAtiva] = useState('ALL')
  const [filtroStatus, setFiltroStatus] = useState('ALL')
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [showRelatorio, setShowRelatorio] = useState(false)

  useEffect(() => {
    getSortimento(session.cd_cliens, session.total_lojas)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar sortimento'))
      .finally(() => setLoading(false))
  }, [])

  const itens = data?.itens || []

  const porBU = useMemo(() => {
    const grupos = {}
    itens.forEach(i => {
      if (!grupos[i.cd_secao]) grupos[i.cd_secao] = []
      grupos[i.cd_secao].push(i)
    })
    return grupos
  }, [itens])

  const resumo = useMemo(() => {
    const r = {}
    itens.forEach(i => {
      if (!r[i.cd_secao]) r[i.cd_secao] = { positivado: 0, em_progresso: 0, pendente: 0, nunca_comprou: 0, total: 0 }
      r[i.cd_secao][i.status]++
      r[i.cd_secao].total++
    })
    return r
  }, [itens])

  const totalGeral = useMemo(() => ({
    positivado: itens.filter(i => i.status === 'positivado').length,
    em_progresso: itens.filter(i => i.status === 'em_progresso').length,
    pendente: itens.filter(i => i.status === 'pendente').length,
    nunca_comprou: itens.filter(i => i.status === 'nunca_comprou').length,
    total: itens.length,
  }), [itens])

  const itensFiltrados = useMemo(() => {
    return itens.filter(i => {
      if (buAtiva !== 'ALL' && i.cd_secao !== buAtiva) return false
      if (filtroStatus !== 'ALL' && i.status !== filtroStatus) return false
      if (busca && !i.produto.toLowerCase().includes(busca.toLowerCase()) && !i.ean.includes(busca)) return false
      return true
    })
  }, [itens, buAtiva, filtroStatus, busca])

  const nuncaComprouSelecionados = useMemo(() =>
    itens.filter(i => i.status === 'nunca_comprou' && selecionados.includes(i.ean)),
    [itens, selecionados]
  )

  const toggleSelecionado = (ean) => {
    setSelecionados(prev => prev.includes(ean) ? prev.filter(e => e !== ean) : [...prev, ean])
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]"></div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">{error}</div>
  )

  if (showRelatorio) return (
    <RelatorioCadastro
      itens={nuncaComprouSelecionados}
      onVoltar={() => setShowRelatorio(false)}
    />
  )

  return (
    <div className="space-y-6">
      {/* Cards de resumo — clicáveis para filtrar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setFiltroStatus(filtroStatus === key ? 'ALL' : key)}
            title={`Filtrar por ${s.label}`}
            className={`rounded-xl p-4 text-left transition-all border-2 cursor-pointer ${
              filtroStatus === key ? 'border-[#1e3a5f] shadow-md' : 'border-transparent hover:border-gray-300'
            } ${s.bg}`}
          >
            <div className={`text-3xl font-bold ${s.text}`}>{totalGeral[key]}</div>
            <div className={`text-sm font-medium ${s.text} mt-1`}>{s.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">de {totalGeral.total} EANs</div>
            {filtroStatus !== key && (
              <div className={`text-xs mt-1.5 ${s.text} opacity-60`}>↑ clique para filtrar</div>
            )}
          </button>
        ))}
      </div>

      {/* Filtros de BU */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setBuAtiva('ALL')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            buAtiva === 'ALL' ? 'bg-[#1e3a5f] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Todas as BUs
        </button>
        {Object.keys(porBU).map(bu => (
          <button
            key={bu}
            onClick={() => setBuAtiva(buAtiva === bu ? 'ALL' : bu)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              buAtiva === bu ? 'bg-[#1e3a5f] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {BU_LABELS[bu] || bu}
            {resumo[bu] && (
              <span className="ml-2 bg-emerald-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {resumo[bu].positivado}/{resumo[bu].total}
              </span>
            )}
          </button>
        ))}

        {/* Filtro rápido — Não Cadastrados */}
        {totalGeral.nunca_comprou > 0 && (
          <button
            onClick={() => setFiltroStatus(filtroStatus === 'nunca_comprou' ? 'ALL' : 'nunca_comprou')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ml-auto ${
              filtroStatus === 'nunca_comprou'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
            Não Cadastrados ({totalGeral.nunca_comprou})
          </button>
        )}
      </div>

      {/* Barra de busca + botão relatório */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por produto ou EAN..."
          className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]"
        />
        {filtroStatus !== 'ALL' && (
          <button
            onClick={() => { setFiltroStatus('ALL'); setBuAtiva('ALL'); setBusca('') }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            Limpar filtros
          </button>
        )}
        {selecionados.length > 0 && (
          <button
            onClick={() => setShowRelatorio(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Relatório de Cadastro ({selecionados.length})
          </button>
        )}
      </div>

      {/* Mínimo de referência */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700 flex items-center justify-between">
        <span>Mínimo para positivar: <strong>{data?.n_lojas} lojas × 3 unidades = {data?.minimo} unidades por EAN</strong></span>
        {data?.periodo && (
          <span className="text-xs text-blue-500">
            {new Date(data.periodo.ano, data.periodo.mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">EAN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">BU</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendido</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Mínimo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {itensFiltrados.map((item) => {
                const s = STATUS[item.status]
                const isNunca = item.status === 'nunca_comprou'
                const checked = selecionados.includes(item.ean)
                return (
                  <tr key={item.ean} className={`hover:bg-gray-50 transition-colors ${checked ? 'bg-purple-50' : ''}`}>
                    <td className="px-3 py-3">
                      {isNunca && (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelecionado(item.ean)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.ean}</td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs">
                      <div className="truncate" title={item.produto}>{item.produto}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{BU_LABELS[item.cd_secao] || item.bu}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.unidades_vendidas}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{item.minimo}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {itensFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Nenhum item encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          {itensFiltrados.length} de {itens.length} EANs exibidos
        </div>
      </div>
    </div>
  )
}
