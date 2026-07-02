import * as XLSX from 'xlsx'

export default function RelatorioCadastro({ itens, onVoltar }) {
  const handleExcel = () => {
    const dados = itens.map(i => ({
      'Cód. Fabricante': i.cod_fabricante || '',
      'EAN': i.ean,
      'DUN': i.dun || '',
      'NCM': i.ncm || '',
      'Fator por Caixa': i.fator_caixa,
      'Produto': i.produto,
    }))
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cadastro')
    XLSX.writeFile(wb, `Cadastro_Produtos_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleCopiar = () => {
    const header = 'Código Fabricante\tEAN\tDUN\tNCM\tFator por Caixa\tProduto'
    const linhas = itens.map(i =>
      [i.cod_fabricante, i.ean, i.dun || '', i.ncm || '', i.fator_caixa, i.produto].join('\t')
    )
    navigator.clipboard.writeText([header, ...linhas].join('\n'))
      .then(() => alert('Copiado para a área de transferência!'))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Relatório de Cadastro</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {itens.length} {itens.length === 1 ? 'produto' : 'produtos'} para cadastrar
          </p>
        </div>
        <div className="flex gap-3">
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
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copiar para Excel
          </button>
          <button
            onClick={onVoltar}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-700">
        Estes produtos nunca foram comprados e precisam de cadastro para serem incluídos no sortimento.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cód. Fabricante</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">EAN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DUN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">NCM</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Fator/Caixa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Produto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {itens.map((item) => (
                <tr key={item.ean} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.cod_fabricante || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.ean}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.dun || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.ncm || '—'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.fator_caixa}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-sm">
                    <div className="truncate" title={item.produto}>{item.produto}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
