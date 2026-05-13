(function () {
  'use strict';

  const W = window;
  const D = document;
  const params = new URLSearchParams(W.location.search);
  const token = (params.get('token') || '').trim();
  const tenant = (params.get('tenant') || params.get('t') || '').trim();
  let db = null;
  let cotacao = null;

  function $(id) { return D.getElementById(id); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function num(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    const s = String(v == null ? '' : v).replace(/\s/g, '').replace(/R\$/gi, '');
    if (!s) return 0;
    return parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0;
  }
  function status(msg, type) {
    const box = $('statusMsg');
    if (!box) return;
    box.className = 'status ' + (type || 'warn');
    box.textContent = msg;
  }
  function fmtDate(d) {
    if (!d) return '-';
    const s = String(d).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [a, m, dia] = s.split('-');
      return dia + '/' + m + '/' + a;
    }
    return s;
  }
  function isExpired(data) {
    if (!data) return true;
    if (String(data.status || '').toLowerCase() === 'fechada') return true;
    const exp = data.expiraEm || '';
    if (exp && exp < new Date().toISOString().slice(0, 10)) return true;
    return false;
  }
  function itensCotacao(data) {
    const itens = Array.isArray(data?.itens) && data.itens.length ? data.itens : [data?.item || {}];
    return itens.map((item, idx) => Object.assign({ key: item.key || data?.itemKeys?.[idx] || data?.itemKey || ('item-' + idx) }, item));
  }
  function tituloItem(item) {
    return (item.codigo ? '[' + item.codigo + '] ' : '') + (item.desc || item.descricao || 'Peca solicitada');
  }

  async function prepararTenant() {
    if (!tenant) {
      if (sessionStorage) sessionStorage.removeItem('j_firebase_config');
      db = W.initFirebase();
      return;
    }
    try {
      const central = W.initCentralFirebase ? W.initCentralFirebase() : W.initFirebase();
      const snap = await central.collection('oficinas').doc(tenant).get();
      if (snap.exists) {
        const d = snap.data() || {};
        if (d.firebaseConfig) {
          sessionStorage.setItem('j_firebase_config', JSON.stringify(d.firebaseConfig));
          db = W.initFirebase();
        } else {
          db = W.initFirebase();
        }
        if (d.brand && W.aplicarBrand) W.aplicarBrand(d.brand);
      } else {
        db = W.initFirebase();
      }
    } catch (err) {
      console.warn('Tenant da cotacao indisponivel', err);
      db = W.initFirebase();
    }
  }

  function renderCotacao(data) {
    cotacao = data;
    $('loadingCard').classList.add('hide');
    $('cotacaoCard').classList.remove('hide');
    $('formCard').classList.remove('hide');

    const itens = itensCotacao(data);
    const item = itens[0] || {};
    const veic = data.veiculo || {};
    $('oficinaNome').textContent = data.oficinaNome || 'Oficina';
    $('pecaTitulo').innerHTML = itens.length > 1 ? esc(itens.length + ' pecas solicitadas') : esc(tituloItem(item));
    $('pecaObs').textContent = data.observacao || 'Preencha a cotacao com os dados reais disponiveis.';
    $('pecaQtd').textContent = itens.length > 1 ? String(itens.length) + ' itens' : String(item.qtd || 1);
    $('veiculoInfo').textContent = [veic.prefixo ? 'Prefixo ' + veic.prefixo : '', veic.placa ? 'Placa ' + veic.placa : '', veic.nome || 'Veiculo'].filter(Boolean).join(' / ');
    $('prioridadeInfo').textContent = data.prioridade || 'normal';
    $('validadeInfo').textContent = fmtDate(data.expiraEm);
    $('respNome').value = data.fornecedorNome || '';
    const itensBox = $('itensCotacao');
    if (itensBox) {
      itensBox.innerHTML = itens.map((it, idx) => `
        <div class="cot-item-resposta" data-item-key="${esc(it.key || '')}">
          <div class="cot-item-head">
            <strong>${esc(tituloItem(it))}</strong>
            <small>Qtd ${esc(it.qtd || 1)}</small>
          </div>
          <div class="grid">
            <div><label>Valor unitario</label><input class="item-valor" inputmode="decimal" placeholder="0,00" ${idx === 0 ? 'autofocus' : ''}></div>
            <div><label>Marca</label><input class="item-marca" placeholder="Marca ofertada"></div>
            <div><label>Disponibilidade</label><select class="item-disponibilidade"><option>Disponivel imediato</option><option>Disponivel hoje</option><option>Encomenda</option><option>Indisponivel</option></select></div>
          </div>
          <div class="grid" style="margin-top:10px;">
            <div><label>Prazo</label><input class="item-prazo" placeholder="Ex: 2h, hoje, 1 dia"></div>
            <div><label>Observacao do item</label><input class="item-observacao" placeholder="Garantia, alternativo, original..."></div>
          </div>
        </div>`).join('');
      const legacy = D.querySelector('.legacy-single-fields');
      if (legacy) legacy.classList.add('hide');
    }

    if (isExpired(data)) {
      status('Esta cotacao esta vencida ou fechada. Fale com a oficina antes de enviar.', 'warn');
      $('btnEnviar').disabled = true;
    }
  }

  async function carregar() {
    if (!token) {
      $('loadingCard').innerHTML = '<strong>Link incompleto.</strong><p class="sub">O token da cotacao nao foi informado.</p>';
      return;
    }
    await prepararTenant();
    try {
      const snap = await db.collection('cotacoes_publicas').doc(token).get();
      if (!snap.exists) {
        $('loadingCard').innerHTML = '<strong>Cotacao nao encontrada.</strong><p class="sub">Confirme se o link enviado pela oficina esta correto.</p>';
        return;
      }
      renderCotacao({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error(err);
      $('loadingCard').innerHTML = '<strong>Erro ao carregar.</strong><p class="sub">Nao foi possivel abrir a cotacao agora. Tente novamente.</p>';
    }
  }

  W.enviarRespostaCotacaoFornecedor = async function () {
    if (!db || !cotacao || !token) return;
    const itensBase = itensCotacao(cotacao);
    const linhas = Array.from(D.querySelectorAll('.cot-item-resposta'));
    const itensResposta = linhas.length ? linhas.map((row, idx) => {
      const item = itensBase[idx] || {};
      return {
        itemKey: row.getAttribute('data-item-key') || item.key || '',
        item,
        valorUnitario: num(row.querySelector('.item-valor')?.value),
        marca: row.querySelector('.item-marca')?.value.trim() || '',
        disponibilidade: row.querySelector('.item-disponibilidade')?.value || '',
        prazo: row.querySelector('.item-prazo')?.value.trim() || '',
        observacao: row.querySelector('.item-observacao')?.value.trim() || ''
      };
    }).filter(x => x.valorUnitario > 0) : [];
    if (!itensResposta.length) { status('Informe o valor unitario de pelo menos uma peca.', 'err'); return; }
    const primeira = itensResposta[0];
    const valorUnitario = primeira.valorUnitario;
    if (isExpired(cotacao)) { status('Cotacao vencida ou fechada. Fale com a oficina.', 'err'); return; }

    const btn = $('btnEnviar');
    btn.disabled = true;
    btn.textContent = 'ENVIANDO...';
    const respRef = db.collection('cotacoes_publicas').doc(token).collection('respostas').doc();
    const flatRef = db.collection('cotacoes_respostas').doc(respRef.id);
    const payload = {
      token,
      tenantId: cotacao.tenantId || tenant || '',
      cotacaoId: cotacao.cotacaoId || '',
      osId: cotacao.osId || '',
      itemKey: cotacao.itemKey || primeira.itemKey || '',
      itemKeys: cotacao.itemKeys || itensResposta.map(i => i.itemKey).filter(Boolean),
      fornecedorId: cotacao.fornecedorId || '',
      fornecedorNome: cotacao.fornecedorNome || $('respNome').value.trim() || 'Fornecedor',
      responsavel: $('respNome').value.trim(),
      contato: $('respContato').value.trim(),
      item: cotacao.item || primeira.item || {},
      itens: cotacao.itens || itensBase,
      itensResposta,
      valorUnitario,
      marca: primeira.marca || '',
      disponibilidade: primeira.disponibilidade || '',
      prazo: primeira.prazo || '',
      frete: num($('frete').value),
      condicao: $('condicao').value.trim(),
      observacao: $('observacao').value.trim(),
      origem: 'portal_fornecedor',
      createdAt: new Date().toISOString()
    };
    try {
      const batch = db.batch();
      batch.set(respRef, payload);
      batch.set(flatRef, payload);
      await batch.commit();
      status('Cotacao enviada. A oficina recebera sua resposta no painel.', 'ok');
      D.querySelectorAll('input,select,textarea,button').forEach(el => {
        if (el.id !== 'btnEnviar') el.disabled = true;
      });
      btn.textContent = 'COTACAO ENVIADA';
    } catch (err) {
      console.error(err);
      status('Nao foi possivel enviar. Verifique a internet ou fale com a oficina.', 'err');
      btn.disabled = false;
      btn.textContent = 'ENVIAR COTACAO';
    }
  };

  D.addEventListener('DOMContentLoaded', carregar);
})();
