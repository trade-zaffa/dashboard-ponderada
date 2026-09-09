# Gerar Pedido — como funciona

Documenta a tela **Gerar Pedido**, acessada a partir da aba Sortimento (Portfólio do cliente ou
relatório do admin) depois de selecionar um ou mais EANs na tabela e clicar em **"Gerar Pedido"**.

Componente: [`frontend/src/components/GerarPedido.jsx`](../frontend/src/components/GerarPedido.jsx)

## 1. De onde vêm os dados

A tela **não faz nenhuma chamada própria ao backend**. Ela só recebe, via prop `itens`, a lista de
linhas que o usuário já tinha selecionado (checkbox) na tabela de Sortimento — os mesmos objetos
que vieram do endpoint `GET /api/sortimento`.

```
Sortimento (tabela) → usuário marca checkboxes → itensSel (estado local)
                                                        │
                                                        ▼
                                    <GerarPedido itens={itensSel} onVoltar={...} />
```

- Client: `SortimentoCliente` dentro de [`frontend/src/pages/AdminDashboard.jsx`](../frontend/src/pages/AdminDashboard.jsx) (visão admin) e
  [`frontend/src/components/Portfolio.jsx`](../frontend/src/components/Portfolio.jsx) (visão do cliente) mantêm o `Set` de EANs marcados e montam `itensSel`
  filtrando a lista completa de itens por esse `Set`.
- Fonte original dos dados: [`backend/routers/sortimento.py`](../backend/routers/sortimento.py) — junta `produto` + `linha` + `secao` + `estoque`
  (para saber o que tem estoque disponível e o `qtde_multipla`), com `ped_vda`/`nota`/`it_nota`/`it_pedv` do ERP (para saber o
  que já foi comprado no período e calcular o status). O EAN, código do fabricante, DUN, NCM,
  fator/caixa e `qtde_multipla` vêm todos direto da tabela `produto` do ERP — nada é recalculado
  na tela de Gerar Pedido, ela só reformata o que já chegou.

Campos usados pela tela (todos já presentes em cada item de `itens`):

| Campo | Origem (ERP) | Uso |
|---|---|---|
| `ean` | `produto.cd_barra` | código de barras / base do "Código Pedido" |
| `cod_fabricante` | `produto.cd_prod_fabric` | coluna "Cód. Fabricante" |
| `dun` | `produto.cd_barra_compra` | coluna "DUN" |
| `ncm` | `produto.cd_prod_ncm` | coluna "NCM" |
| `fator_caixa` | `produto.qtde_unid_cmp` | coluna "Fator/Caixa" (unidades por caixa) |
| `qtde_multipla` | `produto.qtde_multipla` | define o sufixo `C<n>` do Código Pedido (ver seção 2) |
| `cd_secao` | `secao.cd_secao` | BU do produto (agrupamento da tela) |
| `produto` | `produto.descricao` | nome do produto |
| `status` | calculado em `sortimento.py` | positivado / em_progresso / pendente / nunca_comprou |
| `unidades_vendidas`, `minimo` | calculado em `sortimento.py` | colunas "Vendido" / mínimo do período |

## 2. Código Pedido (SKU)

```js
function codigoPedido(item) {
  if (!item.qtde_multipla) return item.ean
  return `${item.ean}C${Math.round(item.qtde_multipla)}`
}
```
[`GerarPedido.jsx:22-25`](../frontend/src/components/GerarPedido.jsx#L22-L25)

- Produto comum (compra em unidade, `qtde_multipla` vazio no ERP): **Código Pedido = EAN puro**.
- Produto com embalagem intermediária cadastrada no ERP (dúzia, display, etc. — campo
  `produto.qtde_multipla` preenchido): **Código Pedido = EAN + "C" + qtde_multipla arredondado**.
  Exemplo: EAN `7891700080415` com `qtde_multipla = 10` → `7891700080415C10`.

Esse é o valor usado como identificador do produto em **todos** os exports (coluna "Código
Pedido" e coluna "SKU" do arquivo da plataforma).

## 3. As 3 opções de exportação

Os itens são sempre agrupados por BU na ordem fixa `LMP_CASA → AL_NUT → LMP_CUPE → HGPER_BB`
(Home Care, Nutrição, Personal Care, Beleza & Bem-Estar) antes de exportar.

### 3.1 Copiar para Excel (`handleCopiar`)
Copia texto separado por TAB pra área de transferência (`navigator.clipboard.writeText`), pronto
pra colar direto numa planilha aberta. Colunas: `BU · Cód. Fabricante · EAN · Código Pedido · DUN
· NCM · Fator/Caixa · Produto · Status`.

### 3.2 Exportar Excel (`handleExcel`)
Gera um `.xlsx` (`Pedido_Unilever_AAAA-MM-DD.xlsx`) com as mesmas colunas do item 3.1 mais
`Vendido (un)` e `Mínimo (un)` — é a planilha de uso interno/conferência, não é o formato de
importação.

### 3.3 Exportar Pedido de Compra (`handleExportarPedidoCompra`) — formato da plataforma
O único dos três que segue um **layout fixo exigido pela plataforma de importação de pedidos**
(Infracommerce). Estrutura exata do `.xlsx` gerado (`pedido_compra_AAAA-MM-DD.xlsx`):

| Linha | Coluna A | Coluna B |
|---|---|---|
| 1 | `ATENÇÃO: Não remova o cabeçalho desta planilha (linhas 1 a 4).` | — |
| 2 | `Passo 1: Insira um SKU (código de barras) por linha e a respectiva quantidade desejada.` | — |
| 3 | `Passo 2: Salve o arquivo, mantenha o formato original (.xlsx) e importe na plataforma.` | — |
| 4 | `SKU (código de barras)` | `Quantidade desejada` |
| 5+ | `codigoPedido(item)` (EAN ou EAN+C\<n\>) | `1` |

Pontos importantes:
- As linhas 1–4 são fixas e **não podem ser removidas** — é a plataforma que exige esse
  cabeçalho de instrução para aceitar a importação.
- A quantidade desejada **sempre sai como `1`** — a tela não pergunta quantidade nenhuma ao
  usuário. O `1` é só um placeholder para a pessoa que vai comprar editar manualmente com a
  quantidade real antes de importar na plataforma.
- Uma linha por item selecionado, sem agrupar por BU (a separação por BU só existe na tela e nos
  outros dois exports).

## 4. Resumo do fluxo completo

```
ERP (SQL Server)
   └─ GET /api/sortimento  (backend/routers/sortimento.py)
        └─ tabela de Sortimento (Portfolio.jsx / AdminDashboard.jsx)
             └─ usuário seleciona linhas (checkbox)
                  └─ GerarPedido.jsx  (só client-side, sem chamada nova ao backend)
                       ├─ Copiar para Excel   → clipboard (TSV)
                       ├─ Exportar Excel      → .xlsx uso interno
                       └─ Exportar Pedido de Compra → .xlsx formato Infracommerce
```

Não existe, hoje, nenhum endpoint de backend que registre o pedido gerado aqui de volta no ERP —
o pedido "de verdade" só passa a existir depois que o arquivo é importado manualmente na
plataforma da Infracommerce. As telas de `pedidos.py` (`/api/pedidos`, `/api/pedidos-abertos`)
mostram pedidos que **já foram criados** dessa forma e voltaram para o ERP, não os que ainda
estão sendo montados nesta tela.
