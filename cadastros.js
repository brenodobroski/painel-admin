// ============================================================
// ABA CONFIGURAÇÕES — Cadastros de usuários + Controle de Filiais
// Admin Climario (renderiza dentro de #secao-configuracoes)
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ijkzolhxuuqmkuztdliv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqa3pvbGh4dXVxbWt1enRkbGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE1NTgsImV4cCI6MjA5Mjc5NzU1OH0.37ihEUrCAUHpzOymrPUTau164DXmvhhWal8uX4V0oI0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- CSS INJETADO (dropdowns + botões de ação) ----------
const css = document.createElement('style');
css.textContent = `
    .conf-dropdown { position: relative; }
    .conf-dd-btn {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        width: 150px; padding: 8px 12px;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
        font-size: 12px; font-weight: 600; color: #334155; cursor: pointer;
        transition: border-color .15s, box-shadow .15s;
    }
    .conf-dd-btn:hover { border-color: #93c5fd; }
    .conf-dd-btn:focus { outline: none; border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,.12); }
    .conf-dd-lista {
        display: none; position: absolute; z-index: 70; top: calc(100% + 4px); left: 0;
        width: 100%; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
        box-shadow: 0 12px 28px rgba(0,0,0,.14); overflow: hidden;
    }
    .conf-dd-lista.aberto { display: block; }
    .conf-dd-item {
        padding: 9px 12px; font-size: 12px; font-weight: 500; color: #334155;
        cursor: pointer; transition: background .12s;
    }
    .conf-dd-item:hover { background: #eff6ff; }
    .conf-dd-item.selecionado { background: #eff6ff; color: #1d4ed8; font-weight: 700; }

    .conf-btn-acao {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; border-radius: 8px; border: none; cursor: pointer;
        transition: background .15s, transform .1s;
    }
    .conf-btn-acao:active { transform: scale(.92); }
    .conf-btn-aprovar { background: #059669; }
    .conf-btn-aprovar:hover { background: #047857; }
    .conf-btn-rejeitar { background: #f1f5f9; border: 1px solid #e2e8f0; }
    .conf-btn-rejeitar:hover { background: #fee2e2; border-color: #fecaca; }
    .conf-btn-rejeitar:hover svg { stroke: #dc2626; }
    .conf-btn-rejeitar svg { stroke: #64748b; transition: stroke .15s; }

    .conf-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 9px; border-radius: 999px;
        background: #f1f5f9; font-size: 11px; font-weight: 600; color: #475569;
    }
    .conf-avatar {
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        width: 40px; height: 40px; border-radius: 10px;
        background: linear-gradient(135deg, #1d4ed8, #1e40af);
        color: #fff; font-size: 13px; font-weight: 800; letter-spacing: .5px;
    }
    .conf-badge {
        font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
        padding: 4px 10px; border-radius: 999px;
    }
    .conf-btn-desligar {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 8px; cursor: pointer;
        border: 1px solid #fecaca; background: #fff; color: #dc2626;
        font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px;
        transition: background .15s;
    }
    .conf-btn-desligar:hover { background: #fef2f2; }
`;
document.head.appendChild(css);

// ---------- SUB-ABAS ----------
function mostrarSubAba(aba) {
    const c = document.getElementById('subconf-cadastros');
    const f = document.getElementById('subconf-filiais');
    const bC = document.getElementById('btn-subconf-cadastros');
    const bF = document.getElementById('btn-subconf-filiais');
    const ativa = 'px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 border-blue-700 text-blue-700 transition-colors';
    const inativa = 'px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 border-transparent text-slate-400 hover:text-slate-600 transition-colors';
    if (aba === 'cadastros') { c.classList.remove('hidden'); f.classList.add('hidden'); bC.className = ativa; bF.className = inativa; }
    else { f.classList.remove('hidden'); c.classList.add('hidden'); bF.className = ativa; bC.className = inativa; }
}

// ---------- CARREGAMENTO GERAL ----------
window.carregarAbaConfiguracoes = async function () {
    mostrarSubAba('cadastros');
    await Promise.all([carregarSolicitacoes(), carregarFiliais()]);
};

// ---------- ÍCONES SVG ----------
const ICON_CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_X = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const ICON_USER_X = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>`;
const ICON_INBOX = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`;

// ---------- SOLICITAÇÕES DE CADASTRO ----------
async function carregarSolicitacoes() {
    const lista = document.getElementById('lista-solicitacoes-cadastro');
    if (!lista) return;
    lista.innerHTML = '<p class="text-sm text-slate-500">Carregando...</p>';

    const { data, error } = await supabase
        .from('solicitacoes_cadastro')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        lista.innerHTML = `<p class="text-sm text-red-600">Erro ao carregar: ${error.message}</p>`;
        return;
    }

    // Badge na sidebar
    const pendentesCount = (data || []).filter(s => s.status === 'pendente').length;
    const badge = document.getElementById('badge-cadastros');
    if (badge) {
        badge.textContent = pendentesCount;
        badge.classList.toggle('hidden', pendentesCount === 0);
    }

    const pendentes = (data || []).filter(s => s.status === 'pendente');
    const processadas = (data || []).filter(s => s.status !== 'pendente');

    let html = '';
    if (pendentes.length === 0) {
        html += `
            <div class="bg-white rounded-xl border border-slate-200 py-10 flex flex-col items-center gap-2 text-center">
                ${ICON_INBOX}
                <p class="text-sm font-semibold text-slate-600">Tudo em dia!</p>
                <p class="text-xs text-slate-400">Nenhuma solicitação de cadastro pendente.</p>
            </div>`;
    } else {
        html += `<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pendentes (${pendentes.length})</p>`;
        pendentes.forEach(s => { html += cardSolicitacao(s, true); });
    }

    if (processadas.length > 0) {
        html += `<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-6">Histórico</p>`;
        processadas.forEach(s => { html += cardSolicitacao(s, false); });
    }

    lista.innerHTML = html;

    // Liga os eventos
    pendentes.forEach(s => {
        document.getElementById(`btn-aprovar-${s.id}`)?.addEventListener('click', () => aprovarCadastro(s));
        document.getElementById(`btn-rejeitar-${s.id}`)?.addEventListener('click', () => rejeitarCadastro(s.id));
        // Dropdown de role
        document.getElementById(`btn-role-${s.id}`)?.addEventListener('click', (e) => {
            e.stopPropagation();
            fecharTodosDropdowns();
            document.getElementById(`lista-role-${s.id}`).classList.toggle('aberto');
        });
        document.querySelectorAll(`#lista-role-${s.id} .conf-dd-item`).forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById(`role-${s.id}`).value = item.dataset.role;
                document.getElementById(`txt-role-${s.id}`).textContent = item.textContent;
                document.querySelectorAll(`#lista-role-${s.id} .conf-dd-item`).forEach(i => i.classList.remove('selecionado'));
                item.classList.add('selecionado');
                fecharTodosDropdowns();
            });
        });
    });
    processadas.forEach(s => {
        if (s.status === 'aprovado') {
            document.getElementById(`btn-desligar-${s.id}`)?.addEventListener('click', () => desligarUsuario(s));
        }
    });
}

function fecharTodosDropdowns() {
    document.querySelectorAll('.conf-dd-lista.aberto').forEach(d => d.classList.remove('aberto'));
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.conf-dropdown')) fecharTodosDropdowns();
});

function cardSolicitacao(s, pendente) {
    const dataFmt = new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const iniciais = (s.nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

    const badge = pendente
        ? `<span class="conf-badge bg-amber-100 text-amber-700">Pendente</span>`
        : s.status === 'aprovado'
            ? `<span class="conf-badge bg-emerald-100 text-emerald-700">${s.role === 'gestor' ? 'Gestor' : 'Vendedor'}</span>`
            : `<span class="conf-badge bg-slate-100 text-slate-500">Rejeitado</span>`;

    let acoes = '';
    if (pendente) {
        acoes = `
            <div class="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Perfil</span>
                <div class="conf-dropdown">
                    <button type="button" id="btn-role-${s.id}" class="conf-dd-btn">
                        <span id="txt-role-${s.id}">Vendedor</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div id="lista-role-${s.id}" class="conf-dd-lista">
                        <div class="conf-dd-item selecionado" data-role="vendedor">Vendedor</div>
                        <div class="conf-dd-item" data-role="gestor">Gestor</div>
                    </div>
                    <input type="hidden" id="role-${s.id}" value="vendedor">
                </div>
                <div class="flex-1"></div>
                <button id="btn-aprovar-${s.id}" class="conf-btn-acao conf-btn-aprovar" title="Aprovar cadastro">${ICON_CHECK}</button>
                <button id="btn-rejeitar-${s.id}" class="conf-btn-acao conf-btn-rejeitar" title="Rejeitar cadastro">${ICON_X}</button>
            </div>`;
    } else if (s.status === 'aprovado') {
        acoes = `
            <div class="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button id="btn-desligar-${s.id}" class="conf-btn-desligar">${ICON_USER_X} Desligar acesso</button>
            </div>`;
    }

    return `
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="flex items-start gap-3">
                <div class="conf-avatar">${iniciais}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="font-bold text-slate-800 text-sm truncate">${s.nome}</p>
                            <p class="text-xs text-slate-500 truncate">${s.email}</p>
                        </div>
                        ${badge}
                    </div>
                    <div class="flex flex-wrap gap-1.5 mt-2.5">
                        <span class="conf-chip">Filial <b>${s.filial}</b></span>
                        <span class="conf-chip">RCA <b>${s.rca}</b></span>
                        <span class="conf-chip">${dataFmt}</span>
                    </div>
                </div>
            </div>
            ${acoes}
        </div>`;
}

async function aprovarCadastro(s) {
    const role = document.getElementById(`role-${s.id}`)?.value || 'vendedor';
    if (!confirm(`Aprovar ${s.nome} como ${role === 'gestor' ? 'GESTOR' : 'VENDEDOR'}?`)) return;

    const { error: erroUsuario } = await supabase
        .from('usuarios')
        .upsert({
            id: s.user_id,
            email: s.email,
            nome: s.nome,
            filial: s.filial,
            rca: s.rca,
            role: role
        }, { onConflict: 'id' });

    if (erroUsuario) {
        alert('Erro ao aprovar: ' + erroUsuario.message);
        return;
    }

    await supabase.from('solicitacoes_cadastro')
        .update({ status: 'aprovado', role: role })
        .eq('id', s.id);

    carregarSolicitacoes();
}

async function rejeitarCadastro(id) {
    if (!confirm('Rejeitar esta solicitação?')) return;
    await supabase.from('solicitacoes_cadastro')
        .update({ status: 'rejeitado' })
        .eq('id', id);
    carregarSolicitacoes();
}

async function desligarUsuario(s) {
    if (!confirm(`Remover o acesso de ${s.nome}? Ele não conseguirá mais logar.`)) return;
    await supabase.from('usuarios').delete().eq('id', s.user_id);
    await supabase.from('solicitacoes_cadastro')
        .update({ status: 'rejeitado' })
        .eq('id', s.id);
    carregarSolicitacoes();
}

// ---------- CONTROLE DE FILIAIS ----------
async function carregarFiliais() {
    const lista = document.getElementById('lista-filiais');
    if (!lista) return;
    lista.innerHTML = '<p class="text-sm text-slate-500">Carregando...</p>';

    const { data, error } = await supabase
        .from('filiais')
        .select('*')
        .order('codigo');

    if (error) {
        lista.innerHTML = `<p class="text-sm text-red-600">Erro ao carregar: ${error.message}</p>`;
        return;
    }
    if (!data || data.length === 0) {
        lista.innerHTML = `<div class="bg-white rounded-xl border border-slate-200 py-10 text-center text-sm text-slate-500">Nenhuma filial cadastrada. Cadastre a primeira acima.</div>`;
        return;
    }

    lista.innerHTML = data.map(f => `
        <div class="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center gap-3">
                <div class="conf-avatar" style="width:34px;height:34px;font-size:11px;border-radius:8px;">${f.codigo.slice(0, 2)}</div>
                <div>
                    <p class="font-bold text-slate-800 text-sm">${f.codigo}${f.nome ? ` <span class="font-normal text-slate-500">— ${f.nome}</span>` : ''}</p>
                    <span class="conf-badge ${f.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}" style="padding:2px 8px;">${f.ativa ? 'Ativa' : 'Inativa'}</span>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button data-toggle="${f.id}" class="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">${f.ativa ? 'Desativar' : 'Ativar'}</button>
                <button data-del="${f.id}" class="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all">Excluir</button>
            </div>
        </div>
    `).join('');

    lista.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => toggleFilial(b.dataset.toggle));
    lista.querySelectorAll('[data-del]').forEach(b => b.onclick = () => excluirFilial(b.dataset.del));
}

async function adicionarFilial() {
    const codigo = document.getElementById('nova-filial-codigo').value.trim();
    const nome = document.getElementById('nova-filial-nome').value.trim();
    if (!codigo) { alert('Informe o código da filial.'); return; }

    const { error } = await supabase.from('filiais')
        .insert([{ codigo, nome, ativa: true }]);

    if (error) {
        alert('Erro: ' + (error.code === '23505' ? 'Já existe uma filial com esse código.' : error.message));
        return;
    }
    document.getElementById('nova-filial-codigo').value = '';
    document.getElementById('nova-filial-nome').value = '';
    carregarFiliais();
}

async function toggleFilial(id) {
    const { data } = await supabase.from('filiais').select('ativa').eq('id', id).single();
    if (!data) return;
    await supabase.from('filiais').update({ ativa: !data.ativa }).eq('id', id);
    carregarFiliais();
}

async function excluirFilial(id) {
    if (!confirm('Excluir esta filial? Ela sairá do select de cadastro do app de orçamento.')) return;
    await supabase.from('filiais').delete().eq('id', id);
    carregarFiliais();
}

// ---------- BOOT ----------
document.getElementById('btn-subconf-cadastros')?.addEventListener('click', () => mostrarSubAba('cadastros'));
document.getElementById('btn-subconf-filiais')?.addEventListener('click', () => mostrarSubAba('filiais'));
document.getElementById('btn-add-filial')?.addEventListener('click', adicionarFilial);

carregarSolicitacoes();