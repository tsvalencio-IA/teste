(function () {
  'use strict';

  const W = window;
  const D = document;
  const state = { osId: '', itemKey: '', os: null, item: null, fornecedores: [], mensagens: [] };

  function $(id) { return D.getElementById(id); }
  function J() { return W.J || {}; }
  function db() { return W.db || J().db || null; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escAttr(v) { return esc(v).replace(/`/g, '&#96;'); }
  function onlyDigits(v) { return String(v || '').replace(/\D+/g, ''); }
  function norm(v) {
    return String(v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
  }
  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }
  function moeda(v) {
    return 'R$ ' + num(v).toFixed(2).replace('.', ',');
  }
  function nowISO() { return new Date().toISOString(); }
  function localDateAdd(days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 3));
    return d.toISOString().slice(0, 10);
  }
  function randomToken() {
    try {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return 'cot' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
    }
  }
  function phoneBR(v) {
    let d = onlyDigits(v);
    if (!d) return '';
    if (d.length <= 11 && !d.startsWith('55')) d = '55' + d;
    return d;
  }
  function cotMap(os) {
    const raw = os && os.cotacoesPecas;
    if (Array.isArray(raw)) {
      return raw.reduce((acc, item) => {
        if (item && item.key) acc[item.key] = item;
        return acc;
      }, {});
    }
    return raw && typeof raw === 'object' ? Object.assign({}, raw) : {};
  }
  function osUtils() {
    try { return typeof W.OSUtils === 'function' ? W.OSUtils() : (W.OSUtils || {}); } catch (_) { return {}; }
  }
  function budgetItems(os) {
    const U = osUtils();
    const cliente = (J().clientes || []).find(c => c.id === os?.clienteId);
    try { return U.buildBudgetItems ? (U.buildBudgetItems(os, cliente) || []) : []; } catch (_) { return []; }
  }
  function getItem(os, key) {
    const saved = cotMap(os)[key]?.item;
    if (saved && (saved.key || saved.desc || saved.descricao)) return saved;
    return budgetItems(os).find(i => String(i.key) === String(key)) || { key };
  }
  function veiculoOS(os) {
    const v = (J().veiculos || []).find(x => x.id === os?.veiculoId) || {};
    return {
      placa: String(os?.placa || v.placa || '').toUpperCase(),
      prefixo: os?.prefixo || os?.prefixoVeiculo || v.prefixo || v.frota || '',
      nome: [v.marca, v.modelo || os?.veiculo].filter(Boolean).join(' ') || os?.veiculo || 'Veiculo',
      tipo: os?.tipoVeiculo || v.tipo || ''
    };
  }
  function fornecedorContato(f) {
    const wpp = f.wpp || f.whatsapp || f.telefone || f.celular || f.phone || '';
    const email = f.email || f.mail || '';
    return { wpp, email, phone: phoneBR(wpp) };
  }
  function fornecedorTexto(f) {
    return [
      f.nome, f.razao, f.nomeFantasia, f.segmento, f.categorias, f.categoria,
      f.tags, f.marcas, f.obs, f.observacoes, f.cidade, f.uf
    ].filter(Boolean).join(' ');
  }
  function scoreFornecedor(f, item) {
    const texto = norm(fornecedorTexto(f));
    const desc = norm([item?.desc, item?.descricao, item?.codigo, item?.labelTipo].filter(Boolean).join(' '));
    if (!texto || !desc) return 0;
    let score = 0;
    const termos = desc.split(/[^a-z0-9]+/).filter(t => t.length >= 4);
    termos.forEach(t => { if (texto.includes(t)) score += 2; });
    [
      'bateria', 'oleo', 'filtro', 'freio', 'pastilha', 'disco', 'suspensao',
      'amortecedor', 'eletrica', 'motor', 'pneu', 'lataria', 'funilaria',
      'arrefecimento', 'radiador', 'injeção', 'injecao'
    ].forEach(t => { if (desc.includes(norm(t)) && texto.includes(norm(t))) score += 5; });
    if (f.preferencial || f.preferido || f.prioridade) score += 3;
    return score;
  }
  function fornecedoresOrdenados(item) {
    return (J().fornecedores || [])
      .map(f => Object.assign({}, f, { _scoreCotacao: scoreFornecedor(f, item) }))
      .sort((a, b) => (b._scoreCotacao || 0) - (a._scoreCotacao || 0) || String(a.nome || '').localeCompare(String(b.nome || '')));
  }
  function publicBaseOk() {
    const cfg = W.THIA_PUBLIC_LINKS || {};
    return !!(cfg.cotacaoFornecedor || cfg.baseUrl);
  }
  function publicUrl(token) {
    if (typeof W.thiaGetPublicUrl === 'function') {
      return W.thiaGetPublicUrl('cotacaoFornecedor', { tenant: J().tid || '', token });
    }
    return 'cotacao.html?tenant=' + encodeURIComponent(J().tid || '') + '&token=' + encodeURIComponent(token);
  }
  function osRefLabel(os) {
    return 'OS #' + String(os?.numero || os?.id || '').slice(-6).toUpperCase();
  }

  function ensureModal() {
    if ($('modalCotacaoFornecedores')) return;
    const style = D.createElement('style');
    style.textContent = `
      .cot-rfq-modal{max-width:1120px;width:96vw}
      .cot-rfq-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
      .cot-forn-card{display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;border:1px solid var(--border);background:rgba(255,255,255,.035);border-radius:4px;padding:9px;cursor:pointer}
      .cot-forn-card.is-suggested{border-color:rgba(0,255,136,.35)}
      .cot-forn-card.is-selected{background:rgba(0,255,136,.08);border-color:rgba(0,255,136,.55)}
      .cot-msg-card{border:1px solid var(--border);border-radius:4px;background:rgba(0,0,0,.14);padding:10px;margin-top:8px}
      .cot-msg-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
      @media(max-width:720px){.cot-rfq-modal{width:100vw;max-height:96vh}.cot-rfq-grid{grid-template-columns:1fr}.cot-msg-actions button{flex:1 1 140px}}
    `;
    D.head.appendChild(style);
    D.body.insertAdjacentHTML('beforeend', `
      <div class="overlay" id="modalCotacaoFornecedores">
        <div class="modal cot-rfq-modal">
          <div class="modal-head">
            <div class="modal-title">COTACAO AUTOMATIZADA DE PECA</div>
            <button class="modal-close" onclick="window.fecharCotacaoFornecedoresOS()">x</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="cotRfqOsId">
            <input type="hidden" id="cotRfqItemKey">
            <div id="cotRfqResumo" style="border:1px solid var(--border);background:var(--surf3);border-radius:4px;padding:12px;margin-bottom:12px;"></div>
            <div class="form-row cols-3">
              <div class="form-group"><label class="j-label">Buscar fornecedor</label><input class="j-input" id="cotRfqBusca" placeholder="nome, segmento, marca, cidade..." oninput="window.filtrarFornecedoresCotacao()"></div>
              <div class="form-group"><label class="j-label">Validade da cotacao</label><input type="date" class="j-input" id="cotRfqExpira"></div>
              <div class="form-group"><label class="j-label">Prioridade</label><select class="j-select" id="cotRfqPrioridade"><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
              <button type="button" class="btn-outline" onclick="window.selecionarFornecedoresCotacao('sugeridos')">Selecionar sugeridos</button>
              <button type="button" class="btn-outline" onclick="window.selecionarFornecedoresCotacao('todos')">Selecionar todos visiveis</button>
              <button type="button" class="btn-ghost" onclick="window.selecionarFornecedoresCotacao('limpar')">Limpar selecao</button>
            </div>
            <div id="cotRfqFornecedores" class="cot-rfq-grid"></div>
            <div class="form-group" style="margin-top:12px;">
              <label class="j-label">Observacao para os fornecedores</label>
              <textarea class="j-textarea" id="cotRfqObs" rows="3" placeholder="Ex: confirmar marca, prazo real, frete e disponibilidade para retirada/entrega."></textarea>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;">
              <button type="button" class="btn-primary" onclick="window.gerarEnvioCotacaoOS()">GERAR MENSAGENS DOS SELECIONADOS</button>
              <small id="cotRfqAvisoBase" style="font-family:var(--fm);font-size:.62rem;color:var(--muted);"></small>
            </div>
            <div id="cotRfqMensagens" style="margin-top:12px;"></div>
          </div>
          <div class="modal-foot">
            <button class="btn-ghost" onclick="window.fecharCotacaoFornecedoresOS()">FECHAR</button>
          </div>
        </div>
      </div>
    `);
  }

  function renderResumo() {
    const os = state.os || {};
    const item = state.item || {};
    const v = veiculoOS(os);
    const cliente = (J().clientes || []).find(c => c.id === os.clienteId) || {};
    $('cotRfqResumo').innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-family:var(--fm);font-size:.62rem;color:var(--success);font-weight:800;letter-spacing:1px;">PECA APROVADA PARA COTACAO</div>
          <div style="font-size:.88rem;color:var(--text);font-weight:800;">${item.codigo ? '[' + esc(item.codigo) + '] ' : ''}${esc(item.desc || item.descricao || '-')}</div>
          <small style="font-family:var(--fm);font-size:.62rem;color:var(--muted);">Qtd ${esc(item.qtd || 1)} | aprovado na ${esc(osRefLabel(os))}</small>
        </div>
        <div style="font-family:var(--fm);font-size:.66rem;color:var(--cyan);text-align:right;">
          ${v.prefixo ? 'Prefixo ' + esc(v.prefixo) + '<br>' : ''}${v.placa ? 'Placa ' + esc(v.placa) + '<br>' : ''}${esc(v.nome)}${cliente.nome ? '<br>Cliente: ' + esc(cliente.nome) : ''}
        </div>
      </div>`;
  }

  function renderFornecedores() {
    const box = $('cotRfqFornecedores');
    if (!box) return;
    const q = norm($('cotRfqBusca')?.value || '');
    const lista = state.fornecedores.filter(f => {
      if (!q) return true;
      return norm(fornecedorTexto(f)).includes(q) || norm(fornecedorContato(f).wpp).includes(q);
    });
    const haSugeridos = state.fornecedores.some(f => (f._scoreCotacao || 0) > 0);
    box.innerHTML = lista.map((f, idx) => {
      const contato = fornecedorContato(f);
      const sugerido = (f._scoreCotacao || 0) > 0;
      const checked = sugerido || (!haSugeridos && idx < 3);
      const contatoTxt = [contato.wpp ? 'WPP ' + contato.wpp : '', contato.email].filter(Boolean).join(' | ') || 'sem contato cadastrado';
      return `<label class="cot-forn-card ${sugerido ? 'is-suggested' : ''} ${checked ? 'is-selected' : ''}" data-search="${escAttr(norm(fornecedorTexto(f)))}">
        <input type="checkbox" class="cot-forn-check" value="${escAttr(f.id)}" ${checked ? 'checked' : ''} onchange="this.closest('.cot-forn-card').classList.toggle('is-selected',this.checked)">
        <span>
          <strong style="display:block;color:var(--text);font-size:.78rem;">${esc(f.nome || f.razao || f.nomeFantasia || 'Fornecedor')}</strong>
          <small style="display:block;color:${sugerido ? 'var(--success)' : 'var(--muted)'};font-family:var(--fm);font-size:.60rem;">${sugerido ? 'SUGERIDO PELO SISTEMA' : 'FORNECEDOR CADASTRADO'}</small>
          <small style="display:block;color:var(--muted);font-size:.66rem;">${esc(f.segmento || f.categoria || f.categorias || '-')}</small>
          <small style="display:block;color:var(--muted2);font-family:var(--fm);font-size:.60rem;">${esc(contatoTxt)}</small>
        </span>
      </label>`;
    }).join('') || '<div style="grid-column:1/-1;padding:18px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:4px;">Nenhum fornecedor encontrado. Cadastre fornecedores com WhatsApp/e-mail, segmento, categorias ou marcas.</div>';
  }

  W.abrirCotacaoFornecedoresOS = function (osId, itemKey) {
    ensureModal();
    const os = (J().os || []).find(o => String(o.id) === String(osId));
    if (!os) { W.toast?.('Salve ou reabra a O.S. antes de enviar cotacao.', 'warn'); return; }
    const item = getItem(os, itemKey);
    state.osId = osId;
    state.itemKey = itemKey;
    state.os = os;
    state.item = item;
    state.fornecedores = fornecedoresOrdenados(item);
    state.mensagens = [];
    $('cotRfqOsId').value = osId || '';
    $('cotRfqItemKey').value = itemKey || '';
    $('cotRfqExpira').value = localDateAdd(3);
    $('cotRfqBusca').value = '';
    $('cotRfqObs').value = 'Favor informar valor unitario, marca, disponibilidade, prazo, frete e condicao de pagamento.';
    $('cotRfqMensagens').innerHTML = '';
    $('cotRfqAvisoBase').textContent = publicBaseOk()
      ? 'Link publico pronto para envio.'
      : 'Atenção: preencha baseUrl/cotacaoFornecedor em js/links-publicos.js antes de enviar para fornecedor externo.';
    renderResumo();
    renderFornecedores();
    if (typeof W.abrirModal === 'function') W.abrirModal('modalCotacaoFornecedores');
    else $('modalCotacaoFornecedores').style.display = 'flex';
  };

  W.fecharCotacaoFornecedoresOS = function () {
    if (typeof W.fecharModal === 'function') W.fecharModal('modalCotacaoFornecedores');
    else if ($('modalCotacaoFornecedores')) $('modalCotacaoFornecedores').style.display = 'none';
  };

  W.filtrarFornecedoresCotacao = renderFornecedores;

  W.selecionarFornecedoresCotacao = function (modo) {
    D.querySelectorAll('#cotRfqFornecedores .cot-forn-card').forEach(card => {
      const cb = card.querySelector('.cot-forn-check');
      if (!cb) return;
      let checked = cb.checked;
      if (modo === 'limpar') checked = false;
      else if (modo === 'todos') checked = true;
      else if (modo === 'sugeridos') checked = card.classList.contains('is-suggested');
      cb.checked = checked;
      card.classList.toggle('is-selected', checked);
    });
  };

  function selecionados() {
    const ids = Array.from(D.querySelectorAll('#cotRfqFornecedores .cot-forn-check:checked')).map(cb => cb.value);
    return state.fornecedores.filter(f => ids.includes(String(f.id)));
  }

  function montarMensagem(f, link) {
    const os = state.os || {};
    const item = state.item || {};
    const v = veiculoOS(os);
    const prioridade = $('cotRfqPrioridade')?.value || 'normal';
    const obs = $('cotRfqObs')?.value?.trim() || '';
    const lines = [
      'Olá, ' + (f.nome || f.razao || 'fornecedor') + '.',
      '',
      'Solicito cotação para peça aprovada em O.S.:',
      'Peça: ' + (item.codigo ? '[' + item.codigo + '] ' : '') + (item.desc || item.descricao || '-'),
      'Qtd: ' + (item.qtd || 1),
      'Veículo: ' + [v.prefixo ? 'prefixo ' + v.prefixo : '', v.placa ? 'placa ' + v.placa : '', v.nome].filter(Boolean).join(' / '),
      osRefLabel(os),
      'Prioridade: ' + prioridade,
      '',
      obs,
      '',
      'Responda pelo link:',
      link,
      '',
      'Informe valor unitário, marca, disponibilidade, prazo, frete e condição.'
    ];
    return lines.filter(line => line !== null && line !== undefined).join('\n');
  }

  async function salvarSolicitacao(lista) {
    const database = db();
    const os = state.os || {};
    const item = state.item || {};
    if (!database || !J().tid || !os.id) throw new Error('Banco/tenant/O.S. indisponivel.');

    const cotRef = database.collection('cotacoes_pecas').doc();
    const cotacaoId = cotRef.id;
    const expiraEm = $('cotRfqExpira')?.value || localDateAdd(3);
    const expiraDate = new Date(expiraEm + 'T23:59:59');
    const v = veiculoOS(os);
    const criadoEm = nowISO();
    const fornecedores = lista.map(f => {
      const contato = fornecedorContato(f);
      const token = randomToken();
      const link = publicUrl(token);
      return {
        id: f.id || '',
        nome: f.nome || f.razao || f.nomeFantasia || 'Fornecedor',
        wpp: contato.wpp || '',
        email: contato.email || '',
        token,
        link,
        status: 'pendente'
      };
    });

    const cotPayload = {
      tenantId: J().tid,
      osId: os.id,
      itemKey: state.itemKey,
      status: 'enviada',
      origem: 'os_aprovada',
      prioridade: $('cotRfqPrioridade')?.value || 'normal',
      observacao: $('cotRfqObs')?.value?.trim() || '',
      expiraEm,
      expiraEmTs: expiraDate,
      item: {
        key: item.key || state.itemKey,
        codigo: item.codigo || '',
        desc: item.desc || item.descricao || '',
        qtd: num(item.qtd || 1),
        tipo: item.tipo || 'peca',
        valorAprovado: num(item.valorFinal || item.valorUnit || 0)
      },
      veiculo: v,
      fornecedores,
      createdAt: criadoEm,
      createdBy: J().nome || 'Jarvis'
    };

    const batch = database.batch();
    batch.set(cotRef, cotPayload);
    fornecedores.forEach(f => {
      const pubRef = database.collection('cotacoes_publicas').doc(f.token);
      batch.set(pubRef, {
        tenantId: J().tid,
        cotacaoId,
        osId: os.id,
        itemKey: state.itemKey,
        token: f.token,
        fornecedorId: f.id || '',
        fornecedorNome: f.nome,
        oficinaNome: J().oficina?.nome || J().oficina?.razao || J().nomeOficina || 'Oficina',
        status: 'aberta',
        prioridade: cotPayload.prioridade,
        observacao: cotPayload.observacao,
        expiraEm,
        expiraEmTs: expiraDate,
        item: cotPayload.item,
        veiculo: { placa: v.placa, prefixo: v.prefixo, nome: v.nome, tipo: v.tipo },
        createdAt: criadoEm
      });
    });

    const map = Object.assign({}, cotMap(os));
    const coletadas = W.coletarCotacoesPecasOS ? (W.coletarCotacoesPecasOS() || {}) : {};
    const anterior = map[state.itemKey] || {};
    const coletadaAtual = coletadas[state.itemKey] || {};
    const opcoesAtuais = Array.isArray(coletadaAtual.opcoes) && coletadaAtual.opcoes.length
      ? coletadaAtual.opcoes
      : (Array.isArray(anterior.opcoes) ? anterior.opcoes : []);
    const atual = Object.assign({ key: state.itemKey, item, opcoes: [] }, anterior, coletadaAtual, { opcoes: opcoesAtuais });
    atual.item = atual.item || cotPayload.item;
    atual.solicitacoes = Array.isArray(atual.solicitacoes) ? atual.solicitacoes.slice() : [];
    atual.solicitacoes.push({
      id: cotacaoId,
      status: 'enviada',
      createdAt: criadoEm,
      expiraEm,
      fornecedores
    });
    atual.updatedAt = criadoEm;
    map[state.itemKey] = atual;

    const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
    timeline.push({
      dt: criadoEm,
      user: J().nome || 'Jarvis',
      acao: 'Enviou cotacao de peca aprovada para ' + fornecedores.length + ' fornecedor(es).',
      tipo: 'cotacao_pecas_envio',
      interno: true,
      cotacaoId
    });
    batch.update(database.collection('ordens_servico').doc(os.id), {
      cotacoesPecas: map,
      timeline,
      updatedAt: criadoEm
    });

    await batch.commit();
    Object.assign(os, { cotacoesPecas: map, timeline, updatedAt: criadoEm });
    try {
      await database.collection('notificacoes_live').add({
        tenantId: J().tid,
        tipo: 'cotacao_enviada',
        titulo: 'Cotacao enviada',
        mensagem: 'Cotacao de ' + (item.desc || item.descricao || 'peca') + ' enviada para fornecedores.',
        perfilDestino: 'jarvis',
        entidade: 'ordens_servico',
        entidadeId: os.id,
        prioridade: cotPayload.prioridade,
        lida: false,
        createdAt: criadoEm
      });
    } catch (_) {}
    if (typeof W.thiaAudit === 'function') {
      W.thiaAudit('cotacao_pecas_enviada', 'ordens_servico', os.id, null, cotPayload, 'Envio de cotacao para fornecedores').catch(() => {});
    }
    return { cotacaoId, fornecedores };
  }

  function renderMensagens(payload) {
    const box = $('cotRfqMensagens');
    if (!box) return;
    state.mensagens = payload.fornecedores.map(f => ({
      fornecedor: f,
      mensagem: montarMensagem(f, f.link)
    }));
    box.innerHTML = `
      <div style="font-family:var(--fm);font-size:.66rem;color:var(--success);font-weight:800;letter-spacing:1px;margin:4px 0 8px;">MENSAGENS PRONTAS - CONFIRME O ENVIO</div>
      ${state.mensagens.map((m, idx) => {
        const c = fornecedorContato(m.fornecedor);
        return `<div class="cot-msg-card">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <strong style="color:var(--text);">${esc(m.fornecedor.nome || 'Fornecedor')}</strong>
            <small style="font-family:var(--fm);color:var(--muted);">${c.wpp ? 'WPP ' + esc(c.wpp) : ''}${c.email ? ' | ' + esc(c.email) : ''}</small>
          </div>
          <textarea class="j-textarea cot-msg-text" rows="7">${esc(m.mensagem)}</textarea>
          <div class="cot-msg-actions">
            <button type="button" class="btn-success" onclick="window.abrirCanalCotacao(${idx},'whatsapp')">WhatsApp</button>
            <button type="button" class="btn-outline" onclick="window.abrirCanalCotacao(${idx},'email')">E-mail</button>
            <button type="button" class="btn-primary" onclick="window.abrirCanalCotacao(${idx},'share')">Compartilhar</button>
            <button type="button" class="btn-ghost" onclick="window.copiarMensagemCotacao(${idx})">Copiar</button>
          </div>
        </div>`;
      }).join('')}`;
  }

  W.gerarEnvioCotacaoOS = async function () {
    const lista = selecionados();
    if (!lista.length) { W.toast?.('Selecione pelo menos um fornecedor.', 'warn'); return; }
    try {
      const payload = await salvarSolicitacao(lista);
      renderMensagens(payload);
      W.toast?.('Cotacao criada. Agora confirme o envio das mensagens.', 'ok');
    } catch (err) {
      console.error(err);
      W.toast?.('Nao foi possivel criar cotacao: ' + (err.message || err), 'err');
    }
  };

  W.copiarMensagemCotacao = async function (idx) {
    const ta = D.querySelectorAll('#cotRfqMensagens .cot-msg-text')[idx];
    const txt = ta ? ta.value : state.mensagens[idx]?.mensagem || '';
    try {
      await navigator.clipboard.writeText(txt);
      W.toast?.('Mensagem copiada.', 'ok');
    } catch (_) {
      if (ta) { ta.focus(); ta.select(); D.execCommand('copy'); W.toast?.('Mensagem copiada.', 'ok'); }
    }
  };

  W.abrirCanalCotacao = async function (idx, canal) {
    const ta = D.querySelectorAll('#cotRfqMensagens .cot-msg-text')[idx];
    const msg = ta ? ta.value : state.mensagens[idx]?.mensagem || '';
    const f = state.mensagens[idx]?.fornecedor || {};
    const c = fornecedorContato(f);
    if (canal === 'whatsapp') {
      const phone = phoneBR(c.wpp);
      if (!phone) { W.toast?.('Fornecedor sem WhatsApp cadastrado.', 'warn'); return; }
      W.open('https://wa.me/' + encodeURIComponent(phone) + '?text=' + encodeURIComponent(msg), '_blank');
      return;
    }
    if (canal === 'email') {
      if (!c.email) { W.toast?.('Fornecedor sem e-mail cadastrado.', 'warn'); return; }
      W.location.href = 'mailto:' + encodeURIComponent(c.email) + '?subject=' + encodeURIComponent('Cotacao de peca - ' + osRefLabel(state.os)) + '&body=' + encodeURIComponent(msg);
      return;
    }
    if (canal === 'share' && navigator.share) {
      try { await navigator.share({ title: 'Cotacao de peca', text: msg }); return; } catch (_) {}
    }
    W.copiarMensagemCotacao(idx);
  };

  async function incorporarResposta(respId, resp) {
    const database = db();
    if (!database || !resp || !resp.osId || !resp.itemKey || !J().tid) return;
    const keyProcesso = respId + ':' + resp.osId + ':' + resp.itemKey;
    W._cotRespSyncing = W._cotRespSyncing || new Set();
    if (W._cotRespSyncing.has(keyProcesso)) return;
    W._cotRespSyncing.add(keyProcesso);
    try {
      const ref = database.collection('ordens_servico').doc(resp.osId);
      const snap = await ref.get();
      if (!snap.exists) return;
      const os = { id: snap.id, ...snap.data() };
      const map = cotMap(os);
      const atual = Object.assign({ key: resp.itemKey, item: resp.item || {}, opcoes: [] }, map[resp.itemKey] || {});
      atual.opcoes = Array.isArray(atual.opcoes) ? atual.opcoes.slice() : [];
      if (atual.opcoes.some(o => o.respostaId === respId || o.id === 'resp-' + respId)) return;
      const qtd = num(atual.item?.qtd || resp.item?.qtd || 1) || 1;
      const valorUnitario = num(resp.valorUnitario);
      const frete = num(resp.frete);
      atual.opcoes.push({
        id: 'resp-' + respId,
        respostaId: respId,
        cotacaoId: resp.cotacaoId || '',
        fornecedorId: resp.fornecedorId || '',
        fornecedor: resp.fornecedorNome || resp.responsavel || 'Fornecedor',
        valorUnitario,
        frete,
        valorTotal: +(valorUnitario * qtd + frete).toFixed(2),
        marca: resp.marca || '',
        prazo: resp.prazo || resp.prazoDias || '',
        condicao: [
          resp.condicao || '',
          resp.disponibilidade ? 'Disponibilidade: ' + resp.disponibilidade : '',
          resp.marca ? 'Marca: ' + resp.marca : '',
          frete ? 'Frete: ' + moeda(frete) : '',
          resp.observacao || ''
        ].filter(Boolean).join(' | '),
        selecionado: false,
        comprado: false,
        origem: 'cotacao_publica',
        recebidoEm: resp.createdAt || nowISO(),
        updatedAt: nowISO()
      });
      atual.updatedAt = nowISO();
      map[resp.itemKey] = atual;
      const timeline = Array.isArray(os.timeline) ? os.timeline.slice() : [];
      timeline.push({
        dt: nowISO(),
        user: resp.fornecedorNome || 'Fornecedor',
        acao: 'Recebeu resposta de cotacao para peca aprovada.',
        tipo: 'cotacao_pecas_resposta',
        interno: true,
        respostaId: respId
      });
      await ref.update({ cotacoesPecas: map, timeline, updatedAt: nowISO() });
      try { await database.collection('cotacoes_respostas').doc(respId).update({ sincronizadaEm: nowISO() }); } catch (_) {}
      const local = (J().os || []).find(o => o.id === resp.osId);
      if (local) Object.assign(local, { cotacoesPecas: map, timeline, updatedAt: nowISO() });
      try {
        await database.collection('notificacoes_live').add({
          tenantId: J().tid,
          tipo: 'cotacao_recebida',
          titulo: 'Cotacao recebida',
          mensagem: 'Fornecedor respondeu cotacao de ' + (resp.item?.desc || 'peca') + '.',
          perfilDestino: 'jarvis',
          entidade: 'ordens_servico',
          entidadeId: resp.osId,
          prioridade: 'normal',
          lida: false,
          createdAt: nowISO()
        });
      } catch (_) {}
      if ($('osId')?.value === resp.osId && typeof W.aplicarMarcadoresAprovacaoOS === 'function') {
        W.aplicarMarcadoresAprovacaoOS(local || os);
      }
      W.toast?.('Resposta de cotacao recebida e anexada na O.S.', 'ok');
    } catch (err) {
      console.warn('Falha ao sincronizar resposta de cotacao', err);
    } finally {
      W._cotRespSyncing.delete(keyProcesso);
    }
  }

  function instalarListenerRespostas() {
    if (W._cotRespListener || !db() || !J().tid) return;
    try {
      W._cotRespListener = db().collection('cotacoes_respostas')
        .where('tenantId', '==', J().tid)
        .onSnapshot(snap => {
          snap.docChanges().forEach(ch => {
            if (ch.type !== 'added' && ch.type !== 'modified') return;
            const data = ch.doc.data() || {};
            if (data.sincronizadaEm) return;
            incorporarResposta(ch.doc.id, { id: ch.doc.id, ...data });
          });
        });
    } catch (err) {
      console.warn('Listener de cotacoes indisponivel', err);
    }
  }

  function patchRenderCotacoes() {
    if (W._cotacoesRenderPatched || typeof W.renderCotacaoPecasAprovadasOS !== 'function') return;
    const original = W.renderCotacaoPecasAprovadasOS;
    W.renderCotacaoPecasAprovadasOS = function (os, aprovados, moedaFn) {
      let html = original.call(this, os, aprovados, moedaFn);
      if (!html || typeof html !== 'string') return html;
      html = html.replace(/(<button type="button" class="btn-success" onclick="window\.abrirEntradaNFCotacaoOS\('([^']*)','([^']*)'\)">DAR ENTRADA NF \/ VINCULAR<\/button>)/g,
        `<button type="button" class="btn-outline" onclick="window.abrirCotacaoFornecedoresOS('$2','$3')">ENVIAR COTACAO A FORNECEDORES</button>$1`);
      return html;
    };
    W._cotacoesRenderPatched = true;
  }

  D.addEventListener('DOMContentLoaded', function () {
    patchRenderCotacoes();
    setTimeout(patchRenderCotacoes, 300);
    const timer = setInterval(function () {
      patchRenderCotacoes();
      instalarListenerRespostas();
      if (W._cotRespListener && W._cotacoesRenderPatched) clearInterval(timer);
    }, 1200);
  });

  W.thiaCotacoes = Object.assign(W.thiaCotacoes || {}, {
    abrir: W.abrirCotacaoFornecedoresOS,
    sincronizarResposta: incorporarResposta
  });
})();
