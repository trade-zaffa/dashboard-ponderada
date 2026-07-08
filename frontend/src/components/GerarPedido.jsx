import * as XLSX from 'xlsx'

const BU = {
  LMP_CASA: { label: 'Home Care',          short: 'HC', badge: 'bg-blue-100 text-blue-700',   header: 'bg-blue-50 border-blue-200' },
  AL_NUT:   { label: 'Nutrição',           short: 'NT', badge: 'bg-green-100 text-green-700', header: 'bg-green-50 border-green-200' },
  LMP_CUPE: { label: 'Personal Care',      short: 'PC', badge: 'bg-pink-100 text-pink-700',   header: 'bg-pink-50 border-pink-200' },
  HGPER_BB: { label: 'Beleza & Bem-Estar', short: 'BW', badge: 'bg-purple-100 text-purple-700', header: 'bg-purple-50 border-purple-200' },
}

const STATUS_LABEL = {
  positivado:    'Positivado',
  em_progresso:  'Em Progresso',
  pendente:      'Pendente',
  nunca_comprou: 'Nunca Comprou',
}

const ORDEM_BU = ['LMP_CASA', 'AL_NUT', 'LMP_CUPE', 'HGPER_BB']

// EANs vendidos em caixa (unid_cmp='CX') levam o sufixo C<fator> no código do pedido
// (ex: 7891150065352C24). Itens vendidos por unidade (UN) usam o EAN puro.
function codigoPedido(item) {
  if (item.unid_cmp && item.unid_cmp !== 'CX') return item.ean
  return `${item.ean}C${Math.round(item.fator_caixa)}`
}

export default function GerarPedido({ itens, onVoltar }) {
  // Agrupar por BU na ordem correta
  const porBU = {}
  ORDEM_BU.forEach(bu => { porBU[bu] = [] })
  itens.forEach(i => {
    if (porBU[i.cd_secao]) porBU[i.cd_secao].push(i)
    else { porBU[i.cd_secao] = [i] }
  })

  const handleCopiar = () => {
    const header = 'BU\tCód. Fabricante\tEAN\tCódigo Pedido\tDUN\tNCM\tFator/Caixa\tProduto\tStatus'
    const linhas = itens.map(i => [
      BU[i.cd_secao]?.short || i.cd_secao,
      i.cod_fabricante || '',
      i.ean,
      codigoPedido(i),
      i.dun || '',
      i.ncm || '',
      i.fator_caixa,
      i.produto,
      STATUS_LABEL[i.status] || i.status,
    ].join('\t'))
    navigator.clipboard.writeText([header, ...linhas].join('\n'))
      .then(() => alert('Copiado! Cole direto no Excel.'))
  }

  const handleExcel = () => {
    const dados = itens.map(i => ({
      'BU': BU[i.cd_secao]?.short || i.cd_secao,
      'Cód. Fabricante': i.cod_fabricante || '',
      'EAN': i.ean,
      'Código Pedido': codigoPedido(i),
      'DUN': i.dun || '',
      'NCM': i.ncm || '',
      'Fator/Caixa': i.fator_caixa,
      'Produto': i.produto,
      'Status': STATUS_LABEL[i.status] || i.status,
      'Vendido (un)': i.unidades_vendidas,
      'Mínimo (un)': i.minimo,
    }))
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido')
    XLSX.writeFile(wb, `Pedido_Unilever_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const busVisiveis = Object.entries(porBU).filter(([, arr]) => arr.length > 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Gerar Pedido</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {itens.length} {itens.length === 1 ? 'produto selecionado' : 'produtos selecionados'} ·{' '}
            {busVisiveis.length} {busVisiveis.length === 1 ? 'BU' : 'BUs'}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleExcel}
            className="bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>
          <button
            onClick={handleCopiar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" />
            </svg>
            Copiar para Excel
          </button>
          <button
            onClick={onVoltar}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </div>

      {/* Resumo por BU */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {busVisiveis.map(([bu, arr]) => {
          const cfg = BU[bu]
          return (
            <div key={bu} className={`rounded-xl border px-4 py-3 ${cfg?.header || 'bg-gray-50 border-gray-200'}`}>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${cfg?.badge || 'bg-gray-100 text-gray-600'}`}>
                {cfg?.short || bu}
              </span>
              <div className="text-2xl font-bold text-gray-800 mt-2">{arr.length}</div>
              <div className="text-xs text-gray-500">{cfg?.label || bu}</div>
            </div>
          )
        })}
      </div>

      {/* Tabela por BU */}
      {busVisiveis.map(([bu, arr]) => {
        const cfg = BU[bu]
        return (
          <div key={bu} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header da BU */}
            <div className={`px-5 py-3 border-b flex items-center gap-3 ${cfg?.header || 'bg-gray-50 border-gray-200'}`}>
              <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${cfg?.badge || 'bg-gray-100 text-gray-600'}`}>
                {cfg?.short || bu}
              </span>
              <span className="font-semibold text-gray-700">{cfg?.label || bu}</span>
              <span className="text-sm text-gray-500 ml-auto">
                {arr.length} {arr.length === 1 ? 'produto' : 'produtos'}
              </span>
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Cód. Fab.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">EAN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Código Pedido</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">DUN</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Produto</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Cx/Un</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Vendido</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {arr.map(item => (
                    <tr key={item.ean} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.cod_fabricante || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.ean}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1e3a5f]">{codigoPedido(item)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.dun || '—'}</td>
                      <td className="px-4 py-3 text-gray-800 max-w-xs">
                        <div className="truncate font-medium" title={item.produto}>{item.produto}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold">{item.fator_caixa}</td>
                      <td className="px-4 py-3 text-center text-gray-600 font-mono text-xs">
                        {item.unidades_vendidas.toLocaleString('pt-BR')}
                        <span className="text-gray-400">/{item.minimo}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.status === 'positivado'    ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'em_progresso'  ? 'bg-amber-100 text-amber-700' :
                          item.status === 'pendente'      ? 'bg-slate-100 text-slate-600' :
                                                            'bg-violet-100 text-violet-700'
                        }`}>
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
