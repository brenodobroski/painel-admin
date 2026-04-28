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
    document.getElementById('modal-analise-evidencia-link').href = req.url_evidencia;

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

    window.cancelarReprovacao(); // Reseta os campos de negação ao abrir
    document.getElementById('modal-analise-solicitacao').classList.remove('hidden');
};

// Funções de Interface do Modal de Reprovação
window.abrirAreaReprovacao = function() {
    document.getElementById('botoes-acao-modal')?.classList.add('hidden');
    document.getElementById('area-reprovacao')?.classList.remove('hidden');
    document.getElementById('input-motivo-reprovacao')?.focus();
};

window.cancelarReprovacao = function() {
    document.getElementById('area-reprovacao')?.classList.add('hidden');
    document.getElementById('botoes-acao-modal')?.classList.remove('hidden');
    
    // Trava de segurança para impedir o erro "Cannot set properties of null"
    const inputMotivo = document.getElementById('input-motivo-reprovacao');
    if (inputMotivo) {
        inputMotivo.value = ''; 
    }
};

window.aprovarSolicitacao = async function() {
    if (!confirm("Confirmar APROVAÇÃO deste orçamento? O status mudará e o vendedor será liberado.")) return;
    await processarDecisao('aprovado');
};

window.confirmarReprovacaoJS = async function() {
    const motivoInput = document.getElementById('input-motivo-reprovacao');
    if (!motivoInput) {
        console.error("Campo de motivo não encontrado no HTML");
        return;
    }

    const motivoText = motivoInput.value.trim();
    if (!motivoText) {
        alert("O motivo da reprovação é obrigatório.");
        return;
    }
    
    console.log("Iniciando processo de reprovação...");
    await processarDecisao('reprovado', motivoText);
};

async function processarDecisao(novoStatus, motivo = null) {
    if (!solicitacaoAtivaId) {
        alert("Erro: Nenhuma solicitação ativa identificada.");
        return;
    }

    console.log(`Payload: Status=${novoStatus}, Motivo=${motivo}, ID=${solicitacaoAtivaId}`);

    try {
        // Forçamos o objeto de atualização com os nomes exatos das colunas (minúsculo)
        const { data, error } = await supabase
            .from('solicitacoes_orcamento')
            .update({ 
                status: String(novoStatus), 
                motivo_reprovacao: motivo 
            })
            .eq('id', solicitacaoAtivaId)
            .select(); // O select faz o banco retornar o que ele acabou de gravar

        if (error) throw error;

        console.log("Resposta confirmada do banco:", data);

        if (data && data.length > 0) {
            alert(`Sucesso! O orçamento agora está como: ${novoStatus.toUpperCase()}`);
            
            // Fecha o modal e limpa a tela
            const modal = document.getElementById('modal-analise-solicitacao');
            if (modal) modal.classList.add('hidden');
            
            // Recarrega a tabela para sumir com o item da lista de pendentes
            await carregarSolicitacoes();
        } else {
            console.warn("O banco não retornou erro, mas nenhuma linha foi alterada. Verifique o ID.");
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

// Filtros Interativos
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
        const precoBD = parseFloat(item.preco || item.PREÇO || 0);
        const novoCusto = custo - verba;

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
                <span id="markup-disp-${id}" class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-black">${markupBaseCalculado.toFixed(4)}</span>
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

// Engenharia Reversa para Preencher % de Alteração
document.getElementById('btn-atualizar-variacoes')?.addEventListener('click', () => {
    const markupBaseCalculado = calcularMarkupBaseFixa();

    produtos.forEach(item => {
        const id = item.sku;
        const inputAlt = document.getElementById(`alt-${id}`);
        
        // Trava de segurança para não tentar definir valor se o input não existir na tela
        if (inputAlt) {
            const markupSistema = parseFloat(item.markup_base) || markupBaseCalculado;
            
            // Impede divisão por zero se a base estiver corrompida
            const mkFinal = markupSistema > 0 ? markupSistema : markupBaseCalculado;

            const variacao = (1 - (markupBaseCalculado / mkFinal)) * 100;
            inputAlt.value = variacao.toFixed(2);
            
            recalcularLinha(id, markupBaseCalculado);
        }
    });
    
    alert("Variação calculada com sucesso! A % foi preenchida cruzando o markup do sistema com a base fixa.");
});

// Recalcula Custos Líquidos e Preços ao Digitar
window.recalcularLinha = function(id, markupFix, valorForcado = null) {
    const custo = parseFloat(document.getElementById(`custo-${id}`)?.value || 0);
    const verba = parseFloat(document.getElementById(`verba-${id}`)?.value || 0);
    const porcentagem = parseFloat(document.getElementById(`alt-${id}`)?.value || 0);
    
    const novoCustoLiq = custo - verba;
    const spanCustoLiq = document.getElementById(`custoliq-${id}`);
    if(spanCustoLiq) spanCustoLiq.innerText = `R$ ${novoCustoLiq.toFixed(2)}`;

    // Markup Flexível
    const variacaoDecimal = porcentagem / 100;
    const divisor = 1 - variacaoDecimal;
    const markupAtual = divisor !== 0 ? (markupFix / divisor) : markupFix;

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
        const exibir = valorForcado !== null && porcentagem === 0 ? valorForcado : novoPreco;
        colPreco.innerHTML = `R$ ${exibir.toFixed(2)}`;
        
        const custoOriginal = parseFloat(produtos.find(p=>p.sku===id)?.custos?.custo || produtos.find(p=>p.sku===id)?.custo || 0);
        if (porcentagem !== 0 || custo !== custoOriginal) {
            colPreco.classList.replace('text-indigo-700', 'text-orange-600');
        }
    }
};

// ==========================================
// 4. ATUALIZAÇÕES EM LOTE PARA O SUPABASE
// ==========================================
document.getElementById('btn-subir-supabase')?.addEventListener('click', async () => {
    const confirmacao = confirm("Deseja salvar o Custo, Verba e o novo Markup Base de TODOS os itens filtrados? O preço final será calculado automaticamente pelo sistema do vendedor.");
    if (!confirmacao) return;

    const markupBaseCalculado = calcularMarkupBaseFixa(); 
    const promessas = [];

    const linhasVisiveis = document.querySelectorAll('#corpo-tabela-admin tr');
    
    linhasVisiveis.forEach(tr => {
        const id = tr.querySelector('td').innerText.trim(); 
        const custo = parseFloat(document.getElementById(`custo-${id}`)?.value || 0);
        const verba = parseFloat(document.getElementById(`verba-${id}`)?.value || 0);
        const variacao = parseFloat(document.getElementById(`alt-${id}`)?.value || 0);
        
        const variacaoDecimal = variacao / 100;
        const divisor = 1 - variacaoDecimal;
        const markupFinalBanco = divisor !== 0 ? (markupBaseCalculado / divisor) : markupBaseCalculado;

        promessas.push(
            supabase.from('produtos').update({ markup_base: markupFinalBanco }).eq('sku', id)
        );

        promessas.push(
            supabase.from('custos').update({ custo: custo, verba: verba }).eq('sku', id)
        );
    });

    try {
        const btn = document.getElementById('btn-subir-supabase');
        btn.innerText = "Sincronizando...";
        btn.disabled = true;

        await Promise.all(promessas);
        alert("Configurações salvas! Custo, Verba e Markup foram atualizados no banco de dados.");
        
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Salvar Alterações (BD)';
        btn.disabled = false;
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

// Download CSV e Upload
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

document.getElementById('btn-importar-markup')?.addEventListener('click', () => {
    document.getElementById('input-csv-markup').click();
});

document.getElementById('input-csv-markup')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        const linhas = text.split('\n');
        const updates = [];

        for (let i = 1; i < linhas.length; i++) {
            const linha = linhas[i].trim();
            if (!linha) continue;

            const colunas = linha.split(';');
            const sku = colunas[0].trim();
            const mkBaseRaw = colunas[1].replace(',', '.').trim();
            const mkBaseNum = parseFloat(mkBaseRaw);

            if (sku && !isNaN(mkBaseNum)) {
                updates.push({ sku, markup_base: mkBaseNum });
            }
        }

        if (updates.length > 0) {
            confirmarESubir(updates);
        }
    };
    reader.readAsText(file);
});

async function confirmarESubir(dados) {
    if (!confirm(`Detectamos ${dados.length} SKUs para atualizar. Deseja prosseguir?`)) return;

    const btn = document.getElementById('btn-importar-markup');
    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        const { error } = await supabase
            .from('produtos')
            .upsert(dados, { onConflict: 'sku' });

        if (error) throw error;

        alert("Markups atualizados com sucesso!");
        carregarProdutosAdmin(); 
    } catch (error) {
        console.error("Erro na importação:", error.message);
        alert("Erro ao importar: " + error.message);
    } finally {
        btn.innerHTML = '<i class="fas fa-file-import"></i> Importar Planilha Markup';
        btn.disabled = false;
        document.getElementById('input-csv-markup').value = ""; 
    }
}

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "../login.html";
});