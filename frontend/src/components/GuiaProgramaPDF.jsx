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
    }

    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      .page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
      @page { size: A4; margin: 0; }
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
      min-height: 297mm;
      background: white;
      margin: 30px auto;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      border-radius: 8px;
      overflow: hidden;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      padding: 36px 40px 28px;
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
    }
    .header h1 {
      font-size: 26px;
      font-weight: 800;
      margin-top: 12px;
      letter-spacing: -0.5px;
    }
    .header .subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.65);
      margin-top: 4px;
    }
    .header .cliente {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.15);
    }

    /* ── Body ── */
    .body { padding: 32px 40px; }

    /* ── Intro ── */
    .intro {
      background: #f0f9ff;
      border-left: 4px solid #2563eb;
      border-radius: 0 8px 8px 0;
      padding: 14px 16px;
      margin-bottom: 28px;
      font-size: 12.5px;
      color: #334155;
      line-height: 1.6;
    }
    .intro strong { color: #1e3a5f; }

    /* ── Seção ── */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    /* ── Pilares grid ── */
    .pilares {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 28px;
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
      padding: 12px 14px;
    }
    .pilar-nome {
      font-size: 12px;
      font-weight: 700;
      color: white;
    }
    .pilar-pct {
      font-size: 18px;
      font-weight: 800;
      color: white;
    }
    .pilar-body { padding: 12px 14px; background: white; }
    .pilar-desc {
      font-size: 11.5px;
      color: #475569;
      line-height: 1.55;
      margin-bottom: 10px;
    }

    /* Faixas */
    .faixa-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .faixa {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }
    .faixa-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .faixa-label { font-size: 11px; color: #475569; flex: 1; }
    .faixa-valor {
      font-size: 11px;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 10px;
    }
    .faixa-zero  { background: #fee2e2; color: #dc2626; }
    .faixa-meio  { background: #fef3c7; color: #d97706; }
    .faixa-max   { background: #dcfce7; color: #16a34a; }
    .faixa-prop  { background: #e0f2fe; color: #0284c7; }
    .faixa-bin   { background: #f3e8ff; color: #7c3aed; }

    /* ── BUs section ── */
    .bus-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 28px;
    }
    .bu-card {
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .bu-header {
      padding: 8px 12px;
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
    }
    .bu-nome { font-size: 12px; font-weight: 600; color: white; }
    .bu-body { padding: 10px 12px; background: white; }
    .bu-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 11px;
    }
    .bu-row:last-child { border-bottom: none; }
    .bu-row-label { color: #64748b; }
    .bu-row-val { font-weight: 600; color: #1e293b; }
    .bu-row-pct { font-weight: 700; color: #2563eb; }

    /* ── Como funciona a conta ── */
    .conta-box {
      background: linear-gradient(135deg, #fefce8, #fffbeb);
      border: 1.5px solid #fde68a;
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 28px;
    }
    .conta-title {
      font-size: 12px;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 10px;
    }
    .formula {
      font-family: monospace;
      font-size: 11.5px;
      color: #78350f;
      background: rgba(0,0,0,0.05);
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      line-height: 1.7;
    }
    .formula strong { color: #92400e; }
    .conta-exemplo {
      font-size: 11px;
      color: #78350f;
      line-height: 1.6;
    }

    /* ── Checklist ── */
    .checklist {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 28px;
    }
    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .check-icon {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #dcfce7;
      color: #16a34a;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .check-text { font-size: 11px; color: #475569; line-height: 1.5; }
    .check-text strong { color: #1e293b; display: block; font-size: 11.5px; margin-bottom: 1px; }

    /* ── Footer ── */
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 16px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { font-size: 10.5px; color: #94a3b8; }
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
          <div style="font-size:22px; font-weight:800; color:#c9a227;">2,50%</div>
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
        o seu faturamento mensal em produtos Unilever, distribuído em <strong>4 pilares de performance</strong>.
        Quanto mais pilares você acionar e quanto maior for seu faturamento vs meta, maior será seu ganho.
        A meta de faturamento de cada BU é calculada automaticamente com base no mesmo mês do ano anterior + 15%.
      </div>

      <!-- PILARES -->
      <p class="section-title">Os 4 Pilares do Programa</p>
      <div class="pilares">

        <!-- Sortimento -->
        <div class="pilar">
          <div class="pilar-header" style="background: linear-gradient(135deg,#1d4ed8,#3b82f6)">
            <div class="pilar-nome">Sortimento</div>
            <div class="pilar-pct">0,50%</div>
          </div>
          <div class="pilar-body">
            <p class="pilar-desc">
              Mede quantos SKUs ativos da Unilever você está comprando em relação ao portfólio disponível.
              Cada BU tem uma meta de EANs definida pelo time comercial.
            </p>
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
          <div class="pilar-header" style="background: linear-gradient(135deg,#b45309,#f59e0b)">
            <div class="pilar-nome">Faturamento</div>
            <div class="pilar-pct">1,00%</div>
          </div>
          <div class="pilar-body">
            <p class="pilar-desc">
              Pilar com maior peso: até 1,00% sobre o faturamento mensal.
              O percentual é proporcional ao atingimento da meta — quanto mais perto da meta, maior o ganho.
              A meta é o faturamento do mesmo mês do ano anterior acrescido de 15%.
            </p>
            <p class="faixa-title">Como é Calculado</p>
            <div class="faixa">
              <div class="faixa-dot" style="background:#0ea5e9"></div>
              <span class="faixa-label">Proporcional ao % atingido da meta (cap 100%)</span>
              <span class="faixa-valor faixa-prop">0–1,00%</span>
            </div>
            <div style="margin-top:8px; font-size:10.5px; color:#78716c; line-height:1.5;">
              Ex.: atingiu 60% da meta → ganho = 0,60% × faturamento<br/>
              Atingiu 100% ou mais → ganho máximo = 1,00% × faturamento
            </div>
          </div>
        </div>

        <!-- Ponto Extra -->
        <div class="pilar">
          <div class="pilar-header" style="background: linear-gradient(135deg,#6d28d9,#a855f7)">
            <div class="pilar-nome">Ponto Extra</div>
            <div class="pilar-pct">0,50%</div>
          </div>
          <div class="pilar-body">
            <p class="pilar-desc">
              Bonificação binária: conquistada quando o PDV executa um espaço extra
              de exposição para produtos Unilever (ponta de gôndola, ilha, display).
              Apurada mensalmente pelo time de trade marketing.
            </p>
            <p class="faixa-title">Regra de Apuração</p>
            <div class="faixa">
              <div class="faixa-dot" style="background:#d1d5db"></div>
              <span class="faixa-label">Não executou ponto extra</span>
              <span class="faixa-valor faixa-zero">0%</span>
            </div>
            <div class="faixa">
              <div class="faixa-dot" style="background:#a855f7"></div>
              <span class="faixa-label">Executou ponto extra aprovado</span>
              <span class="faixa-valor faixa-bin">+0,50%</span>
            </div>
          </div>
        </div>

        <!-- Planograma -->
        <div class="pilar">
          <div class="pilar-header" style="background: linear-gradient(135deg,#065f46,#10b981)">
            <div class="pilar-nome">Planograma</div>
            <div class="pilar-pct">0,50%</div>
          </div>
          <div class="pilar-body">
            <p class="pilar-desc">
              Mede a execução correta do planograma de gôndola definido pela Unilever —
              posicionamento, quantidade de frentes e sequência dos produtos conforme padrão.
              Verificado pelo promotor ou time de trade.
            </p>
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

      <!-- COMO A CONTA FUNCIONA -->
      <div class="conta-box">
        <p class="conta-title">Como o Ganho é Calculado</p>
        <div class="formula">
          <strong>Ganho por BU</strong> = Faturamento da BU × (Sort% + Fat% + PE + Plan) / 100<br/>
          <strong>Ganho Total</strong> = Soma do ganho de todas as BUs (HC + NT + PC + BW)
        </div>
        <p class="conta-exemplo">
          <strong>Exemplo prático (BU Home Care):</strong><br/>
          Faturamento: R$ 150.000 | Sortimento: 92% → +0,50% | Fat: 80% → +0,80% | PE: ✓ +0,50% | Planograma: ✗ 0%<br/>
          → Total = 0,50 + 0,80 + 0,50 + 0,00 = 1,80% | Ganho HC = R$ 150.000 × 1,80% = <strong>R$ 2.700,00</strong>
        </p>
      </div>

      <!-- BUs -->
      <p class="section-title">As 4 Unidades de Negócio (BUs)</p>
      <div class="bus-grid">
        <div class="bu-card">
          <div class="bu-header" style="background:#3b82f6">
            <span class="bu-badge" style="background:rgba(0,0,0,0.2)">HC</span>
            <span class="bu-nome">Home Care</span>
          </div>
          <div class="bu-body">
            <div class="bu-row"><span class="bu-row-label">Categorias</span><span class="bu-row-val">Limpeza doméstica, amaciante, detergente</span></div>
            <div class="bu-row"><span class="bu-row-label">Marcas</span><span class="bu-row-val">OMO, Comfort, Brilhante, Minuano, Cif</span></div>
            <div class="bu-row"><span class="bu-row-label">Potencial máx.</span><span class="bu-row-pct">2,50% do fat. HC</span></div>
          </div>
        </div>
        <div class="bu-card">
          <div class="bu-header" style="background:#22c55e">
            <span class="bu-badge" style="background:rgba(0,0,0,0.2)">NT</span>
            <span class="bu-nome">Nutrição</span>
          </div>
          <div class="bu-body">
            <div class="bu-row"><span class="bu-row-label">Categorias</span><span class="bu-row-val">Sorvetes, temperos, maionese, sopas</span></div>
            <div class="bu-row"><span class="bu-row-label">Marcas</span><span class="bu-row-val">Knorr, Hellmann's, Ben & Jerry's, Kibon</span></div>
            <div class="bu-row"><span class="bu-row-label">Potencial máx.</span><span class="bu-row-pct">2,50% do fat. NT</span></div>
          </div>
        </div>
        <div class="bu-card">
          <div class="bu-header" style="background:#ec4899">
            <span class="bu-badge" style="background:rgba(0,0,0,0.2)">PC</span>
            <span class="bu-nome">Personal Care</span>
          </div>
          <div class="bu-body">
            <div class="bu-row"><span class="bu-row-label">Categorias</span><span class="bu-row-val">Higiene pessoal, desodorante, sabonete</span></div>
            <div class="bu-row"><span class="bu-row-label">Marcas</span><span class="bu-row-val">Dove, Rexona, Lux, Axe, Vaseline</span></div>
            <div class="bu-row"><span class="bu-row-label">Potencial máx.</span><span class="bu-row-pct">2,50% do fat. PC</span></div>
          </div>
        </div>
        <div class="bu-card">
          <div class="bu-header" style="background:#a855f7">
            <span class="bu-badge" style="background:rgba(0,0,0,0.2)">BW</span>
            <span class="bu-nome">Beleza & Bem-Estar</span>
          </div>
          <div class="bu-body">
            <div class="bu-row"><span class="bu-row-label">Categorias</span><span class="bu-row-val">Cabelos, skincare, protetor solar</span></div>
            <div class="bu-row"><span class="bu-row-label">Marcas</span><span class="bu-row-val">TRESemmé, Seda, Sunsilk, Simple</span></div>
            <div class="bu-row"><span class="bu-row-label">Potencial máx.</span><span class="bu-row-pct">2,50% do fat. BW</span></div>
          </div>
        </div>
      </div>

      <!-- CHECKLIST -->
      <p class="section-title">Como Maximizar Seu Retorno</p>
      <div class="checklist">
        <div class="check-item">
          <div class="check-icon">1</div>
          <div class="check-text">
            <strong>Amplie o sortimento</strong>
            Garanta 92%+ dos EANs meta em cada BU para atingir os 0,50% de Sortimento.
          </div>
        </div>
        <div class="check-item">
          <div class="check-icon">2</div>
          <div class="check-text">
            <strong>Bata a meta de faturamento</strong>
            O pilar de Faturamento é proporcional. Cada % a mais de atingimento
            significa mais ganho — não existe "patamar mínimo".
          </div>
        </div>
        <div class="check-item">
          <div class="check-icon">3</div>
          <div class="check-text">
            <strong>Execute o Ponto Extra</strong>
            Ative pontos extras de exposição em seus PDVs para garantir +0,50%
            em todas as BUs elegíveis.
          </div>
        </div>
        <div class="check-item">
          <div class="check-icon">4</div>
          <div class="check-text">
            <strong>Siga o Planograma</strong>
            Mantenha o planograma atualizado e aprovado para garantir +0,50%.
            Verifique com seu promotor regularmente.
          </div>
        </div>
        <div class="check-item">
          <div class="check-icon">5</div>
          <div class="check-text">
            <strong>Acompanhe mês a mês</strong>
            Monitore o atingimento em tempo real pelo dashboard — o ganho
            é calculado todo mês e acumulado no período da campanha.
          </div>
        </div>
        <div class="check-item">
          <div class="check-icon">6</div>
          <div class="check-text">
            <strong>Ative todas as BUs</strong>
            Cada BU tem seu próprio potencial de 2,50%. Não concentre pedidos —
            distribua compras em HC, NT, PC e BW para maximizar o ganho total.
          </div>
        </div>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-left">
        <strong>Zaffalon Distribuidora</strong> · Programa Ponderada Unilever<br/>
        Acesse seu dashboard em tempo real para acompanhar o atingimento.
      </div>
      <div class="footer-right">
        Gerado em ${new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>

  </div>

  <script>
    // Detecta se veio de mobile e sugere usar "Compartilhar > Imprimir"
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      document.querySelector('.no-print').innerHTML +=
        '<span style="font-size:11px;color:#64748b;align-self:center;">Em mobile: use Compartilhar > Imprimir</span>';
    }
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=750,scrollbars=yes')
  win.document.write(html)
  win.document.close()
}
