// Abre uma janela HTML formatada para impressão/PDF — sem dependências extras.
export default function abrirGuiaPrograma(nomeCliente) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Guia Programa Ponderada — ${nomeCliente || 'Cliente'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: #f8fafc;
      color: #1e293b;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      .page {
        box-shadow: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        width: 100% !important;
      }
      @page { size: A4 portrait; margin: 12mm 14mm; }

      /* evita cortes dentro de blocos */
      .pilar, .bu-card, .check-item, .conta-box, .intro, .checklist { page-break-inside: avoid; }
      .section-block { page-break-inside: avoid; }
      .footer { page-break-inside: avoid; }
    }

    /* ── Botão de impressão ── */
    .no-print {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 100;
    }
    .btn {
      background: #1e3a5f;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .btn:hover { background: #2563eb; }

    /* ── Página ── */
    .page {
      width: 210mm;
      background: white;
      margin: 30px auto;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      border-radius: 8px;
      overflow: hidden;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      padding: 32px 36px 24px;
      color: white;
    }
    .header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }
    .badge {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.25);
      color: white;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 20px;
      display: inline-block;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 800;
      margin-top: 10px;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    .header .subtitle {
      font-size: 12.5px;
      color: rgba(255,255,255,0.65);
      margin-top: 4px;
    }
    .header .cliente {
      font-size: 11.5px;
      color: rgba(255,255,255,0.5);
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.15);
    }

    /* ── Body ── */
    .body { padding: 28px 36px; }

    /* ── Intro ── */
    .intro {
      background: #f0f9ff;
      border-left: 4px solid #2563eb;
      border-radius: 0 8px 8px 0;
      padding: 13px 15px;
      margin-bottom: 24px;
      font-size: 12px;
      color: #334155;
      line-height: 1.6;
    }
    .intro strong { color: #1e3a5f; }

    /* ── Seção ── */
    .section-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 10px;
    }
    .section-block { margin-bottom: 24px; }

    /* ── Pilares grid ── */
    .pilares {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .pilar {
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .pilar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 11px 13px;
    }
    .pilar-nome { font-size: 12px; font-weight: 700; color: white; }
    .pilar-pct  { font-size: 17px; font-weight: 800; color: white; }
    .pilar-body { padding: 11px 13px; background: white; }
    .pilar-desc {
      font-size: 11px;
      color: #475569;
      line-height: 1.55;
      margin-bottom: 10px;
    }
    .faixa-title {
      font-size: 9.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 5px;
    }
    .faixa {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 4px;
    }
    .faixa-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .faixa-label { font-size: 10.5px; color: #475569; flex: 1; }
    .faixa-valor {
      font-size: 10.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 10px;
    }
    .faixa-zero { background: #fee2e2; color: #dc2626; }
    .faixa-meio { background: #fef3c7; color: #d97706; }
    .faixa-max  { background: #dcfce7; color: #16a34a; }
    .faixa-prop { background: #e0f2fe; color: #0284c7; }
    .faixa-bin  { background: #f3e8ff; color: #7c3aed; }
    .faixa-note {
      font-size: 10px;
      color: #78716c;
      margin-top: 6px;
      line-height: 1.5;
      background: #fafaf9;
      border-radius: 6px;
      padding: 6px 8px;
    }

    /* ── BUs section ── */
    .bus-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .bu-card {
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .bu-header {
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bu-badge {
      font-size: 10px;
      font-weight: 700;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(0,0,0,0.2);
    }
    .bu-nome { font-size: 12.5px; font-weight: 700; color: white; }
    .bu-body { padding: 12px 14px; background: white; }
    .bu-potencial {
      font-size: 11px;
      color: #475569;
      margin-bottom: 8px;
    }
    .bu-potencial strong { color: #1e3a5f; }
    .bu-pilares {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
    }
    .bu-pilar-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 10.5px;
    }
    .bu-pilar-nome { color: #64748b; font-weight: 600; display: block; }
    .bu-pilar-val  { color: #2563eb; font-weight: 700; }

    /* ── Como funciona a conta ── */
    .conta-box {
      background: linear-gradient(135deg, #fefce8, #fffbeb);
      border: 1.5px solid #fde68a;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .conta-title { font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 9px; }
    .formula {
      font-family: monospace;
      font-size: 11px;
      color: #78350f;
      background: rgba(0,0,0,0.05);
      padding: 8px 11px;
      border-radius: 6px;
      margin-bottom: 8px;
      line-height: 1.7;
    }
    .formula strong { color: #92400e; }
    .conta-exemplo { font-size: 11px; color: #78350f; line-height: 1.6; }

    /* ── Checklist ── */
    .checklist {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 9px 11px;
    }
    .check-icon {
      width: 17px; height: 17px;
      border-radius: 50%;
      background: #dcfce7; color: #16a34a;
      font-size: 9px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .check-text { font-size: 10.5px; color: #475569; line-height: 1.5; }
    .check-text strong { color: #1e293b; display: block; font-size: 11px; margin-bottom: 1px; }

    /* ── Footer ── */
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 13px 36px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 24px;
    }
    .footer-left  { font-size: 10px; color: #94a3b8; }
    .footer-left strong { color: #64748b; }
    .footer-right { font-size: 10px; color: #cbd5e1; }
  </style>
</head>
<body>

  <div class="no-print">
    <button class="btn" onclick="window.print()">⬇ Baixar PDF</button>
    <button class="btn" style="background:#475569" onclick="window.close()">Fechar</button>
  </div>

  <div class="page">

    <!-- HEADER -->
    <div class="header">
      <div class="header-top">
        <div>
          <span class="badge">Programa Ponderada · Unilever</span>
          <h1>Guia de Alavancas<br/>de Performance</h1>
          <p class="subtitle">Entenda como maximizar seu retorno em cada BU</p>
        </div>
        <div style="text-align:right; color:rgba(255,255,255,0.4); font-size:11px; padding-top:4px;">
          <div style="font-size:20px; font-weight:800; color:#c9a227;">2,50%</div>
          <div>potencial máximo</div>
          <div>sobre o faturamento</div>
        </div>
      </div>
      ${nomeCliente ? `<p class="cliente">Preparado para: <strong style="color:white">${nomeCliente}</strong></p>` : ''}
    </div>

    <div class="body">

      <!-- INTRO -->
      <div class="intro">
        O <strong>Programa Ponderada</strong> oferece até <strong>2,50% de bonificação</strong> sobre
        o faturamento mensal em produtos Unilever, distribuído em <strong>4 pilares de performance</strong>.
        A meta de faturamento de cada BU é calculada automaticamente com base no mesmo mês do ano anterior + 15%.
      </div>

      <!-- PILARES -->
      <div class="section-block">
        <p class="section-title">Os 4 Pilares do Programa</p>
        <div class="pilares">

          <!-- Sortimento -->
          <div class="pilar">
            <div class="pilar-header" style="background:linear-gradient(135deg,#1d4ed8,#3b82f6)">
              <span class="pilar-nome">Sortimento</span>
              <span class="pilar-pct">0,50%</span>
            </div>
            <div class="pilar-body">
              <p class="pilar-desc">Mede quantos SKUs ativos da Unilever você compra em relação ao portfólio disponível. Cada BU tem uma meta de EANs definida pelo time comercial.</p>
              <p class="faixa-title">Faixas de Atingimento</p>
              <div class="faixa">
                <div class="faixa-dot" style="background:#ef4444"></div>
                <span class="faixa-label">Abaixo de 70% dos EANs meta</span>
                <span class="faixa-valor faixa-zero">0%</span>
              </div>
              <div class="faixa">
                <div class="faixa-dot" style="background:#f59e0b"></div>
                <span class="faixa-label">Entre 70% e 91% dos EANs meta</span>
                <span class="faixa-valor faixa-meio">+0,25%</span>
              </div>
              <div class="faixa">
                <div class="faixa-dot" style="background:#22c55e"></div>
                <span class="faixa-label">92% ou mais dos EANs meta</span>
                <span class="faixa-valor faixa-max">+0,50%</span>
              </div>
            </div>
          </div>

          <!-- Faturamento -->
          <div class="pilar">
            <div class="pilar-header" style="background:linear-gradient(135deg,#b45309,#f59e0b)">
              <span class="pilar-nome">Faturamento</span>
              <span class="pilar-pct">1,00%</span>
            </div>
            <div class="pilar-body">
              <p class="pilar-desc">Maior peso do programa. O percentual é proporcional ao atingimento da meta — quanto mais perto, maior o ganho. Meta = mesmo mês do ano anterior + 15%.</p>
              <p class="faixa-title">Como é Calculado</p>
              <div class="faixa">
                <div class="faixa-dot" style="background:#0ea5e9"></div>
                <span class="faixa-label">Proporcional ao % atingido (cap 100%)</span>
                <span class="faixa-valor faixa-prop">0–1,00%</span>
              </div>
              <div class="faixa-note">
                Ex.: atingiu 60% da meta → ganho = 0,60%<br/>
                Atingiu 100% ou mais → ganho máximo = 1,00%
              </div>
            </div>
          </div>

          <!-- Ponto Extra -->
          <div class="pilar">
            <div class="pilar-header" style="background:linear-gradient(135deg,#6d28d9,#a855f7)">
              <span class="pilar-nome">Ponto Extra</span>
              <span class="pilar-pct">0,50%</span>
            </div>
            <div class="pilar-body">
              <p class="pilar-desc">Bonificação por execução de espaço extra de exposição no PDV: ponta de gôndola, ilha ou display. Apurada mensalmente pelo time de trade marketing.</p>
              <p class="faixa-title">Regra de Apuração</p>
              <div class="faixa">
                <div class="faixa-dot" style="background:#d1d5db"></div>
                <span class="faixa-label">Não executou ponto extra</span>
                <span class="faixa-valor faixa-zero">0%</span>
              </div>
              <div class="faixa">
                <div class="faixa-dot" style="background:#a855f7"></div>
                <span class="faixa-label">Executou e foi aprovado</span>
                <span class="faixa-valor faixa-bin">+0,50%</span>
              </div>
            </div>
          </div>

          <!-- Planograma -->
          <div class="pilar">
            <div class="pilar-header" style="background:linear-gradient(135deg,#065f46,#10b981)">
              <span class="pilar-nome">Planograma</span>
              <span class="pilar-pct">0,50%</span>
            </div>
            <div class="pilar-body">
              <p class="pilar-desc">Avalia a execução correta do planograma de gôndola — posicionamento, número de frentes e sequência dos produtos conforme o padrão Unilever.</p>
              <p class="faixa-title">Regra de Apuração</p>
              <div class="faixa">
                <div class="faixa-dot" style="background:#d1d5db"></div>
                <span class="faixa-label">Planograma não executado / reprovado</span>
                <span class="faixa-valor faixa-zero">0%</span>
              </div>
              <div class="faixa">
                <div class="faixa-dot" style="background:#10b981"></div>
                <span class="faixa-label">Planograma executado e aprovado</span>
                <span class="faixa-valor faixa-max">+0,50%</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- COMO A CONTA FUNCIONA -->
      <div class="section-block">
        <div class="conta-box">
          <p class="conta-title">Como o Ganho é Calculado</p>
          <div class="formula">
<strong>Ganho por BU</strong>  = Faturamento da BU × (Sort% + Fat% + PE + Plan) / 100
<strong>Ganho Total</strong>   = Soma do ganho de todas as BUs (HC + NT + PC + BW)
          </div>
          <p class="conta-exemplo">
            <strong>Exemplo (BU Home Care):</strong> Faturamento R$ 150.000 | Sortimento 92% → +0,50% | Fat 80% → +0,80% | PE ✓ +0,50% | Planograma ✗ 0%<br/>
            → Total acumulado = 1,80% | <strong>Ganho HC = R$ 150.000 × 1,80% = R$ 2.700,00</strong>
          </p>
        </div>
      </div>

      <!-- BUs -->
      <div class="section-block">
        <p class="section-title">As 4 Unidades de Negócio (BUs)</p>
        <div class="bus-grid">

          <div class="bu-card">
            <div class="bu-header" style="background:#3b82f6">
              <span class="bu-badge">HC</span>
              <span class="bu-nome">Home Care</span>
            </div>
            <div class="bu-body">
              <p class="bu-potencial">Potencial máximo: <strong>2,50% do faturamento HC</strong></p>
              <div class="bu-pilares">
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Sortimento</span><span class="bu-pilar-val">até +0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Faturamento</span><span class="bu-pilar-val">até +1,00%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Ponto Extra</span><span class="bu-pilar-val">+0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Planograma</span><span class="bu-pilar-val">+0,50%</span></div>
              </div>
            </div>
          </div>

          <div class="bu-card">
            <div class="bu-header" style="background:#22c55e">
              <span class="bu-badge">NT</span>
              <span class="bu-nome">Nutrição</span>
            </div>
            <div class="bu-body">
              <p class="bu-potencial">Potencial máximo: <strong>2,50% do faturamento NT</strong></p>
              <div class="bu-pilares">
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Sortimento</span><span class="bu-pilar-val">até +0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Faturamento</span><span class="bu-pilar-val">até +1,00%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Ponto Extra</span><span class="bu-pilar-val">+0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Planograma</span><span class="bu-pilar-val">+0,50%</span></div>
              </div>
            </div>
          </div>

          <div class="bu-card">
            <div class="bu-header" style="background:#ec4899">
              <span class="bu-badge">PC</span>
              <span class="bu-nome">Personal Care</span>
            </div>
            <div class="bu-body">
              <p class="bu-potencial">Potencial máximo: <strong>2,50% do faturamento PC</strong></p>
              <div class="bu-pilares">
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Sortimento</span><span class="bu-pilar-val">até +0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Faturamento</span><span class="bu-pilar-val">até +1,00%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Ponto Extra</span><span class="bu-pilar-val">+0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Planograma</span><span class="bu-pilar-val">+0,50%</span></div>
              </div>
            </div>
          </div>

          <div class="bu-card">
            <div class="bu-header" style="background:#a855f7">
              <span class="bu-badge">BW</span>
              <span class="bu-nome">Beleza &amp; Bem-Estar</span>
            </div>
            <div class="bu-body">
              <p class="bu-potencial">Potencial máximo: <strong>2,50% do faturamento BW</strong></p>
              <div class="bu-pilares">
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Sortimento</span><span class="bu-pilar-val">até +0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Faturamento</span><span class="bu-pilar-val">até +1,00%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Ponto Extra</span><span class="bu-pilar-val">+0,50%</span></div>
                <div class="bu-pilar-item"><span class="bu-pilar-nome">Planograma</span><span class="bu-pilar-val">+0,50%</span></div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- COMO USAR O PORTFOLIO -->
      <div class="section-block">
        <p class="section-title">Como Usar o Portfólio do Dashboard</p>
        <div style="border:1.5px solid #e2e8f0; border-radius:10px; overflow:hidden;">

          <!-- Passo 1 -->
          <div style="display:flex; align-items:flex-start; gap:14px; padding:13px 15px; border-bottom:1px solid #f1f5f9;">
            <div style="width:26px; height:26px; border-radius:50%; background:#1e3a5f; color:white; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">1</div>
            <div>
              <p style="font-size:11.5px; font-weight:700; color:#1e293b; margin-bottom:3px;">Selecione a aba Portfólio</p>
              <p style="font-size:10.5px; color:#475569; line-height:1.55;">No topo do dashboard, clique em <strong>Portfólio</strong>. Você verá os cards resumo de cada BU (HC, NT, PC, BW) com o percentual de produtos positivados e a meta de EANs.</p>
            </div>
          </div>

          <!-- Passo 2 -->
          <div style="display:flex; align-items:flex-start; gap:14px; padding:13px 15px; border-bottom:1px solid #f1f5f9;">
            <div style="width:26px; height:26px; border-radius:50%; background:#2563eb; color:white; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">2</div>
            <div>
              <p style="font-size:11.5px; font-weight:700; color:#1e293b; margin-bottom:3px;">Filtre por Status (opcional)</p>
              <p style="font-size:10.5px; color:#475569; line-height:1.55;">Na barra de filtros, clique no status desejado — <strong>Pendente</strong> (nunca atingiu o mínimo no mês) ou <strong>Em Progresso</strong> (comprou mas ainda abaixo do mínimo). Use isso para focar na lista de produtos que precisam de ação.</p>
            </div>
          </div>

          <!-- Passo 3 -->
          <div style="display:flex; align-items:flex-start; gap:14px; padding:13px 15px; border-bottom:1px solid #f1f5f9;">
            <div style="width:26px; height:26px; border-radius:50%; background:#0284c7; color:white; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">3</div>
            <div>
              <p style="font-size:11.5px; font-weight:700; color:#1e293b; margin-bottom:3px;">Selecione os produtos via botão ⊕</p>
              <p style="font-size:10.5px; color:#475569; line-height:1.55;">Ao lado de cada BU na barra de filtros há um botão <strong>⊕</strong>. Clicando nele, todos os produtos <strong>Pendentes e Em Progresso</strong> daquela BU são selecionados automaticamente. Você pode clicar ⊕ em múltiplas BUs ao mesmo tempo — por exemplo BW e PC — para montar o pedido de várias BUs de uma vez.</p>
              <p style="font-size:10px; color:#94a3b8; margin-top:4px;">Dica: se quiser incluir produtos "Nunca Comprou", filtre por esse status antes de clicar ⊕.</p>
            </div>
          </div>

          <!-- Passo 4 -->
          <div style="display:flex; align-items:flex-start; gap:14px; padding:13px 15px; border-bottom:1px solid #f1f5f9;">
            <div style="width:26px; height:26px; border-radius:50%; background:#0891b2; color:white; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">4</div>
            <div>
              <p style="font-size:11.5px; font-weight:700; color:#1e293b; margin-bottom:3px;">Gere o Pedido ou Relatório de Cadastro</p>
              <p style="font-size:10.5px; color:#475569; line-height:1.55;">Com os produtos selecionados, aparece uma barra flutuante no rodapé da tela com a contagem por BU. Clique em <strong>Gerar Pedido</strong> para visualizar a sugestão de compra com quantidades e caixas, ou em <strong>Cadastro</strong> para listar os produtos que o cliente ainda nunca comprou e precisa solicitar inclusão.</p>
            </div>
          </div>

          <!-- Passo 5 -->
          <div style="display:flex; align-items:flex-start; gap:14px; padding:13px 15px;">
            <div style="width:26px; height:26px; border-radius:50%; background:#16a34a; color:white; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">5</div>
            <div>
              <p style="font-size:11.5px; font-weight:700; color:#1e293b; margin-bottom:3px;">Acompanhe o Programa mês a mês</p>
              <p style="font-size:10.5px; color:#475569; line-height:1.55;">Na aba <strong>Programa</strong>, veja em tempo real o ganho estimado por BU, o percentual de sortimento e faturamento atingidos, e a situação de Ponto Extra e Planograma. Na aba <strong>Faturamento</strong>, acompanhe o valor faturado no mês atual versus a meta — e quanto falta para atingi-la em cada BU.</p>
            </div>
          </div>

        </div>
      </div>

      <!-- CHECKLIST -->
      <div class="section-block">
        <p class="section-title">Como Maximizar Seu Retorno</p>
        <div class="checklist">
          <div class="check-item">
            <div class="check-icon">1</div>
            <div class="check-text"><strong>Amplie o sortimento</strong>Garanta 92%+ dos EANs meta em cada BU para atingir os 0,50% de Sortimento.</div>
          </div>
          <div class="check-item">
            <div class="check-icon">2</div>
            <div class="check-text"><strong>Bata a meta de faturamento</strong>O pilar é proporcional — cada % a mais de atingimento aumenta seu ganho. Não existe patamar mínimo.</div>
          </div>
          <div class="check-item">
            <div class="check-icon">3</div>
            <div class="check-text"><strong>Execute o Ponto Extra</strong>Ative pontos extras de exposição nos seus PDVs para garantir +0,50% em todas as BUs elegíveis.</div>
          </div>
          <div class="check-item">
            <div class="check-icon">4</div>
            <div class="check-text"><strong>Siga o Planograma</strong>Mantenha o planograma aprovado para garantir +0,50%. Verifique periodicamente com seu promotor.</div>
          </div>
          <div class="check-item">
            <div class="check-icon">5</div>
            <div class="check-text"><strong>Ative todas as BUs</strong>Cada BU tem 2,50% independentes. Distribua compras em HC, NT, PC e BW — não concentre em uma só.</div>
          </div>
          <div class="check-item">
            <div class="check-icon">6</div>
            <div class="check-text"><strong>Acompanhe pelo dashboard</strong>Monitore o atingimento em tempo real. O ganho é calculado mês a mês e acumulado na campanha.</div>
          </div>
        </div>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-left">
        <strong>Zaffalon Distribuidora</strong> · Programa Ponderada Unilever<br/>
        Acesse seu dashboard para acompanhar o atingimento em tempo real.
      </div>
      <div class="footer-right">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    </div>

  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=920,height=780,scrollbars=yes')
  win.document.write(html)
  win.document.close()
}
