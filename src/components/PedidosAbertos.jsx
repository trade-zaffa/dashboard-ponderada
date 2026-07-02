import { useEffect, useState, useMemo } from 'react'
import { getPedidosAbertos } from '../api'

const BU_LABELS = {
  AL_NUT: 'NT - Nutrição',
  HGPER_BB: 'BW - Beleza e Bem-Estar',
  LMP_CASA: 'HC - Cuidados Domiciliares',
  LMP_CUPE: 'PC - Cuidados Pessoais',
}

const BU_SHORT = { AL_NUT: 'NT', HGPER_BB: 'BW', LMP_CASA: 'HC', LMP_CUPE: 'PC' }

export default function PedidosAbertos({ session }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [buAtiva, setBuAtiva] = useState('ALL')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    getPedidosAbertos(session.cd_cliens)
      .then(r => setRows(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar pedidos'))
      .finally(() => setLoading(false))
  }, [])

  const filtrados = useMemo(() => rows.filter(r => {
    if (buAtiva !== 'ALL' && r.cd_secao !== buAtiva) return false
    if (busca && !r.produto.toLowerCase().includes(busca.toLowerCase()) && !r.ean.includes(busca) && !String(r.nu_ped).includes(busca)) return false
    return true
  }), [rows, buAtiva, busca])

  // Agrupa por pedido para exibir expansível
  const pedidos = useMemo(() => {
    const mapa = {}
    filtrados.forEach(r => {
      if (!mapa[r.nu_ped]) mapa[r.nu_ped] = { nu_ped: r.nu_ped, dt_pedido: r.dt_pedido, itens: [] }
      mapa[r.nu_ped].itens.push(r)
    })
    return Object.values(mapa)
  }, [filtrados])

  const totalUnidades = useMemo(() => filtrados.reduce((s, r) => s + r.unidades, 0), [filtrados])
  const busDisponiveis = useMemo(() => [...new Set(rows.map(r => r.cd_secao))], [rows])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]"></div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">{error}</div>
  )

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-[#1e3a5f]">{pedidos.length}</div>
          <div className="text-sm text-gray-500 mt-0.5">Pedidos em aberto</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-amber-600">{filtrados.length}</div>
          <div className="text-sm text-gray-500 mt-0.5">Linhas de produto</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-2xl font-bold text-emerald-600">{totalUnidades.toLocaleString('pt-BR')}</div>
          <div className="text-sm text-gray-500 mt-0.5">Unidades em aberto</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-8 text-center">
          <div className="text-lg font-semibold">Nenhum pedido em aberto</div>
          <div className="text-sm mt-1">Todos os pedidos Unilever foram faturados.</div>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button onClick={() => setBuAtiva('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${buAtiva === 'ALL' ? 'bg-white shadow text-[#1e3a5f]' : 'text-gray-500 hover:text-gray-700'}`}>
                Todas
              </button>
              {busDisponiveis.map(bu => (
                <button key={bu} onClick={() => setBuAtiva(bu === buAtiva ? 'ALL' : bu)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${buAtiva === bu ? 'bg-white shadow text-[#1e3a5f]' : 'text-gray-500 hover:text-gray-700'}`}>
                  {BU_SHORT[bu] || bu}
                </button>
              ))}
            </div>
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por pedido, EAN ou produto..."
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0ea5e9] flex-1 max-w-xs" />
            <span className="text-xs text-gray-400 ml-auto">{pedidos.length} pedidos · {filtrados.length} itens</span>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Pedido</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">EAN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">BU</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Unidades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pedidos.map(ped => (
                    ped.itens.map((item, idx) => (
                      <tr key={`${ped.nu_ped}-${item.ean}`} className="hover:bg-gray-50 transition-colors">
                        {idx === 0 && (
                          <>
                            <td className="px-4 py-2.5 font-mono text-xs text-[#1e3a5f] font-semibold" rowSpan={ped.itens.length}>
                              #{ped.nu_ped}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap" rowSpan={ped.itens.length}>
                              {new Date(ped.dt_pedido + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{item.ean}</td>
                        <td className="px-4 py-2.5 text-gray-800 max-w-xs">
                          <div className="truncate" title={item.produto}>{item.produto}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                          {BU_LABELS[item.cd_secao] || item.bu}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-gray-800">
                          {item.unidades.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              {pedidos.length} pedidos · {filtrados.length} itens · {totalUnidades.toLocaleString('pt-BR')} unidades em aberto
            </div>
          </div>
        </>
      )}
    </div>
  )
}
