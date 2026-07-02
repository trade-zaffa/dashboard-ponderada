import { useEffect, useState } from 'react'
import { getFaturamento } from '../api'

function fmt(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function Faturamento({ session }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getFaturamento(session.cd_cliens)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Erro ao carregar faturamento'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]"></div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">{error}</div>
  )

  const lojas = data?.lojas || []
  const total = data?.total || 0

  return (
    <div className="space-y-6">
      {/* Card total */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0ea5e9] rounded-xl p-6 text-white">
        <div className="text-sm font-medium text-blue-100">Faturamento Total do Grupo</div>
        <div className="text-4xl font-bold mt-1">{fmt(total)}</div>
        <div className="text-blue-200 text-sm mt-1">
          {lojas.length} {lojas.length === 1 ? 'loja' : 'lojas'} · Mês atual
        </div>
      </div>

      {/* Tabela de lojas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Faturamento por Loja</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Loja</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">CNPJ</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Faturamento</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">% do Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lojas.map((loja) => {
                const pct = total > 0 ? (loja.faturamento / total * 100) : 0
                return (
                  <tr key={loja.cd_clien} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-800">{loja.nome}</div>
                      <div className="text-xs text-gray-400">Cód. {loja.cd_clien}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{loja.cnpj}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-800">{fmt(loja.faturamento)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-[#0ea5e9] h-1.5 rounded-full"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-gray-500 text-xs w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {lojas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    Nenhum faturamento encontrado neste mês
                  </td>
                </tr>
              )}
            </tbody>
            {lojas.length > 1 && (
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-6 py-4 font-semibold text-gray-700">Total</td>
                  <td className="px-6 py-4 text-right font-bold text-[#1e3a5f] text-base">{fmt(total)}</td>
                  <td className="px-6 py-4 text-right text-gray-500 text-xs">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
