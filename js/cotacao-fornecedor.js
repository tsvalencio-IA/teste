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

    const item = data.item || {};
    const veic = data.veiculo || {};
    $('oficinaNome').textContent = data.oficinaNome || 'Oficina';
    $('pecaTitulo').innerHTML = (item.codigo ? '[' + esc(item.codigo) + '] ' : '') + esc(item.desc || 'Peca solicitada');
    $('pecaObs').textContent = data.observacao || 'Preencha a cotacao com os dados reais disponiveis.';
    $('pecaQtd').textContent = String(item.qtd || 1);
    $('veiculoInfo').textContent = [veic.prefixo ? 'Prefixo ' + veic.prefixo : '', veic.placa ? 'Placa ' + veic.placa : '', veic.nome || 'Veiculo'].filter(Boolean).join(' / ');
    $('prioridadeInfo').textContent = data.prioridade || 'normal';
    $('validadeInfo').textContent = fmtDate(data.expiraEm);
    $('respNome').value = data.fornecedorNome || '';

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
    const valorUnitario = num($('valorUnitario').value);
    if (valorUnitario <= 0) { status('Informe o valor unitario da peca.', 'err'); return; }
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
      itemKey: cotacao.itemKey || '',
      fornecedorId: cotacao.fornecedorId || '',
      fornecedorNome: cotacao.fornecedorNome || $('respNome').value.trim() || 'Fornecedor',
      responsavel: $('respNome').value.trim(),
      contato: $('respContato').value.trim(),
      item: cotacao.item || {},
      valorUnitario,
      marca: $('marca').value.trim(),
      disponibilidade: $('disponibilidade').value,
      prazo: $('prazo').value.trim(),
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
