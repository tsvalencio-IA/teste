(function () {
  'use strict';

  if (window.__thiaUixThemeFixInstalled) return;
  window.__thiaUixThemeFixInstalled = true;

  const css = `
    :root[data-theme="light"]{
      --uix-bg:#f4f7fb;
      --uix-surface:#ffffff;
      --uix-surface-2:#f8fafc;
      --uix-surface-3:#eef2f7;
      --uix-field:#ffffff;
      --uix-field-2:#f8fafc;
      --uix-text:#0f172a;
      --uix-text-2:#334155;
      --uix-muted:#475569;
      --uix-border:rgba(15,23,42,.16);
      --uix-border-2:rgba(15,23,42,.24);
      --uix-cyan:#0369a1;
      --uix-success:#047857;
      --uix-warn:#a16207;
      --uix-danger:#be123c;
      --uix-select-option:#ffffff;
    }
    :root[data-theme="dark"]{
      --uix-bg:var(--bg,#060a14);
      --uix-surface:var(--surf,#0c1426);
      --uix-surface-2:var(--surf2,#111d35);
      --uix-surface-3:var(--surf3,#162040);
      --uix-field:var(--surf2,#111d35);
      --uix-field-2:var(--surf3,#162040);
      --uix-text:var(--text,#e8f4ff);
      --uix-text-2:var(--muted2,#9ab8d6);
      --uix-muted:var(--muted,#7a9ab8);
      --uix-border:var(--border,rgba(255,255,255,.10));
      --uix-border-2:var(--border2,rgba(0,212,255,.22));
      --uix-cyan:var(--cyan,#00d4ff);
      --uix-success:var(--success,#00ff88);
      --uix-warn:var(--warn,#ffb800);
      --uix-danger:var(--danger,#ff3b3b);
      --uix-select-option:var(--surf2,#111d35);
    }

    :root[data-theme="light"] body,
    :root[data-theme="light"] .main,
    :root[data-theme="light"] .section,
    :root[data-theme="light"] .modal,
    :root[data-theme="light"] .modal-head,
    :root[data-theme="light"] .modal-foot,
    :root[data-theme="light"] .j-card,
    :root[data-theme="light"] .k-col,
    :root[data-theme="light"] .chat-main,
    :root[data-theme="light"] .ia-box{
      color:var(--uix-text)!important;
    }

    :root[data-theme="light"] .modal,
    :root[data-theme="light"] .modal-head,
    :root[data-theme="light"] .modal-foot,
    :root[data-theme="light"] .j-card,
    :root[data-theme="light"] .ia-box,
    :root[data-theme="light"] .chat-main{
      background:var(--uix-surface)!important;
      border-color:var(--uix-border)!important;
      box-shadow:0 18px 42px rgba(15,23,42,.18)!important;
    }

    .j-input,.j-select,.j-textarea,
    input.input,select.select,textarea.textarea,
    input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]),
    select,textarea{
      color:var(--uix-text)!important;
      background:var(--uix-field)!important;
      border-color:var(--uix-border)!important;
      caret-color:var(--uix-cyan)!important;
    }
    .j-input:focus,.j-select:focus,.j-textarea:focus,
    input:focus,select:focus,textarea:focus{
      color:var(--uix-text)!important;
      background:var(--uix-field)!important;
      border-color:var(--uix-cyan)!important;
      box-shadow:0 0 0 2px color-mix(in srgb, var(--uix-cyan) 18%, transparent)!important;
    }
    .j-input::placeholder,.j-textarea::placeholder,
    input::placeholder,textarea::placeholder{
      color:var(--uix-muted)!important;
      opacity:1!important;
    }
    .j-select option,select option{
      color:var(--uix-text)!important;
      background:var(--uix-select-option)!important;
    }
    input[readonly],textarea[readonly]{
      background:var(--uix-field-2)!important;
      color:var(--uix-text-2)!important;
    }

    :root[data-theme="light"] .tempa-inline-box,
    :root[data-theme="light"] .serv-tempa-resultados-list,
    :root[data-theme="light"] .cilia-serv-relac,
    :root[data-theme="light"] .cilia-peca-wrap,
    :root[data-theme="light"] .cot-msg-card,
    :root[data-theme="light"] .cot-forn-card,
    :root[data-theme="light"] .cotacao-peca-box{
      background:var(--uix-surface-2)!important;
      border-color:var(--uix-border)!important;
      color:var(--uix-text)!important;
    }
    :root[data-theme="light"] .tempa-inline-option,
    :root[data-theme="light"] .cilia-tempa-opcao,
    :root[data-theme="light"] .serv-tempa-resultados-list button,
    :root[data-theme="light"] .cot-opcao-row{
      background:var(--uix-surface)!important;
      color:var(--uix-text)!important;
      border-color:var(--uix-border)!important;
    }
    :root[data-theme="light"] .tempa-inline-option:hover,
    :root[data-theme="light"] .cilia-tempa-opcao:hover{
      background:#e0f2fe!important;
      border-color:var(--uix-cyan)!important;
    }
    :root[data-theme="light"] .tempa-inline-none,
    :root[data-theme="light"] .cilia-tempa-empty,
    :root[data-theme="light"] .cilia-tempa-sem-match{
      background:#fff7ed!important;
      border-color:#fed7aa!important;
      color:var(--uix-warn)!important;
    }
    :root[data-theme="light"] .serv-tempa-meta,
    :root[data-theme="light"] .j-label,
    :root[data-theme="light"] small,
    :root[data-theme="light"] .k-desc,
    :root[data-theme="light"] .k-cliente,
    :root[data-theme="light"] .mtab{
      color:var(--uix-muted)!important;
    }
    :root[data-theme="light"] b,
    :root[data-theme="light"] strong,
    :root[data-theme="light"] .modal-title,
    :root[data-theme="light"] .page-title,
    :root[data-theme="light"] .k-placa{
      color:var(--uix-text)!important;
    }
    :root[data-theme="light"] [style*="color:var(--text)"]{color:var(--uix-text)!important;}
    :root[data-theme="light"] [style*="color:var(--muted)"]{color:var(--uix-muted)!important;}
    :root[data-theme="light"] [style*="color:var(--cyan)"]{color:var(--uix-cyan)!important;}
    :root[data-theme="light"] [style*="color:var(--success)"]{color:var(--uix-success)!important;}
    :root[data-theme="light"] [style*="color:var(--warn)"]{color:var(--uix-warn)!important;}
    :root[data-theme="light"] [style*="color:var(--danger)"]{color:var(--uix-danger)!important;}
    :root[data-theme="light"] [style*="background:rgba(0,0,0"],
    :root[data-theme="light"] [style*="background: rgba(0,0,0"],
    :root[data-theme="light"] [style*="background:rgba(5,14,34"],
    :root[data-theme="light"] [style*="background:rgba(0,212,255"]{
      background:var(--uix-surface-2)!important;
    }

    @media(max-width:760px){
      .modal-body{overscroll-behavior:contain;}
      .j-input,.j-select,.j-textarea,input,select,textarea{font-size:16px!important;}
    }
  `;

  const style = document.createElement('style');
  style.id = 'thia-uix-theme-fix';
  style.textContent = css;
  document.head.appendChild(style);
})();
