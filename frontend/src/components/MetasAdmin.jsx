import { useEffect, useState } from 'react'
import { adminGetMetas, adminUpsertMeta, adminDeleteMeta } from '../api'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const BUS = [
  { key: 'LMP_CASA', short: 'HC', label: 'Home Care',           badge: 'bg-blue-100 text-blue-700',   cor: '#3b82f6' },
  { key: 'AL_NUT',   short: 'NT', label: 'Nutrição',            badge: 'bg-green-100 text-green-700', cor: '#22c55e' },
  { key: 'LMP_CUPE', short: 'PC', label: 'Personal Care',       badge: 'bg-pink-100 text-pink-700',   cor: '#ec4899' },
  { key: 'HGPER_BB', short: 'BW', label: 'Beleza & Bem-Estar',  badge: 'bg-purple-100 text-purple-700', cor: '#a855f7' },
]

export default function MetasAdmin({ token, periodo }) {
  // { cd_secao: meta_eans | '' }
  const [metas, setMetas] = useState({})
  // { cd_secao: 'saving' | 'saved' | 'error' }
  const [status, setStatus] = useState({})

  useEffect(() => {
    adminGetMetas(token, periodo).then(r => {
      const map = {}
      r.data.forEach(m => { map[m.cd_secao] = m.meta_eans })
      setMetas(map)
      setStatus({})
    }).catch(() => {})
  }, [periodo.mes, periodo.ano])

  const handleChange = (cd_secao, raw) => {
    setMetas(prev => ({ ...prev, [cd_secao]: raw === '' ? '' : Number(raw) }))
    setStatus(prev => { const n = { ...prev }; delete n[cd_secao]; return n })
  }

  const handleBlur = async (cd_secao) => {
    const val = metas[cd_secao]

    if (val === '' || val === undefined || val === null) {
      setStatus(prev => ({ ...prev, [cd_secao]: 'saving' }))
      try {
        await adminDeleteMeta(token, { cd_secao, mes: periodo.mes, ano: periodo.ano })
        setMetas(prev => { const n = { ...prev }; delete n[cd_secao]; return n })
        setStatus(prev => { const n = { ...prev }; delete n[cd_secao]; return n })
      } catch {
        setStatus(prev => ({ ...prev, [cd_secao]: 'error' }))
      }
      return
    }

    const num = Number(val)
    if (isNaN(num) || num < 0) return

    setStatus(prev => ({ ...prev, [cd_secao]: 'saving' }))
    try {
      await adminUpsertMeta(token, { cd_secao, mes: periodo.mes, ano: periodo.ano, meta_eans: num })
      setStatus(prev => ({ ...prev, [cd_secao]: 'saved' }))
      setTimeout(() => setStatus(prev => { const n = { ...prev }; delete n[cd_secao]; return n }), 1500)
    } catch {
      setStatus(prev => ({ ...prev, [cd_secao]: 'error' }))
    }
  }

  const totalConfiguradas = Object.values(metas).filter(v => v !== '' && v !== undefined).length

  return (
    <div className="max-w-lg space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-800">Metas de Positivação</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {MESES[periodo.mes - 1]} {periodo.ano} ·{' '}
          <span className="font-medium text-[#1e3a5f]">{totalConfiguradas}/4 BUs configuradas</span>
        </p>
      </div>

      {/* Instrução */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        A meta vale para todas as redes. Defina quantos EANs devem ser positivados por BU. Salva automaticamente ao sair do campo.
      </div>

      {/* Cards por BU */}
      <div className="space-y-3">
        {BUS.map(bu => {
          const val = metas[bu.key] ?? ''
          const st = status[bu.key]
          const hasValue = val !== '' && val !== undefined

          return (
            <div key={bu.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-5">
              {/* Ícone / Badge */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                style={{ backgroundColor: bu.cor + '15', color: bu.cor }}>
                {bu.short}
              </div>

              {/* Nome */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{bu.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{bu.key}</p>
              </div>

              {/* Input + status */}
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={val}
                    onChange={e => handleChange(bu.key, e.target.value)}
                    onBlur={() => handleBlur(bu.key)}
                    placeholder="—"
                    className={`w-24 text-center rounded-lg border px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 transition-all ${
                      st === 'error'
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : hasValue
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 bg-white text-gray-400 placeholder:text-gray-300'
                    }`}
                  />
                  <span className="text-xs text-gray-400 w-8">EANs</span>
                </div>
                <div className="h-4 flex items-center">
                  {st === 'saving' && (
                    <div className="w-3 h-3 border border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
                  )}
                  {st === 'saved' && <span className="text-emerald-500 text-xs font-medium">✓ salvo</span>}
                  {st === 'error' && <span className="text-red-500 text-xs font-medium">erro ao salvar</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
