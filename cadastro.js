// ============================================================
// ABA CONFIGURAÇÕES — Cadastros de usuários + Controle de Filiais
// Admin Climario (renderiza dentro de #secao-configuracoes)
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ijkzolhxuuqmkuztdliv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqa3pvbGh4dXVxbWt1enRkbGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE1NTgsImV4cCI6MjA5Mjc5NzU1OH0.37ihEUrCAUHpzOymrPUTau164DXmvhhWal8uX4V0oI0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

// ---------- CARREGAMENTO GERAL (chamado pela mudarAba) ----------
window.carregarAbaConfiguracoes = async function () {
    mostrarSubAba('cadastros');
    await Promise.all([carregarSolicitacoes(), carregarFiliais()]);
};

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
        html += `<div class="bg-white rounded border border-slate-200 p-6 text-center text-sm text-slate-500">Nenhuma solicitação de cadastro pendente. ✅</div>`;
    } else {
        html += `<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pendentes (${pendentes.length})</p>`;
        pendentes.forEach(s => { html += cardSolicitacao(s, true); });
    }

    if (processadas.length > 0) {
        html += `<p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-5">Histórico</p>`;
        processadas.forEach(s => { html += cardSolicitacao(s, false); });
    }

    lista.innerHTML = html;

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
        <div class="bg-white rounded border border-slate-200 p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="font-bold text-slate-800 text-sm">${s.nome}</p>
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

    // 1. Grava na tabela usuarios (upsert = cria ou atualiza)
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
        lista.innerHTML = `<div class="bg-white rounded border border-slate-200 p-6 text-center text-sm text-slate-500">Nenhuma filial cadastrada. Cadastre a primeira acima.</div>`;
        return;
    }

    lista.innerHTML = data.map(f => `
        <div class="bg-white rounded border border-slate-200 p-3 flex items-center justify-between gap-3">
            <p class="font-bold text-slate-800 text-sm">${f.codigo}${f.nome ? ` <span class="font-normal text-slate-500">— ${f.nome}</span>` : ''}</p>
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

// Já atualiza o badge de pendentes ao abrir o painel (mesmo sem entrar na aba)
carregarSolicitacoes();