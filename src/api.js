import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

const api = axios.create({ baseURL: BASE })

export const login = (cnpj) => api.post('/login', { cnpj })

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
