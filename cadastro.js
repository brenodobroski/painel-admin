// ============================================================
// PAINEL DE CADASTROS + CONTROLE DE FILIAIS (Admin Climario)
// Arquivo independente — não interfere no admin.js
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ijkzolhxuuqmkuztdliv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqa3pvbGh4dXVxbWt1enRkbGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE1NTgsImV4cCI6MjA5Mjc5NzU1OH0.37ihEUrCAUHpzOymrPUTau164DXmvhhWal8uX4V0oI0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ID_BTN = 'btn-painel-cadastros';
const ID_PANEL = 'painel-cadastros';

// ---------- INJEÇÃO DO BOTÃO FLUTUANTE + PAINEL ----------
function injetarUI() {
    if (document.getElementById(ID_BTN)) return;

    // Botão flutuante
    const btn = document.createElement('button');
    btn.id = ID_BTN;
    btn.innerHTML = '👤 Cadastros';
    btn.className = 'fixed bottom-5 right-5 z-40 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-full shadow-2xl transition-all active:scale-95';
    btn.onclick = abrirPainel;
    document.body.appendChild(btn);

    // Painel overlay
    const overlay = document.createElement('div');
    overlay.id = ID_PANEL;
    overlay.className = 'fixed inset-0 z-50 hidden';
    overlay.style.background = 'rgba(10,22,40,0.65)';
    overlay.style.backdropFilter = 'blur(3px)';
    overlay.innerHTML = `
        <div class="absolute inset-x-0 top-0 bottom-0 md:inset-y-6 md:inset-x-24 lg:inset-x-48 bg-slate-100 rounded-none md:rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <!-- Cabeçalho -->
            <div class="flex items-center justify-between bg-slate-900 px-6 py-4 flex-shrink-0">
                <div>
                    <h2 class="text-white font-bold text-lg">Configurações de Acesso</h2>
                    <p class="text-slate-400 text-xs">Aprovação de cadastros e controle de filiais</p>
                </div>
                <button id="fechar-painel-cadastros" class="text-slate-400 hover:text-white text-2xl leading-none px-2">&times;</button>
            </div>

            <!-- Abas -->
            <div class="flex bg-white border-b border-slate-200 flex-shrink-0">
                <button id="aba-solicitacoes" class="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-blue-700 border-b-2 border-blue-700">Solicitações de cadastro</button>
                <button id="aba-filiais" class="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 border-b-2 border-transparent">Controle de filiais</button>
            </div>

            <!-- Conteúdo -->
            <div class="flex-1 overflow-y-auto p-6">
                <!-- ABA SOLICITAÇÕES -->
                <div id="conteudo-solicitacoes">
                    <div id="lista-solicitacoes" class="space-y-3">
                        <p class="text-sm text-slate-500">Carregando...</p>
                    </div>
                </div>

                <!-- ABA FILIAIS -->
                <div id="conteudo-filiais" class="hidden">
                    <!-- Form nova filial -->
                    <div class="bg-white rounded-lg border border-slate-200 p-4 mb-5">
                        <h3 class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Nova filial</h3>
                        <div class="flex flex-col sm:flex-row gap-3">
                            <input id="nova-filial-codigo" type="text" placeholder="Código (ex: 1028)"
                                   class="flex-1 px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-700">
                            <input id="nova-filial-nome" type="text" placeholder="Nome (ex: Niterói)"
                                   class="flex-[2] px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-700">
                            <button id="btn-add-filial"
                                    class="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded transition-all active:scale-95">
                                Adicionar
                            </button>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-2">As filiais ativas aparecem automaticamente no select do cadastro de novos usuários.</p>
                    </div>
                    <div id="lista-filiais" class="space-y-2">
                        <p class="text-sm text-slate-500">Carregando...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharPainel(); });
    document.body.appendChild(overlay);

    document.getElementById('fechar-painel-cadastros').onclick = fecharPainel;
    document.getElementById('aba-solicitacoes').onclick = () => mostrarAba('solicitacoes');
    document.getElementById('aba-filiais').onclick = () => mostrarAba('filiais');
    document.getElementById('btn-add-filial').onclick = adicionarFilial;
}

function abrirPainel() {
    document.getElementById(ID_PANEL).classList.remove('hidden');
    mostrarAba('solicitacoes');
    carregarSolicitacoes();
    carregarFiliais();
}
function fecharPainel() { document.getElementById(ID_PANEL).classList.add('hidden'); }

function mostrarAba(aba) {
    const s = document.getElementById('conteudo-solicitacoes');
    const f = document.getElementById('conteudo-filiais');
    const bS = document.getElementById('aba-solicitacoes');
    const bF = document.getElementById('aba-filiais');
    if (aba === 'solicitacoes') {
        s.classList.remove('hidden'); f.classList.add('hidden');
        bS.className = 'flex-1 py-3 text-xs font-bold uppercase tracking-widest text-blue-700 border-b-2 border-blue-700';
        bF.className = 'flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 border-b-2 border-transparent';
    } else {
        f.classList.remove('hidden'); s.classList.add('hidden');
        bF.className = 'flex-1 py-3 text-xs font-bold uppercase tracking-widest text-blue-700 border-b-2 border-blue-700';
        bS.className = 'flex-1 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 border-b-2 border-transparent';
    }
}

// ---------- SOLICITAÇÕES DE CADASTRO ----------
async function carregarSolicitacoes() {
    const lista = document.getElementById('lista-solicitacoes');
    lista.innerHTML = '<p class="text-sm text-slate-500">Carregando...</p>';

    const { data, error } = await supabase
        .from('solicitacoes_cadastro')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        lista.innerHTML = `<p class="text-sm text-red-600">Erro ao carregar: ${error.message}</p>`;
        return;
    }

    const pendentes = (data || []).filter(s => s.status === 'pendente');
    const processadas = (data || []).filter(s => s.status !== 'pendente');

    let html = '';
    if (pendentes.length === 0) {
        html += `<div class="bg-white rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">Nenhuma solicitação pendente. ✅</div>`;
    } else {
        html += `<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Pendentes (${pendentes.length})</p>`;
        pendentes.forEach(s => { html += cardSolicitacao(s, true); });
    }

    if (processadas.length > 0) {
        html += `<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-6 mb-2">Histórico</p>`;
        processadas.forEach(s => { html += cardSolicitacao(s, false); });
    }

    lista.innerHTML = html;

    // Liga os botões
    pendentes.forEach(s => {
        document.getElementById(`btn-aprovar-${s.id}`)?.addEventListener('click', () => aprovarCadastro(s));
        document.getElementById(`btn-rejeitar-${s.id}`)?.addEventListener('click', () => rejeitarCadastro(s.id));
    });
    processadas.forEach(s => {
        if (s.status === 'aprovado') {
            document.getElementById(`btn-desligar-${s.id}`)?.addEventListener('click', () => desligarUsuario(s));
        }
    });
}

function cardSolicitacao(s, pendente) {
    const dataFmt = new Date(s.created_at).toLocaleString('pt-BR');
    const badge = pendente
        ? `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-700">Pendente</span>`
        : s.status === 'aprovado'
            ? `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">Aprovado · ${s.role || '-'}</span>`
            : `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-600">Rejeitado</span>`;

    let acoes = '';
    if (pendente) {
        acoes = `
            <div class="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-slate-100">
                <select id="role-${s.id}" class="flex-1 px-3 py-2 border border-slate-200 rounded text-xs outline-none focus:border-blue-700 bg-slate-50">
                    <option value="vendedor">Vendedor</option>
                    <option value="gestor">Gestor</option>
                </select>
                <button id="btn-aprovar-${s.id}" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-all active:scale-95">✔ Aprovar</button>
                <button id="btn-rejeitar-${s.id}" class="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-all active:scale-95">✖ Rejeitar</button>
            </div>`;
    } else if (s.status === 'aprovado') {
        acoes = `
            <div class="mt-3 pt-3 border-t border-slate-100">
                <button id="btn-desligar-${s.id}" class="w-full border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded transition-all active:scale-95">Desligar usuário (remover acesso)</button>
            </div>`;
    }

    return `
        <div class="bg-white rounded-lg border border-slate-200 p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="font-bold text-slate-800">${s.nome}</p>
                    <p class="text-xs text-slate-500">${s.email}</p>
                </div>
                ${badge}
            </div>
            <div class="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-600">
                <span class="bg-slate-100 px-2 py-0.5 rounded">Filial: <b>${s.filial}</b></span>
                <span class="bg-slate-100 px-2 py-0.5 rounded">RCA: <b>${s.rca}</b></span>
                <span class="bg-slate-100 px-2 py-0.5 rounded">${dataFmt}</span>
            </div>
            ${acoes}
        </div>`;
}

async function aprovarCadastro(s) {
    const role = document.getElementById(`role-${s.id}`).value;
    if (!confirm(`Aprovar ${s.nome} como ${role.toUpperCase()}?`)) return;

    // 1. Grava na tabela usuarios (upsert = cria ou atualiza se o trigger já criou)
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

    // 2. Marca a solicitação como aprovada
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
    if (!confirm(`Remover o acesso de ${s.nome}? Ele não conseguirá mais logar (a fila de cadastro será marcada como rejeitada).`)) return;
    // Remove da tabela usuarios → o login.js já bloqueia quem não está nela
    await supabase.from('usuarios').delete().eq('id', s.user_id);
    await supabase.from('solicitacoes_cadastro')
        .update({ status: 'rejeitado' })
        .eq('id', s.id);
    carregarSolicitacoes();
}

// ---------- CONTROLE DE FILIAIS ----------
async function carregarFiliais() {
    const lista = document.getElementById('lista-filiais');
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
        lista.innerHTML = `<div class="bg-white rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500">Nenhuma filial cadastrada.</div>`;
        return;
    }

    lista.innerHTML = data.map(f => `
        <div class="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between gap-3">
            <div>
                <p class="font-bold text-slate-800 text-sm">${f.codigo}${f.nome ? ` <span class="font-normal text-slate-500">— ${f.nome}</span>` : ''}</p>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${f.ativa ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}">${f.ativa ? 'Ativa' : 'Inativa'}</span>
                <button data-toggle="${f.id}" class="text-[10px] font-bold uppercase px-3 py-1.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all">${f.ativa ? 'Desativar' : 'Ativar'}</button>
                <button data-del="${f.id}" class="text-[10px] font-bold uppercase px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition-all">Excluir</button>
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
    await supabase.from('filiais').update({ ativa: !data.ativa }).eq('id', id);
    carregarFiliais();
}

async function excluirFilial(id) {
    if (!confirm('Excluir esta filial? Ela sairá do select de cadastro.')) return;
    await supabase.from('filiais').delete().eq('id', id);
    carregarFiliais();
}

// ---------- BOOT ----------
injetarUI();