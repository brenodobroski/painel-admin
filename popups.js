// ============================================================
// POPUPS CLIMARIO — toasts + confirmação modal + override de alert
// Admin Climario
// ============================================================
(function () {
    // ---------- CSS ----------
    const css = document.createElement('style');
    css.textContent = `
        .clim-toast-wrap {
            position: fixed; top: 16px; right: 16px; z-index: 99990;
            display: flex; flex-direction: column; gap: 10px;
            width: min(380px, calc(100vw - 32px));
            pointer-events: none;
        }
        .clim-toast {
            pointer-events: all;
            display: flex; align-items: flex-start; gap: 10px;
            background: #0f172a; color: #e2e8f0;
            padding: 12px 14px; border-radius: 10px;
            box-shadow: 0 12px 32px rgba(0,0,0,.35);
            font-size: 13px; line-height: 1.45; font-family: inherit;
            border-left: 3px solid #3b82f6;
            animation: climToastIn .28s cubic-bezier(.21,1.02,.73,1);
        }
        .clim-toast.clim-sucesso { border-left-color: #22c55e; }
        .clim-toast.clim-erro    { border-left-color: #ef4444; }
        .clim-toast.clim-aviso   { border-left-color: #f59e0b; }
        .clim-toast.clim-info    { border-left-color: #3b82f6; }
        .clim-toast.clim-saindo  { animation: climToastOut .25s ease forwards; }
        .clim-toast-icone { flex-shrink: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
        .clim-toast-msg { flex: 1; white-space: pre-line; }
        .clim-toast-fechar {
            flex-shrink: 0; background: none; border: none; color: #64748b;
            font-size: 16px; line-height: 1; cursor: pointer; padding: 2px;
        }
        .clim-toast-fechar:hover { color: #e2e8f0; }
        @keyframes climToastIn  { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes climToastOut { to { opacity: 0; transform: translateX(30px); } }

        /* ---------- Modal de confirmação ---------- */
        .clim-confirm-overlay {
            position: fixed; inset: 0; z-index: 99995;
            background: rgba(10,22,40,.55); backdrop-filter: blur(3px);
            display: flex; align-items: center; justify-content: center; padding: 16px;
            animation: climFadeIn .2s ease;
        }
        .clim-confirm-box {
            background: #fff; border-radius: 14px;
            width: 100%; max-width: 400px;
            box-shadow: 0 24px 60px rgba(0,0,0,.35);
            overflow: hidden;
            animation: climPopIn .25s cubic-bezier(.21,1.02,.73,1);
        }
        .clim-confirm-corpo { padding: 22px 22px 6px; text-align: center; }
        .clim-confirm-icone {
            width: 46px; height: 46px; border-radius: 12px;
            background: #fef3c7; color: #d97706;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 12px;
        }
        .clim-confirm-titulo { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
        .clim-confirm-msg { font-size: 13px; color: #64748b; white-space: pre-line; line-height: 1.55; }
        .clim-confirm-acoes { display: flex; gap: 10px; padding: 16px 22px 20px; }
        .clim-confirm-btn {
            flex: 1; padding: 10px 0; border-radius: 9px; border: none;
            font-size: 12px; font-weight: 700; text-transform: uppercase;
            letter-spacing: .6px; cursor: pointer; transition: all .15s; font-family: inherit;
        }
        .clim-confirm-btn:active { transform: scale(.96); }
        .clim-confirm-cancelar { background: #f1f5f9; color: #475569; }
        .clim-confirm-cancelar:hover { background: #e2e8f0; }
        .clim-confirm-ok { background: #1d4ed8; color: #fff; }
        .clim-confirm-ok:hover { background: #1e40af; }
        .clim-confirm-ok.clim-perigo { background: #dc2626; }
        .clim-confirm-ok.clim-perigo:hover { background: #b91c1c; }
        @keyframes climFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes climPopIn  { from { opacity: 0; transform: scale(.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    `;
    document.head.appendChild(css);

    // ---------- Container de toasts ----------
    let wrap = null;
    function getWrap() {
        if (!wrap || !document.body.contains(wrap)) {
            wrap = document.createElement('div');
            wrap.className = 'clim-toast-wrap';
            document.body.appendChild(wrap);
        }
        return wrap;
    }

    const ICONES = {
        sucesso: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity=".35"/><polyline points="8.5 12.5 11 15 15.5 9.5"/></svg>',
        erro:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity=".35"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12.01" y2="16.5"/></svg>',
        aviso:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity=".35"/><line x1="12" y1="11" x2="12" y2="16.5"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/></svg>'
    };

    // ---------- TOAST ----------
    window.toast = function (mensagem, tipo = 'info', duracao = 4200) {
        const el = document.createElement('div');
        el.className = 'clim-toast clim-' + tipo;
        el.innerHTML =
            `<div class="clim-toast-icone">${ICONES[tipo] || ICONES.info}</div>` +
            `<div class="clim-toast-msg"></div>` +
            `<button class="clim-toast-fechar" aria-label="Fechar">&times;</button>`;
        el.querySelector('.clim-toast-msg').textContent = mensagem;

        const fechar = () => {
            el.classList.add('clim-saindo');
            setTimeout(() => el.remove(), 260);
        };
        el.querySelector('.clim-toast-fechar').onclick = fechar;
        getWrap().appendChild(el);
        if (duracao > 0) setTimeout(fechar, duracao);
        return fechar;
    };

    // ---------- OVERRIDE do alert() nativo ----------
    window.alert = function (mensagem) {
        const m = String(mensagem).toLowerCase();
        let tipo = 'info';
        if (m.includes('erro') || m.includes('inválid') || m.includes('invalid') || m.includes('falha') || m.includes('não pode') || m.includes('negado')) tipo = 'erro';
        else if (m.includes('sucesso') || m.includes('salvo') || m.includes('aprovad') || m.includes('concluíd') || m.includes('enviad')) tipo = 'sucesso';
        else if (m.includes('atenç') || m.includes('cuidado') || m.includes('confirm') || m.includes('⚠')) tipo = 'aviso';
        window.toast(mensagem, tipo, 5200);
    };

    // ---------- CONFIRMAÇÃO MODAL (Promise<boolean>) ----------
    window.confirmPopup = function (mensagem, opcoes = {}) {
        const titulo = opcoes.titulo || 'Confirmação necessária';
        const textoOk = opcoes.confirmarTexto || 'Confirmar';
        const perigo = opcoes.perigo !== false; // padrão: botão vermelho (ações destrutivas)

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'clim-confirm-overlay';
            overlay.innerHTML = `
                <div class="clim-confirm-box">
                    <div class="clim-confirm-corpo">
                        <div class="clim-confirm-icone">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        <div class="clim-confirm-titulo"></div>
                        <div class="clim-confirm-msg"></div>
                    </div>
                    <div class="clim-confirm-acoes">
                        <button class="clim-confirm-btn clim-confirm-cancelar">Cancelar</button>
                        <button class="clim-confirm-btn clim-confirm-ok ${perigo ? 'clim-perigo' : ''}"></button>
                    </div>
                </div>`;
            overlay.querySelector('.clim-confirm-titulo').textContent = titulo;
            overlay.querySelector('.clim-confirm-msg').textContent = mensagem;
            overlay.querySelector('.clim-confirm-ok').textContent = textoOk;

            const finalizar = (resposta) => {
                overlay.remove();
                document.removeEventListener('keydown', onKey);
                resolve(resposta);
            };
            const onKey = (e) => { if (e.key === 'Escape') finalizar(false); };

            overlay.querySelector('.clim-confirm-cancelar').onclick = () => finalizar(false);
            overlay.querySelector('.clim-confirm-ok').onclick = () => finalizar(true);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) finalizar(false); });
            document.addEventListener('keydown', onKey);

            document.body.appendChild(overlay);
        });
    };
})();
