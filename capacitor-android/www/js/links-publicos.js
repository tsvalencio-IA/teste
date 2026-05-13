/*
 * Configuracao central dos links publicos do SaaS.
 * Preencha os valores abaixo depois que o novo GitHub Pages/Vercel estiver definido.
 */
(function () {
  'use strict';

  const PLACEHOLDER_BASE = '';

  window.THIA_PUBLIC_LINKS = Object.assign({
    baseUrl: PLACEHOLDER_BASE,
    cliente: '',
    clienteOficial: '',
    cotacaoFornecedor: '',
    qrCliente: '',
    apkShareBase: ''
  }, window.THIA_PUBLIC_LINKS || {});

  function cleanBase(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  function joinUrl(base, path) {
    base = cleanBase(base);
    path = String(path || '').replace(/^\/+/, '');
    if (!base) return path || '';
    return path ? `${base}/${path}` : base;
  }

  window.thiaGetPublicUrl = function (kind, params) {
    const cfg = window.THIA_PUBLIC_LINKS || {};
    const base = cleanBase(cfg.baseUrl);
    let url = '';

    if (kind === 'cotacaoFornecedor') url = cfg.cotacaoFornecedor || joinUrl(base, 'cotacao.html');
    else if (kind === 'clienteOficial') url = cfg.clienteOficial || joinUrl(base, 'clienteOficial.html');
    else if (kind === 'qrCliente') url = cfg.qrCliente || cfg.cliente || joinUrl(base, 'cliente.html');
    else url = cfg.cliente || joinUrl(base, 'cliente.html');

    if (!url) {
      const page = kind === 'cotacaoFornecedor' ? 'cotacao.html' : (kind === 'clienteOficial' ? 'clienteOficial.html' : 'cliente.html');
      url = page;
    }

    const qp = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') qp.set(key, String(value));
    });
    const qs = qp.toString();
    return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
  };
})();
