import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

const api = axios.create({ baseURL: BASE })

export const login = (cnpj, senha) => api.post('/login', { cnpj, senha })

export const getSortimento = (cd_cliens, n_lojas, periodo = {}) =>
  api.get('/sortimento', {
    params: { cd_cliens: cd_cliens.join(','), n_lojas, ...periodo },
  })

export const getFaturamento = (cd_cliens) =>
  api.get('/faturamento', { params: { cd_cliens: cd_cliens.join(',') } })


export const getPedidosAbertos = (cd_cliens) =>
  api.get('/pedidos-abertos', { params: { cd_cliens: cd_cliens.join(',') } })

export const getPedidos = (cd_cliens) =>
  api.get('/pedidos', { params: { cd_cliens: cd_cliens.join(',') } })

export const getPedidoItens = (nu_ped, cd_cliens) =>
  api.get(`/pedidos/${nu_ped}/itens`, { params: { cd_cliens: cd_cliens.join(',') } })

const adminHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

export const adminLogin = (senha) => api.post('/admin/login', { senha })
export const adminGetClientes = (token) => api.get('/admin/clientes', adminHeaders(token))
export const adminGetSortimentoResumo = (token, periodo = {}) =>
  api.get('/admin/sortimento-resumo', { ...adminHeaders(token), params: periodo })

// Metas
export const getMetas = (periodo) =>
  api.get('/metas', { params: periodo })

export const adminGetMetas = (token, periodo) =>
  api.get('/admin/metas', { ...adminHeaders(token), params: periodo })

export const adminUpsertMeta = (token, meta) =>
  api.post('/admin/metas', meta, adminHeaders(token))

export const adminDeleteMeta = (token, params) =>
  api.delete('/admin/metas', { ...adminHeaders(token), params })

// Senhas de clientes
export const adminGetSenhas = (token) =>
  api.get('/admin/senhas', adminHeaders(token))

export const adminSetSenha = (token, cnpj_raiz, senha) =>
  api.post('/admin/senhas', { cnpj_raiz, senha }, adminHeaders(token))

export const adminDeleteSenha = (token, cnpj_raiz) =>
  api.delete('/admin/senhas', { ...adminHeaders(token), params: { cnpj_raiz } })

// Programa Ponderada
export const getPrograma = (cd_cliens, cnpj_raiz, mes, ano) =>
  api.get('/programa', { params: { cd_cliens: cd_cliens.join(','), cnpj_raiz, mes, ano } })

export const adminGetProgramaMetas = (token, mes, ano) =>
  api.get('/admin/programa-metas', { ...adminHeaders(token), params: { mes, ano } })

export const adminSetProgramaMeta = (token, body) =>
  api.post('/admin/programa-metas', body, adminHeaders(token))

export const adminGetProgramaExecucao = (token, mes, ano) =>
  api.get('/admin/programa-execucao', { ...adminHeaders(token), params: { mes, ano } })

export const adminSetProgramaExecucao = (token, body) =>
  api.post('/admin/programa-execucao', body, adminHeaders(token))

export const adminGetProgramaResumo = (token, mes, ano) =>
  api.get('/admin/programa-resumo', { ...adminHeaders(token), params: { mes, ano } })

export const adminGetProgramaConfig = (token) =>
  api.get('/admin/programa-config', adminHeaders(token))

export const adminSetProgramaConfig = (token, incluir_avista) =>
  api.post('/admin/programa-config', { incluir_avista }, adminHeaders(token))

export const adminGetPedidosAbertosMes = (token) =>
  api.get('/admin/pedidos-abertos-mes', adminHeaders(token))

export const adminGetPedidosFaturadosMes = (token) =>
  api.get('/admin/pedidos-faturados-mes', adminHeaders(token))

export const adminGetEstoque = (token) =>
  api.get('/admin/estoque', adminHeaders(token))

export const adminGetSortimentoEans = (token) =>
  api.get('/admin/sortimento-eans', adminHeaders(token))

export const adminAddSortimentoEans = (token, eans) =>
  api.post('/admin/sortimento-eans', { eans }, adminHeaders(token))

export const adminDeleteSortimentoEan = (token, ean) =>
  api.delete(`/admin/sortimento-eans/${ean}`, adminHeaders(token))
