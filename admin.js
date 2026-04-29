console.log("🚀 O script admin.js foi carregado com sucesso!");

// 1. Importação e Configuração do Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ijkzolhxuuqmkuztdliv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqa3pvbGh4dXVxbWt1enRkbGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE1NTgsImV4cCI6MjA5Mjc5NzU1OH0.37ihEUrCAUHpzOymrPUTau164DXmvhhWal8uX4V0oI0'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let produtos = [];
let solicitacoesPendentes = [];
let solicitacaoAtivaId = null;

// Variáveis de Filtro
let filtroBusca = "";
let filtroMarca = "";
let filtroTipo = "";

// ==========================================
// 1. AUTENTICAÇÃO E INICIALIZAÇÃO
// ==========================================
async function verificarAcessoAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = "../login.html";
        return;
    }

    const { data: perfil, error } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (error || !perfil || perfil.role !== 'admin') {
        alert("Acesso negado.");
        window.location.href = "../index.html";
    } else {
        carregarProdutosAdmin(); 
        carregarSolicitacoes(); 
    }
}
verificarAcessoAdmin();

// ==========================================
// 2. MÓDULO DE APROVAÇÕES COMERCIAIS
// ==========================================
async function carregarSolicitacoes() {
    try {
        const { data, error } = await supabase
            .from('solicitacoes_orcamento')
            .select('*')
            .eq('status', 'pendente')
            .order('created_at', { ascending: false });

        if (error) throw error;

        solicitacoesPendentes = data || [];
        renderizarTabelaAprovacoes(solicitacoesPendentes);
        atualizarBadge(solicitacoesPendentes.length);
    } catch (err) {
        console.error("Erro ao carregar solicitações:", err);
    }
}

function atualizarBadge(qtd) {
    const badge = document.getElementById('badge-solicitacoes');
    if (badge) {
        if (qtd > 0) {
            badge.innerText = qtd;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function renderizarTabelaAprovacoes(lista) {
    const corpo = document.getElementById('corpo-aprovacoes');
    if (!corpo) return;
    corpo.innerHTML = '';

    if (lista.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500 italic">Nenhuma solicitação pendente no momento.</td></tr>`;
        return;
    }

    lista.forEach(req => {
        const dataFormatada = new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";
        tr.innerHTML = `
            <td class="p-4 text-xs font-mono text-slate-500">${dataFormatada}</td>
            <td class="p-4">
                <p class="font-bold text-slate-800 text-xs">${req.vendedor_email}</p>
                <p class="text-[10px] text-slate-500 uppercase">Filial ${req.filial}</p>
            </td>
            <td class="p-4 text-right font-black text-indigo-700">R$ ${parseFloat(req.valor_alvo).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td class="p-4 text-center font-bold text-orange-600">${parseFloat(req.desconto_solicitado).toFixed(2)}%</td>
            <td class="p-4 text-center">
                <span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Pendente</span>
            </td>
            <td class="p-4 text-center">
                <button onclick="abrirModalAnaliseJS('${req.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm">
                    Avaliar
                </button>
            </td>
        `;
        corpo.appendChild(tr);
    });
}

window.abrirModalAnaliseJS = function(id) {
    const req = solicitacoesPendentes.find(s => s.id === id);
    if (!req) return;

    solicitacaoAtivaId = id; 

    document.getElementById('modal-analise-id').innerText = `ID: #${req.id.split('-')[0]}`;
    document.getElementById('modal-analise-vendedor').innerText = req.vendedor_email;
    document.getElementById('modal-analise-filial').innerText = `Filial: ${req.filial}`;
    document.getElementById('modal-analise-alvo').innerText = `R$ ${parseFloat(req.valor_alvo).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('modal-analise-desconto').innerText = `Desconto: ${parseFloat(req.desconto_solicitado).toFixed(2)}%`;
    document.getElementById('modal-analise-pagamento').innerText = `Pagamento: ${req.pagamento}`;
    document.getElementById('modal-analise-rt').innerText = `RT: ${parseFloat(req.rt).toFixed(2)}%`;
    document.getElementById('modal-analise-motivo').innerText = `"${req.motivo}"`;

    // ==========================================
    // LÓGICA DO DESCONTO PROTHEUS 
    // ==========================================
    const descDecimal = parseFloat(req.desconto_solicitado || 0) / 100;
    const rtDecimal = parseFloat(req.rt || 0) / 100;
    
    let penalidadePagto = 0;
    const pagTexto = String(req.pagamento || '').toLowerCase();
    if (pagTexto.includes('6 vezes') || pagTexto.includes('8 vezes') || pagTexto.includes('10 vezes')) {
        penalidadePagto = 5;
    }
    const pagtoDecimal = penalidadePagto / 100;

    // A fórmula inteligente
    const novoMarkup = (1.63920658 * ((1 - descDecimal) * (1 + (rtDecimal * 1.4)) * (1 + pagtoDecimal))) / 0.965;
    let descProtheusPedido = (((novoMarkup / 1.699) - 1) * -1) * 100;
    
    if (descProtheusPedido < 0) descProtheusPedido = 0;

    const elProtheus = document.getElementById('modal-analise-protheus');
    if (elProtheus) elProtheus.innerText = `Desc Protheus: ${descProtheusPedido.toFixed(1)}%`;


    // ==========================================
    // CONTROLE DE EVIDÊNCIA OPCIONAL
    // ==========================================
    const linkEvidencia = document.getElementById('modal-analise-evidencia-link');
    const avisoVazio = document.getElementById('modal-analise-evidencia-vazia');

    // Verifica se a URL existe, não está vazia e não é um texto "null"
    if (req.url_evidencia && String(req.url_evidencia).trim() !== '' && String(req.url_evidencia) !== 'null') {
        linkEvidencia.href = req.url_evidencia;
        linkEvidencia.classList.remove('hidden');
        if (avisoVazio) avisoVazio.classList.add('hidden');
    } else {
        linkEvidencia.classList.add('hidden');
        if (avisoVazio) avisoVazio.classList.remove('hidden');
    }
    
    const corpoItens = document.getElementById('modal-analise-itens');
    corpoItens.innerHTML = '';

    const itens = req.itens || [];
    itens.forEach(item => {
        const produtoBase = produtos.find(p => String(p.sku) === String(item.codigo));
        let markupMatematico = 0;
        let infoCusto = "Custo não localizado";

        if (produtoBase) {
            const custo = parseFloat(produtoBase.custo || produtoBase.custos?.custo || 0);
            const verba = parseFloat(produtoBase.verba || produtoBase.custos?.verba || 0);
            const custoLiquido = custo - verba;
            
            if (custoLiquido > 0) {
                markupMatematico = item.valorUnitario / custoLiquido;
                infoCusto = `Mk: ${markupMatematico.toFixed(4)}`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-2 font-mono text-slate-500">${item.codigo}</td>
            <td class="p-2 font-bold text-slate-800">${item.descricao}</td>
            <td class="p-2 text-center">${item.qtd}</td>
            <td class="p-2 text-right">
                <p class="font-bold text-slate-800">R$ ${parseFloat(item.valorUnitario).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                <p class="text-[10px] text-orange-600 font-bold">${infoCusto}</p>
            </td>
            <td class="p-2 text-right font-black text-indigo-700">R$ ${parseFloat(item.subtotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
        `;
        corpoItens.appendChild(tr);
    });

    window.cancelarReprovacao(); 
    document.getElementById('modal-analise-solicitacao').classList.remove('hidden');
};

window.abrirAreaReprovacao = function() {
    document.getElementById('botoes-acao-modal')?.classList.add('hidden');
    document.getElementById('area-reprovacao')?.classList.remove('hidden');
    document.getElementById('input-motivo-reprovacao')?.focus();
};

window.cancelarReprovacao = function() {
    document.getElementById('area-reprovacao')?.classList.add('hidden');
    document.getElementById('botoes-acao-modal')?.classList.remove('hidden');
    const inputMotivo = document.getElementById('input-motivo-reprovacao');
    if (inputMotivo) inputMotivo.value = ''; 
};

window.aprovarSolicitacao = async function() {
    if (!confirm("Confirmar APROVAÇÃO deste orçamento? O status mudará e o vendedor será liberado.")) return;
    await processarDecisao('aprovado');
};

window.confirmarReprovacaoJS = async function() {
    const motivoInput = document.getElementById('input-motivo-reprovacao');
    if (!motivoInput) return;

    const motivoText = motivoInput.value.trim();
    if (!motivoText) {
        alert("O motivo da reprovação é obrigatório.");
        return;
    }
    
    await processarDecisao('reprovado', motivoText);
};

async function processarDecisao(novoStatus, motivo = null) {
    if (!solicitacaoAtivaId) {
        alert("Erro: Nenhuma solicitação ativa identificada.");
        return;
    }

    try {
        const { data, error } = await supabase
            .from('solicitacoes_orcamento')
            .update({ 
                status: String(novoStatus), 
                motivo_reprovacao: motivo 
            })
            .eq('id', solicitacaoAtivaId)
            .select(); 

        if (error) throw error;

        if (data && data.length > 0) {
            alert(`Sucesso! O orçamento agora está como: ${novoStatus.toUpperCase()}`);
            const modal = document.getElementById('modal-analise-solicitacao');
            if (modal) modal.classList.add('hidden');
            await carregarSolicitacoes();
        } 

    } catch (err) {
        console.error("Erro técnico na atualização:", err);
        alert("Falha ao salvar no banco: " + err.message);
    }
}

// ==========================================
// 3. MÓDULO DE GESTÃO DE PRODUTOS E PRECIFICAÇÃO
// ==========================================
async function carregarProdutosAdmin() {
    try {
        const { data, error } = await supabase
            .from('produtos')
            .select(`*, custos (custo, verba)`);

        if (error) throw error;

        if (data && data.length > 0) {
            produtos = data;
            renderizarTabelaAdmin();
        }
    } catch (err) {
        console.error("Erro na execução da função:", err);
    }
}

document.getElementById('filtro-busca')?.addEventListener('input', (e) => {
    filtroBusca = e.target.value.toLowerCase();
    renderizarTabelaAdmin();
});

document.getElementById('filtro-marca')?.addEventListener('change', (e) => {
    filtroMarca = e.target.value.toUpperCase();
    renderizarTabelaAdmin();
});

document.getElementById('filtro-tipo')?.addEventListener('change', (e) => {
    filtroTipo = e.target.value.toUpperCase();
    renderizarTabelaAdmin();
});

function calcularMarkupBaseFixa() {
    return 1.63920658;
}

function renderizarTabelaAdmin() {
    const corpo = document.getElementById('corpo-tabela-admin');
    if (!corpo) return;
    corpo.innerHTML = '';

    const markupBaseCalculado = calcularMarkupBaseFixa();

    const produtosFiltrados = produtos.filter(item => {
        const matchBusca = (item.sku) || (item.descricao || item.produto || "").toLowerCase().includes(filtroBusca);
        const matchMarca = filtroMarca === "" || (item.marca || "").toUpperCase() === filtroMarca;
        
        let matchTipo = true;
        const tipoBase = (item.tipo || item.TIPO || "").toUpperCase();
        if (filtroTipo === "CONDENSADORA") matchTipo = tipoBase.includes("CONDENSADORA");
        else if (filtroTipo === "EVAPORADORA") matchTipo = tipoBase.includes("EVAPORADORA");
        else if (filtroTipo === "ACESSORIOS") matchTipo = tipoBase.includes("GRELHA") || tipoBase.includes("CONTROLE") || tipoBase.includes("ACESSORIO");

        return matchBusca && matchMarca && matchTipo;
    });

    produtosFiltrados.forEach(item => {
        const id = item.sku;
        const custo = parseFloat(item.custo || item.custos?.custo || 0);
        const verba = parseFloat(item.verba || item.custos?.verba || 0);
        const novoCusto = custo - verba;

        // --- CÁLCULO INTELIGENTE DO PREÇO BD ---
        // Usa o markup específico da linha (salvo no banco) ou cai pro Fixo se não existir
        const markupLinha = parseFloat(item.markup_base) || markupBaseCalculado;
        const precoBD = novoCusto * markupLinha;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors text-xs";
        
        tr.innerHTML = `
            <td class="p-4 font-mono text-slate-400">${id}</td>
            <td class="p-4 font-bold text-slate-800">${(item.descricao || item.produto || "---").toUpperCase()}</td>
            <td class="p-2 text-center">
                <input type="number" id="custo-${id}" value="${custo.toFixed(2)}" step="0.01"
                    oninput="recalcularLinha('${id}', ${markupBaseCalculado})"
                    class="w-20 border border-slate-200 rounded text-right font-bold p-1 text-blue-600 focus:border-blue-500 outline-none">
            </td>
            <td class="p-2 text-center">
                <input type="number" id="verba-${id}" value="${verba.toFixed(2)}" step="0.01"
                    oninput="recalcularLinha('${id}', ${markupBaseCalculado})"
                    class="w-20 border border-slate-200 rounded text-right font-bold p-1 text-blue-600 focus:border-blue-500 outline-none">
            </td>
            <td class="p-4 text-right font-bold text-slate-900" id="custoliq-${id}">R$ ${novoCusto.toFixed(2)}</td>
            <td class="p-4 text-center">
                <span id="markup-disp-${id}" class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-black">${markupLinha.toFixed(4)}</span>
            </td>
            <td class="p-2 text-center">
                <input type="number" id="alt-${id}" value="0.00" step="0.1"
                    oninput="recalcularLinha('${id}', ${markupBaseCalculado})"
                    class="w-16 border border-slate-200 rounded text-center font-bold p-1 focus:border-orange-500 outline-none">
            </td>
            <td class="p-4 text-right font-black text-indigo-700" id="sugestao-${id}">
                R$ ${precoBD.toFixed(2)} <span class="text-[9px] text-slate-400 block font-normal">(Banco)</span>
            </td>
        `;
        corpo.appendChild(tr);
        recalcularLinha(id, markupBaseCalculado, precoBD);
    });
}

document.getElementById('btn-atualizar-variacoes')?.addEventListener('click', () => {
    const markupBaseCalculado = calcularMarkupBaseFixa();

    produtos.forEach(item => {
        const id = item.sku;
        const inputAlt = document.getElementById(`alt-${id}`);
        
        if (inputAlt) {
            const markupSistema = parseFloat(item.markup_base) || markupBaseCalculado;
            const mkFinal = markupSistema > 0 ? markupSistema : markupBaseCalculado;

            const variacao = (1 - (markupBaseCalculado / mkFinal)) * 100;
            inputAlt.value = variacao.toFixed(2);
            
            recalcularLinha(id, markupBaseCalculado);
        }
    });
    
    alert("Variação calculada com sucesso! A % foi preenchida cruzando o markup do sistema com a base fixa.");
});

window.recalcularLinha = function(id, markupFix, valorForcado = null) {
    const custo = parseFloat(document.getElementById(`custo-${id}`)?.value || 0);
    const verba = parseFloat(document.getElementById(`verba-${id}`)?.value || 0);
    const porcentagem = parseFloat(document.getElementById(`alt-${id}`)?.value || 0);
    
    const novoCustoLiq = custo - verba;
    const spanCustoLiq = document.getElementById(`custoliq-${id}`);
    if(spanCustoLiq) spanCustoLiq.innerText = `R$ ${novoCustoLiq.toFixed(2)}`;

    // Pega o markup original salvo no banco para o item
    const produto = produtos.find(p => p.sku === id);
    const markupDoBanco = parseFloat(produto?.markup_base) || markupFix;

    // Lógica da variação
    let markupAtual;
    if (porcentagem !== 0) {
        const variacaoDecimal = porcentagem / 100;
        const divisor = 1 - variacaoDecimal;
        markupAtual = divisor !== 0 ? (markupFix / divisor) : markupFix;
    } else {
        markupAtual = markupDoBanco; // Se variação for 0, mantém o markup do Banco
    }

    const spanMarkup = document.getElementById(`markup-disp-${id}`);
    if (spanMarkup) {
        spanMarkup.innerText = markupAtual.toFixed(4);
        if (porcentagem !== 0) {
            spanMarkup.classList.add('bg-orange-100', 'text-orange-700');
            spanMarkup.classList.remove('bg-blue-50', 'text-blue-700');
        } else {
            spanMarkup.classList.add('bg-blue-50', 'text-blue-700');
            spanMarkup.classList.remove('bg-orange-100', 'text-orange-700');
        }
    }

    const novoPreco = novoCustoLiq * markupAtual;
    const colPreco = document.getElementById(`sugestao-${id}`);
    
    if (colPreco) {
        // Se porcentagem for zero e tiver valor forçado (Preço BD inicial), exibe ele
        const exibir = valorForcado !== null && porcentagem === 0 ? valorForcado : novoPreco;
        colPreco.innerHTML = `R$ ${exibir.toFixed(2)}`;
        
        const custoOriginal = parseFloat(produto?.custos?.custo || produto?.custo || 0);
        if (porcentagem !== 0 || custo !== custoOriginal) {
            colPreco.classList.replace('text-indigo-700', 'text-orange-600');
        } else {
            colPreco.classList.replace('text-orange-600', 'text-indigo-700');
        }
    }
};

// ==========================================
// 4. ATUALIZAÇÕES EM LOTE PARA O SUPABASE
// ==========================================
document.getElementById('btn-subir-supabase')?.addEventListener('click', async () => {
    const confirmacao = confirm("Deseja salvar TODAS as alterações (importadas da planilha e digitadas na tela) no banco de dados?");
    if (!confirmacao) return;

    const markupBaseCalculado = calcularMarkupBaseFixa(); 
    const promessas = [];

    // 1. Atualiza o array de memória com qualquer alteração manual feita na tela neste instante
    const linhasVisiveis = document.querySelectorAll('#corpo-tabela-admin tr');
    linhasVisiveis.forEach(tr => {
        const id = tr.querySelector('td').innerText.trim(); 
        const custo = parseFloat(document.getElementById(`custo-${id}`)?.value || 0);
        const verba = parseFloat(document.getElementById(`verba-${id}`)?.value || 0);
        const variacao = parseFloat(document.getElementById(`alt-${id}`)?.value || 0);
        
        const variacaoDecimal = variacao / 100;
        const divisor = 1 - variacaoDecimal;
        const markupFinalBanco = divisor !== 0 ? (markupBaseCalculado / divisor) : markupBaseCalculado;

        const produtoDb = produtos.find(p => String(p.sku) === id);
        if (produtoDb) {
            if (!produtoDb.custos) produtoDb.custos = {};
            produtoDb.custos.custo = custo;
            produtoDb.custos.verba = verba;
            
            // Se o usuário digitou uma variação na tela, essa variação sobrepõe o markup
            if (variacao !== 0) {
                produtoDb.markup_base = markupFinalBanco;
            }
        }
    });

    // 2. Dispara as requisições de UPDATE para TODOS os produtos do array
    // Isso garante que os produtos carregados pelo CSV (mesmo os ocultos pelo filtro) sejam salvos
    produtos.forEach(p => {
        const id = String(p.sku);
        const custo = parseFloat(p.custos?.custo || 0);
        const verba = parseFloat(p.custos?.verba || 0);
        const mkFinal = parseFloat(p.markup_base) || markupBaseCalculado;

        promessas.push(
            supabase.from('produtos').update({ markup_base: mkFinal }).eq('sku', id)
        );
        promessas.push(
            supabase.from('custos').update({ custo: custo, verba: verba }).eq('sku', id)
        );
    });

    try {
        const btn = document.getElementById('btn-subir-supabase');
        btn.innerText = "Sincronizando...";
        btn.disabled = true;

        // Dispara todos os saves ao mesmo tempo
        await Promise.all(promessas);
        alert("Sucesso! Custo, Verba e Markup foram atualizados no banco de dados para todos os itens.");
        
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Salvar Alterações (BD)';
        btn.disabled = false;
        
        // Recarrega a tabela atualizada com os dados oficiais do banco
        carregarProdutosAdmin(); 
    } catch (error) {
        console.error("Erro na sincronização:", error);
        alert("Erro ao salvar alterações no Supabase.");
        const btn = document.getElementById('btn-subir-supabase');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Salvar Alterações (BD)';
            btn.disabled = false;
        }
    }
});

// Download CSV Original (Mantido)
document.getElementById('btn-baixar-csv')?.addEventListener('click', () => {
    let csvContent = "data:text/csv;charset=utf-8,SKU;PRECO_VENDA\n";
    const linhasVisiveis = document.querySelectorAll('#corpo-tabela-admin tr');
    
    linhasVisiveis.forEach(tr => {
        const id = tr.querySelector('td').innerText.trim();
        const strPreco = document.getElementById(`sugestao-${id}`).innerText.replace('R$', '').replace('(Banco)', '').trim();
        const precoNum = parseFloat(strPreco);
        csvContent += `${id};${precoNum.toFixed(2).replace('.', ',')}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `tabela_precos_climario_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Gatilho para abrir seletor de arquivos
document.getElementById('btn-importar-markup')?.addEventListener('click', () => {
    document.getElementById('input-csv-markup').click();
});

// --- NOVO: LÓGICA DE IMPORTAÇÃO VISUAL DA PLANILHA ---
document.getElementById('input-csv-markup')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        const linhas = text.split('\n');
        let countAtualizados = 0;

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            if (!linha) continue;

            const colunas = linha.split(';');
            if (colunas.length < 4) continue; // Pula linhas mal formatadas

            const sku = colunas[0].trim();
            
            // Função rápida para transformar "11634,66" em formato numérico legível "11634.66"
            const formatarNumero = (val) => parseFloat(String(val).replace(',', '.')) || 0;
            
            const custoCsv = formatarNumero(colunas[1]);
            const verbaCsv = formatarNumero(colunas[2]);
            const mkCsv = formatarNumero(colunas[3]);

            // Encontra o item no array principal e injeta os novos valores do CSV
            const produtoDb = produtos.find(p => String(p.sku) === sku);
            if (produtoDb) {
                if (!produtoDb.custos) produtoDb.custos = {};
                produtoDb.custos.custo = custoCsv;
                produtoDb.custos.verba = verbaCsv;
                produtoDb.markup_base = mkCsv;
                countAtualizados++;
            }
        }

        // Força a tabela a redesenhar a tela com os novos números do CSV
        renderizarTabelaAdmin();

        alert(`✅ Planilha lida com sucesso!\n\n${countAtualizados} itens foram atualizados na tela.\n\nRevise os valores de custo, verba e margem e clique em "Salvar Alterações (BD)" para confirmar a atualização.`);
        document.getElementById('input-csv-markup').value = ""; // Limpa a memória do input
    };
    reader.readAsText(file);
});

// Logout
document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "../login.html";
});