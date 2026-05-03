console.log("🚀 O script admin.js foi carregado com sucesso!");

// 1. Importação e Configuração do Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ijkzolhxuuqmkuztdliv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqa3pvbGh4dXVxbWt1enRkbGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE1NTgsImV4cCI6MjA5Mjc5NzU1OH0.37ihEUrCAUHpzOymrPUTau164DXmvhhWal8uX4V0oI0'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let produtos = [];
let todosOrcamentos = [];
let solicitacoesPendentes = [];
let solicitacaoAtivaId = null;

// Variáveis de Filtro (Produtos)
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

    try {
        // Puxa o nome e email direto da sessão logada
        const nomeUsuario = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        
        // Atualiza os elementos visuais no painel
        const elNome = document.getElementById('perfil-nome');
        const elEmail = document.getElementById('perfil-email');
        const elIniciais = document.getElementById('perfil-iniciais');

        if (elNome) elNome.innerText = nomeUsuario;
        if (elEmail) elEmail.innerText = session.user.email;
        if (elIniciais) elIniciais.innerText = nomeUsuario.substring(0, 2).toUpperCase();

        // Checa no banco se a pessoa realmente é admin
        const { data: perfil, error } = await supabase
            .from('usuarios')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (error || !perfil || perfil.role !== 'admin') {
            alert("Acesso negado.");
            window.location.href = "../index.html";
        } else {
            window.roleUsuario = 'admin'; // Guarda a permissão globalmente
            carregarProdutosAdmin();
            carregarSolicitacoes();
        }
    } catch (err) {
        console.error("Erro ao verificar acesso admin:", err);
        window.location.href = "../login.html";
    }
}
verificarAcessoAdmin();

// ==========================================
// 2. MÓDULO DE APROVAÇÕES E HISTÓRICO
// ==========================================
let limiteAtualOrcamentos = 150; // Começa puxando apenas os 150 mais recentes

// Filtros da aba de Orçamentos
document.getElementById('filtro-busca-orcamento')?.addEventListener('input', renderizarTabelaAprovacoes);
document.getElementById('filtro-status-orcamento')?.addEventListener('change', renderizarTabelaAprovacoes);
document.getElementById('filtro-filial-orcamento')?.addEventListener('change', renderizarTabelaAprovacoes);
document.getElementById('filtro-marca-orcamento')?.addEventListener('change', renderizarTabelaAprovacoes);

async function carregarSolicitacoes() {
    try {
        const { data, error } = await supabase
            .from('solicitacoes_orcamento')
            .select('id, created_at, vendedor_email, filial, valor_alvo, desconto_solicitado, status, codigo_orcamento, pagamento, rt, motivo, url_evidencia, itens, marca:snapshot->>marcaNome')
            .order('created_at', { ascending: false })
            .limit(limiteAtualOrcamentos); // OTIMIZAÇÃO: Trava o download para não estourar a banda!

        if (error) throw error;

        todosOrcamentos = data || [];
        solicitacoesPendentes = todosOrcamentos.filter(req => req.status === 'pendente');
        
        renderizarTabelaAprovacoes();
        atualizarBadge(solicitacoesPendentes.length);

        // Lógica para esconder o botão se chegarmos no final do banco de dados
        const btnMais = document.getElementById('btn-carregar-mais');
        if (btnMais) {
            if (data.length < limiteAtualOrcamentos) {
                btnMais.classList.add('hidden'); // Acabaram os orçamentos no banco
            } else {
                btnMais.classList.remove('hidden');
            }
        }

    } catch (err) {
        console.error("Erro ao carregar solicitações:", err);
    }
}

window.carregarMaisSolicitacoes = async function() {
    const btn = document.getElementById('btn-carregar-mais');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        btn.disabled = true;
    }
    
    // Aumenta o limite em mais 150 e vai buscar de novo
    limiteAtualOrcamentos += 150; 
    await carregarSolicitacoes();
    
    if (btn) {
        btn.innerHTML = '<i class="fas fa-chevron-down"></i> Carregar Mais Antigos';
        btn.disabled = false;
    }
};

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

function renderizarTabelaAprovacoes() {
    const corpo = document.getElementById('corpo-aprovacoes');
    if (!corpo) return;
    corpo.innerHTML = '';

    const termoBusca = (document.getElementById('filtro-busca-orcamento')?.value || "").toLowerCase();
    const filtroStatus = document.getElementById('filtro-status-orcamento')?.value || "";
    const filtroFilial = document.getElementById('filtro-filial-orcamento')?.value || "";
    const filtroMarcaOrcamento = document.getElementById('filtro-marca-orcamento')?.value || "";

    const orcamentosFiltrados = todosOrcamentos.filter(req => {
        const matchBusca = (req.vendedor_email?.toLowerCase() || "").includes(termoBusca) || 
                           (req.codigo_orcamento || "").toLowerCase().includes(termoBusca);
        const matchStatus = filtroStatus === "" || req.status === filtroStatus;
        const matchFilial = filtroFilial === "" || String(req.filial) === filtroFilial;
        
        // OTIMIZAÇÃO: Agora lemos direto da coluna virtual que extraímos no select
        const marcaBD = (req.marca || "").toUpperCase();
        const matchMarca = filtroMarcaOrcamento === "" || marcaBD.includes(filtroMarcaOrcamento);

        return matchBusca && matchStatus && matchFilial && matchMarca;
    });

    if (orcamentosFiltrados.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500 italic">Nenhum orçamento encontrado.</td></tr>`;
        return;
    }

    orcamentosFiltrados.forEach(req => {
        const dataFormatada = new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        let statusHtml = '';
        let acaoHtml = '<div class="flex flex-col gap-1">';

        const btnAvaliar = `<button onclick="abrirModalAnaliseJS('${req.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm w-full"><i class="fas fa-search mr-1"></i> Avaliar</button>`;
        const btnDetalhes = `<button onclick="abrirModalAnaliseJS('${req.id}')" class="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-sm w-full"><i class="fas fa-eye mr-1"></i> Detalhes</button>`;

        if (req.status === 'aprovado') {
            statusHtml = `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Aprovado</span>`;
            acaoHtml += btnDetalhes;
        } else if (req.status === 'reprovado') {
            statusHtml = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Reprovado</span>`;
            acaoHtml += btnDetalhes;
        } else {
            statusHtml = `<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Pendente</span>`;
            acaoHtml += btnAvaliar;
        }
        
        acaoHtml += '</div>';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";
        tr.innerHTML = `
            <td class="p-4 text-xs font-mono text-slate-500">${dataFormatada}</td>
            <td class="p-4">
                <p class="font-black text-slate-800 text-xs mb-1">#${req.codigo_orcamento || "---"}</p>
                <p class="font-bold text-slate-600 text-xs">${req.vendedor_email}</p>
                <p class="text-[10px] text-slate-400 uppercase">Filial ${req.filial} | ${req.marca || "---"}</p>
            </td>
            <td class="p-4 text-right font-black text-indigo-700">R$ ${parseFloat(req.valor_alvo).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td class="p-4 text-center font-bold text-orange-600">${parseFloat(req.desconto_solicitado).toFixed(2)}%</td>
            <td class="p-4 text-center">${statusHtml}</td>
            <td class="p-4 text-center w-28">${acaoHtml}</td>
        `;
        corpo.appendChild(tr);
    });
}

window.abrirOrcamentoPDFAdmin = async function(id) {
    document.body.style.cursor = 'wait';
    try {
        // OTIMIZAÇÃO: Admin também baixa o snapshot pesado sob demanda
        const { data, error } = await supabase
            .from('solicitacoes_orcamento')
            .select('snapshot')
            .eq('id', id)
            .single();

        if (error || !data || !data.snapshot) {
            alert("Erro: O snapshot deste orçamento não foi encontrado.");
            return;
        }
        sessionStorage.setItem('orcamentoDados', JSON.stringify(data.snapshot));
        window.open('../orcamento.html', '_blank');
        auditarDownload(`Admin: Download Snapshot PDF #${id.substring(0,4)}`, data);
    } catch (err) {
        alert("Erro ao abrir PDF.");
    } finally {
        document.body.style.cursor = 'default';
    }
}

window.abrirModalAnaliseJS = function(id) {
    const req = todosOrcamentos.find(s => s.id === id);
    if (!req) return;

    solicitacaoAtivaId = id; 

    document.getElementById('modal-analise-id').innerText = `ID: #${req.codigo_orcamento || req.id.split('-')[0]}`;
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

    if (req.url_evidencia && String(req.url_evidencia).trim() !== '' && String(req.url_evidencia) !== 'null') {
        // Removemos o href direto para evitar que o navegador abra sozinho
        linkEvidencia.href = "#"; 
        linkEvidencia.onclick = (e) => {
            e.preventDefault(); // Impede a página de rolar para o topo
            abrirEvidenciaSegura(req.url_evidencia);
        };
        
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

    const botoesAcao = document.getElementById('botoes-acao-modal');
    const btnPdf = document.getElementById('btn-modal-ver-pdf');

    // Inteligência dos botões do modal baseada no status do orçamento
    if (req.status === 'pendente') {
        if (botoesAcao) botoesAcao.classList.remove('hidden');
        if (btnPdf) btnPdf.classList.add('hidden');
    } else if (req.status === 'aprovado') {
        if (botoesAcao) botoesAcao.classList.add('hidden');
        if (btnPdf) btnPdf.classList.remove('hidden'); // Libera o PDF apenas se aprovado
    } else { // status: reprovado
        if (botoesAcao) botoesAcao.classList.add('hidden');
        if (btnPdf) btnPdf.classList.add('hidden'); // Oculta o PDF se negado
    }

    window.cancelarReprovacao(); 
    document.getElementById('modal-analise-solicitacao').classList.remove('hidden');
}; // Fim da função abrirModalAnaliseJS

// NOVO: Função chamada pelo botão "Ver PDF" dentro do modal
window.abrirPdfAtivo = function() {
    if (solicitacaoAtivaId) {
        abrirOrcamentoPDFAdmin(solicitacaoAtivaId);
    }
};

window.abrirAreaReprovacao = function() {
    document.getElementById('botoes-acao-modal')?.classList.add('hidden');
    document.getElementById('area-reprovacao')?.classList.remove('hidden');
    document.getElementById('input-motivo-reprovacao')?.focus();
};

window.cancelarReprovacao = function() {
    document.getElementById('area-reprovacao')?.classList.add('hidden');
    const botoesAcao = document.getElementById('botoes-acao-modal');
    if(botoesAcao && solicitacoesPendentes.find(s => s.id === solicitacaoAtivaId)) {
        botoesAcao.classList.remove('hidden');
    }
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

        auditarDownload('Admin: Lista de Orçamentos (Tabela)', data);

    } catch (err) {
        console.error("Erro técnico na atualização:", err);
        alert("Falha ao salvar no banco: " + err.message);
    }
}

// ==========================================
// 3. MÓDULO DE GESTÃO DE PRODUTOS E PRECIFICAÇÃO
// ==========================================
async function carregarProdutosAdmin(forcarBaixar = false) {
    try {
        // 1. Checa a versão atual na nuvem (Requisição minúscula, super rápida)
        const { data: config } = await supabase.from('configuracoes').select('valor').eq('chave', 'versao_catalogo').single();
        const versaoOficial = config ? config.valor : '1';

        // 2. Procura no "Cofre VIP" do Admin (que contém os custos, diferente do vendedor)
        const cache = localStorage.getItem('climario_catalogo_admin');
        const versaoLocal = localStorage.getItem('climario_versao_admin');

        // 3. Se a versão estiver igual, carrega da memória RAM!
        if (!forcarBaixar && cache && versaoLocal === versaoOficial) {
            produtos = JSON.parse(cache);
            console.log(`📦 Catálogo ADMIN carregado da MEMÓRIA (Versão ${versaoLocal}).`);
            renderizarTabelaAdmin();
            return;
        }

        console.log("☁️ Versão desatualizada. Baixando catálogo COMPLETO do Supabase...");

        // 4. Se estiver desatualizado, baixa pesado do banco
        const { data, error } = await supabase
            .from('produtos')
            .select(`*, custos (custo, verba)`);

        if (error) throw error;

        if (data && data.length > 0) {
            produtos = data;
            
            // Tranca no cofre VIP para o próximo F5
            localStorage.setItem('climario_catalogo_admin', JSON.stringify(produtos));
            localStorage.setItem('climario_versao_admin', versaoOficial);
            
            renderizarTabelaAdmin();
        }

        auditarDownload('Admin: Catálogo de Produtos Completo', data);
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
        
        const markupLinha = parseFloat(item.markup_base) || markupBaseCalculado;
        
        // MATEMÁTICA REVERSA: Descobre a variação salva no Supabase
        let variacaoDB = 0;
        if (markupLinha > 0) {
            const calcVar = (1 - (markupBaseCalculado / markupLinha)) * 100;
            // Previne que diferenças milimétricas de arredondamento sujem a tela
            if (Math.abs(calcVar) > 0.001) {
                variacaoDB = calcVar;
            }
        }

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
                <input type="number" id="alt-${id}" value="${variacaoDB.toFixed(2)}" step="0.1"
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
    
    // CORREÇÃO DA MATEMÁTICA: O Markup Atual ignora o valor antigo do banco.
    // Se a variação é 0, ele assume cravado o Markup Fix (ex: 1.63920658)
    let markupAtual = markupFix;
    
    if (porcentagem !== 0) {
        const variacaoDecimal = porcentagem / 100;
        const divisor = 1 - variacaoDecimal;
        markupAtual = divisor !== 0 ? (markupFix / divisor) : markupFix;
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
        // valorForcado só é usado quando a página acabou de carregar
        const exibir = valorForcado !== null ? valorForcado : novoPreco;
        colPreco.innerHTML = `R$ ${exibir.toFixed(2)}`;
                 
        const produto = produtos.find(p => String(p.sku) === String(id));
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

    promessas.push(
        supabase.from('configuracoes').update({ valor: new Date().getTime().toString() }).eq('chave', 'versao_catalogo')
    );

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
            
            if (variacao !== 0) {
                produtoDb.markup_base = markupFinalBanco;
            }
        }
    });

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

        await Promise.all(promessas);

        alert("Sucesso! Custo, Verba e Markup foram atualizados no banco de dados para todos os itens.");
        
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Salvar Alterações (BD)';
        btn.disabled = false;
        
        // Força a baixar a tabela recém-salva do banco para atualizar o cofre
        carregarProdutosAdmin(true);
    } catch (error) {
        console.error("Erro na sincronização:", error);
        alert("Erro ao salvar alterações no Supabase.");
        const btn = document.getElementById('btn-subir-supabase');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Salvar Alterações (BD)';
            btn.disabled = false;
        }
    }

    document.getElementById('btn-forcar-update')?.addEventListener('click', async () => {
    const confirmacao = confirm("Isso forçará TODOS os vendedores a baixarem o catálogo de produtos silenciosamente nos próximos 60 segundos. Tem certeza?");
    if (!confirmacao) return;

    try {
        await supabase.from('configuracoes').update({ valor: new Date().getTime().toString() }).eq('chave', 'versao_catalogo');
        alert("📡 Sinal de atualização global enviado para todos os dispositivos!");
        
        // Atualiza o seu cofre de admin também
        carregarProdutosAdmin(true);
    } catch (error) {
        alert("Erro ao enviar o sinal global.");
    }
});
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

// --- LÓGICA DE IMPORTAÇÃO VISUAL DA PLANILHA ---
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
            if (colunas.length < 4) continue; 

            const sku = colunas[0].trim();
            
            const formatarNumero = (val) => parseFloat(String(val).replace(',', '.')) || 0;
            
            const custoCsv = formatarNumero(colunas[1]);
            const verbaCsv = formatarNumero(colunas[2]);
            const mkCsv = formatarNumero(colunas[3]);

            const produtoDb = produtos.find(p => String(p.sku) === sku);
            if (produtoDb) {
                if (!produtoDb.custos) produtoDb.custos = {};
                produtoDb.custos.custo = custoCsv;
                produtoDb.custos.verba = verbaCsv;
                produtoDb.markup_base = mkCsv;
                countAtualizados++;
            }
        }

        renderizarTabelaAdmin();

        alert(`✅ Planilha lida com sucesso!\n\n${countAtualizados} itens foram atualizados na tela.\n\nRevise os valores de custo, verba e margem e clique em "Salvar Alterações (BD)" para confirmar a atualização.`);
        document.getElementById('input-csv-markup').value = ""; 
    };
    reader.readAsText(file);
});

// Logout
document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "../login.html";
});

function auditarDownload(nomeRequisicao, dataResult) {
    if (!dataResult) return;
    
    // Calcula o peso exato do JSON baixado em bytes
    const bytes = new Blob([JSON.stringify(dataResult)]).size;
    let tamanho = '';
    
    if (bytes > 1024 * 1024) {
        tamanho = (bytes / (1024 * 1024)).toFixed(2) + ' MB 🚨 (ALERTA DE PESO)';
    } else {
        tamanho = (bytes / 1024).toFixed(2) + ' KB 🟢';
    }

    console.log(`📊 [API Supabase] ${nomeRequisicao}: Baixou ${tamanho}`);
}

// ==========================================
// 5. SIMULADOR DE ORÇAMENTOS (ADMIN - MODO DEUS)
// ==========================================

const familiasConfig = {
    "COND BI SAMSUNG 18K": ["29753"], "COND TRI SAMSUNG 24K": ["29754"], "COND QUADRI SAMSUNG 28K": ["29755"], "COND PENTA SAMSUNG 34K": ["42326", "29764"], "COND PENTA SAMSUNG 48K": ["42325", "29765"], "EVAP HW SAMSUNG 7K": ["33872", "29756"], "EVAP HW  SAMSUNG 9K": ["34076", "29752"], "EVAP HW SAMSUNG 12K": ["33806", "34445"], "EVAP HW SAMSUNG 18K": ["34078"], "EVAP HW SAMSUNG 24K": ["34077", "29760"], "EVAP HW SAMSUNG BLACK 9K": ["44612"], "EVAP HW SAMSUNG BLACK 12K": ["44613"], "EVAP HW SAMSUNG BLACK 18K": ["44614"], "EVAP HW SAMSUNG BLACK 24K": ["44615"], "EVAP K7 4 VIAS SAMSUNG  9K": ["41851"], "EVAP K7 4 VIAS SAMSUNG 12K": ["41797"], "EVAP K7 4 VIAS SAMSUNG 18K": ["41796"], "GRELHA K7 4 VIAS SAMSUNG": ["17105"], "EVAP K7 1 VIA SAMSUNG 9K": ["44610", "29761", "47977"], "EVAP K7 1 VIA SAMSUNG 12K": ["43406","44611", "29762"], "EVAP K7 1 VIA SAMSUNG 18K": ["47978", "29763", "42647"], "EVAP K7 1 VIA SAMSUNG 24K": ["43408", "42328"], "SAMSUNG GRELHA K7 1 VIA 9 A 12K": ["14407"], "SAMSUNG GRELHA K7 1 VIA 18 A 24K": ["16506"], "SAMSUNG CONTROLE SEM FIO": ["14412"], "SAMSUNG KIT WI-FI": ["21843"], "SAMSUNG PLACA DE INTERFACE HW": ["29767"],
    "COND BI LG 18K": ["43180", "29973", "15468"], "COND BI LG 21K FRIO": ["48758"], "COND TRI LG 21K": ["43182", "30310"], "COND TRI LG 24K": ["43632", "24415"], "COND TRI LG 24K FRIO": ["48761"], "COND QUADRI LG 30K": ["43631", "15467"], "COND QUADRI LG 30K FRIO": ["48762"], "COND QUADRI LG 36K FRIO": ["48764"], "COND PENTA LG 36K": ["43679", "15472"], "COND PENTA LG 48K": ["43680", "23774"], "COND PENTA LG 48K FRIO": ["48765"], "COND PENTA LG 54K FRIO": ["48763"], "EVAP HW LG 7K": ["43638", "32215"], "EVAP HW LG 9K": ["43224", "15466"], "EVAP HW LG 12K": ["43681", "32246"], "EVAP HW LG 18K": ["43226", "32260"], "EVAP HW LG 24K": ["43227", "32267"], "EVAP HW ARTCOOL LG 7K": ["32251"], "EVAP HW ARTCOOL LG 9K": ["32214"], "EVAP HW ARTCOOL LG 12K": ["32208"], "EVAP HW ARTCOOL LG 18K": ["34399"], "EVAP HW ARTCOOL LG 24K": ["35667"], "EVAP PAINEL GALLERY LG  9K": ["20789"], "EVAP PAINEL GALLERY LG  12K": ["20788"], "EVAP K7 4 VIAS LG  9K": ["18517"], "EVAP K7 4 VIAS LG  12K": ["17465"], "EVAP K7 4 VIAS LG 18K": ["49980"], "EVAP K7 4 VIAS LG 24K": ["49981", "43244"], "GRELHA K7 4 VIAS LG 9 A 12K": ["30405"], "GRELHA K7 4 VIAS LG 18 A 24K": ["42443"], "EVAP K7 1 VIA LG 7K": ["48445"], "EVAP K7 1 VIA LG 9K": ["17591"], "EVAP K7 1 VIA LG 12K": ["17590"], "EVAP K7 1 VIA LG 18K": ["23773"], "EVAP K7 1 VIA LG 24K": ["30327"],
    "LG BI 16K FRIO": ["33175"], "LG HW 9K FRIO": ["33176"], "LG HW 12K FRIO": ["33177"],
    "COND BI DAIKIN 18K": ["24540"], "COND TRI DAIKIN 18K": ["26426"], "COND TRI DAIKIN 24K": ["24542"], "COND QUADRI DAIKIN 28K": ["24544"], "COND QUADRI DAIKIN 34K": ["24546"], "COND PENTA DAIKIN 38K": ["5836"], "EVAP HW DAIKIN 9K": ["30312"], "EVAP HW DAIKIN 12K": ["26429"], "EVAP HW DAIKIN 18K": ["23647"], "EVAP HW DAIKIN 20K": ["33390"], "EVAP HW DAIKIN 24K": ["27177"], "EVAP K7 4 VIAS DAIKIN 9K": ["5844"], "EVAP K7 4 VIAS DAIKIN 12K": ["5845"], "EVAP K7 4 VIAS DAIKIN 17K": ["5846"], "EVAP K7 4 VIAS DAIKIN 20K": ["5847"], "GRELHA K7 4 VIA DAIKIN ": ["7443"], "EVAP K7 1 VIA DAIKIN 9K": ["10178"], "EVAP K7 1 VIA DAIKIN 12K": ["10179"], "EVAP K7 1 VIA DAIKIN 18K": ["10180"], "GRELHA K7 1 VIA DAIKIN ": ["10181"], "EVAP BUILT IN DAIKIN 9K": ["5840"], "EVAP BUILT IN DAIKIN 12K": ["5841"], "EVAP BUILT IN DAIKIN 18K": ["5842"], "EVAPBUILT IN DAIKIN 21K": ["5843"], "DAIKIN CONTROLE SEM FIO": ["5849"],
    "COND BI DAIKIN  18K R32": ["30456"], "EVAP HW DAIKIN 9K R32 - BI": ["30457"], "EVAP HW DAIKIN 12K R32 - BI": ["30458"],
    "COND TRI DAIKIN 18K R32 FRIO": ["33087"], "EVAP HW DAIKIN 9K R32 - TRI": ["33085"], "EVAP HW DAIKIN 12K R32 - TRI": ["33086"],
    "COND BI MIDEA 18K": ["35269"], "COND TRI MIDEA 27K": ["33117"], "COND QUADRI MIDEA 36K": ["33118"], "COND PENTA MIDEA 42K": ["32510"], "EVAP HW MIDEA 9K": ["48165", "33250"], "EVAP HW MIDEA 12K": ["33251", "48171"], "EVAP HW  MIDEA 18K": ["48721", "35699"], "EVAP HW MIDEA 24K": ["35700", "48173"], "EVAP HW MIDEA BLACK 9K": ["33988"], "EVAP HW MIDEA BLACK 12K": ["33984"], "EVAP HW MIDEA BLACK 18K": ["33985"], "EVAP HW MIDEA BLACK 24K": ["33986"], "EVAP K7 1 VIA MIDEA 12K": ["35850"], "EVAP K7 1 VIA MIDEA 18K": ["35852"], "GRELHA K7 1 VIA MIDEA 12K": ["35857"], "GRELHA K7 1 VIA MIDEA 18K": ["35858"], "EVAP BUILT IN MIDEA 9K": ["22093"], "EVAP BUILT IN MIDEA 12K": ["22094"],
    "COND BI ELGIN 18K": ["41232"], "COND TRI ELGIN 27K": ["41235"], "EVAP HW ELGIN 9K": ["41230"], "EVAP HW ELGIN 12K": ["41231"], "EVAP HW ELGIN 18K": ["48623"],
    "COND BI GREE 18K": ["34545"], "COND TRI GREE 24K": ["34515"], "COND TRI GREE 30K": ["34501"], "COND QUADRI GREE 36K": ["34502"], "COND PENTA GREE 42K": ["34518"], "COND PENTA GREE 48K": ["34519"], "EVAP HW GREE 9K": ["34541"], "EVAP HW GREE 12K": ["34543"], "EVAP HW GREE 18K": ["34540"], "EVAP HW GREE 24K": ["34544"], "EVAP HW GREE DIAMOND 9K": ["41426"], "EVAP HW GREE DIAMOND 12K": ["41423"], "EVAP HW GREE DIAMOND 18K": ["41424"], "EVAP HW GREE DIAMOND 24K": ["41421"], "EVAP K7 1 VIA GREE 9K": ["34513"], "EVAP K7 1 VIA GREE 12K": ["34514"], "EVAP K7 1 VIA GREE 18K": ["34496"], "EVAP K7 1 VIA GREE 24K": ["34492"], "GRELHA K7 1 VIA GREE": ["34499"],
    "COND BI FUJITSU 18K": ["10548"], "COND TRI FUJITSU 18K": ["10549"], "COND TRI FUJITSU 24K": ["10555"], "COND QUADRI FUJITSU 30K": ["10556"], "COND QUADRI FUJITSU 36K": ["10557"], "COND HEXA FUJITSU 45K": ["10561"], "EVAP HW FUJITSU 7K": ["10581"], "EVAP HW FUJITSU 9K": ["10567"], "EVAP HW FUJITSU 12K": ["10571"], "EVAP HW FUJITSU 18K": ["10582"], "EVAP HW FUJITSU 24K": ["10562"], "EVAP PISO FUJITSU 12K": ["7034"], "EVAP K7 4 VIAS FUJITSU 9K": ["10576"], "EVAP K7 4 VIAS FUJITSU 12K": ["10577"], "EVAP K7 4 VIAS FUJITSU 18K": ["10578"], "GRELHA K7 4 VIAS FUJITSU": ["10579"], "EVAP BUILT IN FUJITSU 12K": ["10564"], "EVAP BUILT IN FUJITSU 18K": ["10565"]
};
const regrasAcessorios = { "41851": ["17105" , "14412"], "41797": ["17105" , "14412"], "41796": ["17105" , "14412"], "44610": ["14407" , "14412"], "29761": ["14407" , "14412"], "47977": ["14407" , "14412"], "44611": ["14407" , "14412"], "43406": ["14407" , "14412"], "29762": ["14407" , "14412"], "47978": ["16506" , "14412"], "42647": ["16506" , "14412"], "29763": ["16506" , "14412"], "43408": ["16506" , "14412"], "42328": ["16506" , "14412"], "18517": ["30405"], "17465": ["30405"], "43244": ["42443"], "5844": ["7443", "5849"], "5845": ["7443", "5849"], "5846": ["7443", "5849"], "5847": ["7443", "5849"], "10178": ["10181"], "10179": ["10181"], "10180": ["10181"], "35850": ["35857"], "35852": ["35858"], "34513": ["34499"], "34514": ["34499"], "34496": ["34499"], "34492": ["34499"], "10576": ["10579"], "10577": ["10579"], "10578": ["10579"] };

window.dadosParaOrcamentoAdmin = {};
let timerCalculoAdmin = null;

// --- A FUNÇÃO QUE FALTAVA ---
// Esta função puxa o preço de 1 unidade para popular a tabela visualmente
async function buscarPrecosBaseTabelaAdmin(skusParaBuscar) {
    if(!skusParaBuscar || skusParaBuscar.length === 0) return;
    
    const descontoBase = parseFloat(document.getElementById('input-desconto').value) || 0;
    const rt = parseFloat(document.getElementById('input-rt').value) || 0;
    const penalidadePagto = parseFloat(document.getElementById('select-pagamento').value) || 0;
    
    const pseudoCarrinho = skusParaBuscar.map(sku => ({ sku: sku, qtd: 1 }));

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    try {
        const resposta = await fetch('/api/calcular', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` // 🔒 Envia o crachá
            },
            body: JSON.stringify({ 
                itens: pseudoCarrinho, 
                descontoBase, 
                rt, 
                penalidadePagto, 
                versaoCatalogo: "ADMIN_BYPASS" + (localStorage.getItem('climario_versao_admin') || '1')
            })
        });
        
        const dados = await resposta.json();
        
        if (dados.sucesso) {
            skusParaBuscar.forEach(sku => {
                const inputElement = document.querySelector(`.qtd-input[data-sku="${sku}"]`);
                if (inputElement) {
                    const tr = inputElement.closest('tr');
                    const tdPreco = tr.querySelector('.preco-col');
                    if (tdPreco && dados.precos[sku]) {
                        tdPreco.innerText = dados.precos[sku].precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    }
                }
            });
        }
    } catch (e) {
        console.error("Erro ao buscar preços base para a tabela admin:", e);
    }
}

// Lógica de Renderização de Tabela (Igual ao vendedor)
window.popularTabelaAdminSim = function(lista, corpoId, containerId) {
    const corpo = document.getElementById(corpoId);
    const container = document.getElementById(containerId);
    corpo.innerHTML = "";
    if (lista.length > 0) {
        container.classList.remove('hidden');
        const gruposParaRenderizar = [];
        const skusJaAgrupados = new Set();
        
        for (const [nomeFamilia, skusDaFamilia] of Object.entries(familiasConfig)) {
            const skusSeguros = skusDaFamilia.map(s => String(s).trim());
            const itensDestaFamilia = lista.filter(p => skusSeguros.includes(String(p.sku).trim()));
            if (itensDestaFamilia.length > 0) {
                itensDestaFamilia.sort((a, b) => skusSeguros.indexOf(String(a.sku).trim()) - skusSeguros.indexOf(String(b.sku).trim()));
                gruposParaRenderizar.push({ isFamilia: true, nome: nomeFamilia, itens: itensDestaFamilia });
                itensDestaFamilia.forEach(i => skusJaAgrupados.add(String(i.sku).trim()));
            }
        }
        
        lista.forEach(item => {
            const s = String(item.sku).trim();
            if (!skusJaAgrupados.has(s)) gruposParaRenderizar.push({ isFamilia: false, itens: [item] });
        });

        const skusParaAtualizarPreco = []; // Coleta de SKUs

        gruposParaRenderizar.forEach((grupo, index) => {
            const itemPrincipal = grupo.itens[0]; 
            const skuPrincipal = String(itemPrincipal.sku).trim();
            skusParaAtualizarPreco.push(skuPrincipal); // Adiciona na lista
            
            const nomeExibicaoTabela = grupo.isFamilia ? grupo.nome.toUpperCase() : (itemPrincipal.descricao || itemPrincipal.produto || "Item").toUpperCase();
            const idUnicoLinha = `${corpoId}-linha-${index}`;
            let htmlSKU = "";
            if (grupo.isFamilia && grupo.itens.length > 1) {
                htmlSKU = `<select class="w-[80px] bg-white border border-slate-300 rounded px-1 py-1 text-[11px] font-bold outline-none text-slate-800" onchange="atualizarLinhaTabelaAdmin(this, '${idUnicoLinha}')">`;
                grupo.itens.forEach(item => { htmlSKU += `<option value="${String(item.sku).trim()}">${String(item.sku).trim()}</option>`; });
                htmlSKU += `</select>`;
            } else {
                htmlSKU = `<span class="font-mono text-sm text-slate-900">${skuPrincipal}</span>`;
            }

            const linha = `
                <tr class="hover:bg-slate-50 transition-colors" id="${idUnicoLinha}">
                    <td class="border border-slate-200 px-2 py-2 text-center">
                        <input type="number" min="0" data-sku="${skuPrincipal}" onchange="atualizarResumo()" onkeyup="atualizarResumo()" class="qtd-input w-12 text-center border border-slate-200 outline-none focus:border-amber-500">
                    </td>
                    <td class="border border-slate-200 px-1 py-1 text-center font-bold">${htmlSKU}</td>
                    <td class="border border-slate-200 px-4 py-2 font-bold text-slate-900 text-sm">${nomeExibicaoTabela}</td>
                    <td class="border border-slate-200 px-4 py-2 text-center estoque-col text-sm font-bold">${itemPrincipal.estoque || 0}</td>
                    <td class="border border-slate-200 px-4 py-2 text-center font-bold text-amber-700 preco-col"><i class="fas fa-spinner fa-spin text-slate-300 text-[10px]"></i></td>
                </tr>`;
            corpo.innerHTML += linha;
        });
        
        buscarPrecosBaseTabelaAdmin(skusParaAtualizarPreco); // Dispara a busca!
        window.atualizarResumo(); 
    } else {
        container.classList.add('hidden');
    }
};

window.atualizarLinhaTabelaAdmin = function(selectElement, idLinha) {
    const sku = selectElement.value;
    const linha = document.getElementById(idLinha);
    const prod = produtos.find(p => String(p.sku).trim() === String(sku).trim());
    if (prod) {
        linha.querySelector('.qtd-input').setAttribute('data-sku', sku);
        linha.querySelector('.estoque-col').innerText = `${prod.estoque || 0}`;
        linha.querySelector('.preco-col').innerHTML = '<i class="fas fa-spinner fa-spin text-slate-300 text-[10px]"></i>';
        
        buscarPrecosBaseTabelaAdmin([sku]); // Busca o novo preço
        window.atualizarResumo();
    }
};

document.getElementById('marca-condensadora')?.addEventListener('change', function(){ // Ouvinte adaptado para o Dropdown Customizado
    let marcaEscolhida = this.value.toUpperCase();
    if(marcaEscolhida === ""){
        document.getElementById('container-tabela').classList.add("hidden");
        document.getElementById('container-tabela-evap').classList.add("hidden");
        document.getElementById('card-evaporadoras').classList.add("hidden");
        return;
    }
    document.getElementById('card-evaporadoras').classList.remove('hidden', 'opacity-50');
    const conds = produtos.filter(p => (p.tipo || p.TIPO || "").toUpperCase() === 'CONDENSADORA' && (p.marca || "").toUpperCase() === marcaEscolhida);
    const evaps = produtos.filter(p => {
        const t = (p.tipo || p.TIPO || "").toUpperCase();
        return (t === 'EVAPORADORA' || t === 'GRELHA' || t === 'CONTROLE') && (p.marca || "").toUpperCase() === marcaEscolhida;
    });
    popularTabelaAdminSim(conds, 'corpo-tabela', 'container-tabela');
    popularTabelaAdminSim(evaps, 'corpo-tabela-evap', 'container-tabela-evap');
});

window.atualizarResumo = function() {
    const inputsQtd = document.querySelectorAll('.qtd-input');
    const grelhasNecessarias = {};
    const todasGrelhas = Object.values(regrasAcessorios).flat();

    inputsQtd.forEach(input => {
        const qtd = parseInt(input.value) || 0;
        let skuAtual = input.getAttribute('data-sku');
        const select = input.closest('tr')?.querySelector('select');
        if (select && select.value) skuAtual = select.value;

        if (qtd > 0 && regrasAcessorios[skuAtual]) {
            regrasAcessorios[skuAtual].forEach(g => { grelhasNecessarias[g] = (grelhasNecessarias[g] || 0) + qtd; });
        }
    });

    inputsQtd.forEach(input => {
        let skuAtual = input.getAttribute('data-sku');
        const select = input.closest('tr')?.querySelector('select');
        if (select && select.value) skuAtual = select.value;
        if (todasGrelhas.includes(skuAtual)) input.value = grelhasNecessarias[skuAtual] || 0;
    });

    clearTimeout(timerCalculoAdmin);
    document.getElementById('resumo-total').classList.add('opacity-40');
    timerCalculoAdmin = setTimeout(executarCalculoAdminAPI, 250);
};

// O Ponto Chave: O Admin também usa a Cloudflare para manter a matemática 100% idêntica!
async function executarCalculoAdminAPI() {
    const descontoBase = parseFloat(document.getElementById('input-desconto').value) || 0;
    const rt = parseFloat(document.getElementById('input-rt').value) || 0;
    
    const penalidadePagto = parseFloat(document.getElementById('select-pagamento').value) || 0;
    const elTextoPagamento = document.getElementById('texto-select-pagamento');
    const txtPagto = elTextoPagamento ? elTextoPagamento.innerText.trim() : 'Á vista 100% antecipado (PIX)';

    const selectUf = document.getElementById('select-uf');
    const percentualFrete = parseFloat(selectUf.value) || 0;
    const txtUf = document.getElementById('texto-select-uf')?.innerText || 'SP';

    let carrinho = [];
    let totalBtuCond = 0; let totalBtuEvap = 0;
    let itensMapeados = [];

    document.querySelectorAll('.qtd-input').forEach(input => {
        const qtd = parseInt(input.value) || 0;
        const sku = input.getAttribute('data-sku');
        
        // Manda o SKU pra API independentemente da quantidade
        carrinho.push({ sku: sku, qtd: qtd });
        
        if (qtd > 0) {
            const p = produtos.find(x => String(x.sku) === sku);
            if (p) {
                const tipo = (p.tipo || p.TIPO || "").toUpperCase();
                const btu = parseInt(p.capacidade || p.CAPACIDADE) || 0;
                if (tipo.includes('CONDENSADORA')) totalBtuCond += (qtd * btu);
                else if (tipo.includes('EVAPORADORA')) totalBtuEvap += (qtd * btu);
                
                itensMapeados.push({
                    codigo: sku, descricao: p.descricao || p.produto,
                    modelo: p.codfab || p["codigo fabricante"] || "-",
                    qtd: qtd, estoque: p.estoque || 0
                });
            }
        }
    });

    if (carrinho.length === 0) {
        document.getElementById('lista-itens-resumo').innerHTML = '<p class="text-xs text-slate-500 italic">Nenhum item.</p>';
        document.getElementById('resumo-total').innerText = 'R$ 0,00';
        document.getElementById('resumo-total').classList.remove('opacity-40'); 
        document.getElementById('btn-finalizar-admin').disabled = true;
        document.getElementById('btn-finalizar-admin').className = "w-full bg-slate-300 text-slate-500 font-bold py-3 rounded-md uppercase text-xs cursor-not-allowed";
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert("Sessão expirada!");
        window.location.reload();
        return;
    }

    try {
        const resposta = await fetch('/api/calcular', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` // 🔒 Envia o crachá
            },
            body: JSON.stringify({ itens: carrinho, descontoBase, rt, penalidadePagto, versaoCatalogo: "ADMIN_BYPASS" }) 
        });
        
        const dadosAPI = await resposta.json();
        if (!dadosAPI.sucesso) throw new Error(dadosAPI.erro);

        // 1. ATUALIZA A TABELA VISUAL
        Object.keys(dadosAPI.precos).forEach(sku => {
            const infoPreco = dadosAPI.precos[sku];
            const inputQtd = document.querySelector(`.qtd-input[data-sku="${sku}"]`);
            if(inputQtd) {
                const tr = inputQtd.closest('tr');
                if(tr) {
                    const tdPreco = tr.querySelector('.preco-col');
                    if(tdPreco) tdPreco.innerText = infoPreco.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }
            }
        });

        // Se só rodou pra atualizar tabela e não tem carrinho, encerra.
        if (itensMapeados.length === 0) {
            document.getElementById('lista-itens-resumo').innerHTML = '<p class="text-xs text-slate-500 italic">Nenhum item.</p>';
            document.getElementById('resumo-subtotal').innerText = 'R$ 0,00';
            document.getElementById('resumo-frete').innerText = '+ R$ 0,00';
            document.getElementById('resumo-total').innerText = 'R$ 0,00';
            document.getElementById('resumo-total').classList.remove('opacity-40'); 
            document.getElementById('btn-finalizar-admin').disabled = true;
            document.getElementById('btn-finalizar-admin').className = "w-full bg-slate-300 text-slate-500 font-bold py-3 rounded-md uppercase text-xs cursor-not-allowed";
            return;
        }

        let itensHtml = "";
        let itensParaImpressao = [];

        itensMapeados.forEach(item => {
            const info = dadosAPI.precos[item.codigo];
            if (info) {
                item.valorUnitario = info.precoUnitario;
                item.subtotal = info.subtotal;
                itensParaImpressao.push(item);
                
                const td = document.querySelector(`.qtd-input[data-sku="${item.codigo}"]`)?.closest('tr')?.querySelector('.preco-col');
                if(td) td.innerText = info.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                itensHtml += `
                    <div class="flex justify-between items-start bg-slate-50 p-2 rounded border border-slate-100 mb-1">
                        <div class="flex flex-col flex-1">
                            <span class="text-[12px] font-bold text-slate-900">${item.descricao}</span>
                            <span class="text-[11px] text-slate-500">Qtd: ${item.qtd} x R$ ${info.precoUnitario.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                        </div>
                    </div>`;
            }
        });

        if (dadosAPI.descontoProtheus !== undefined) {
            itensHtml += `<div class="mt-4 p-3 bg-amber-50 border border-amber-200 text-center rounded"><span class="text-sm font-bold text-amber-900">Desc Protheus: ${dadosAPI.descontoProtheus.toFixed(1)}%</span></div>`;
        }

        const subtotal = dadosAPI.totalBruto || 0; 
        const valorFrete = subtotal * (percentualFrete / 100);
        const total = subtotal + valorFrete;
        let sim = totalBtuCond > 0 ? (totalBtuEvap / totalBtuCond) * 100 : 0;

        const date = new Date(); const val = new Date(); val.setDate(date.getDate() + 3);
        const marcaSel = document.getElementById('marca-condensadora').value || "";

        window.dadosParaOrcamentoAdmin = {
            codigoOrcamento: `ADM${Math.floor(1000 + Math.random() * 9000)}`,
            itens: itensParaImpressao, totalBruto: subtotal, totalGeral: total, valorFrete: valorFrete,
            percentualFrete: percentualFrete, percentualDesconto: descontoBase - rt - penalidadePagto, 
            ufDestino: txtUf, totalBtuCond: totalBtuCond, totalBtuEvap: totalBtuEvap, simultaneidade: sim,
            formaPagamento: txtPagto, dataEmissao: date.toLocaleDateString('pt-BR'), dataValidade: val.toLocaleDateString('pt-BR'),
            vendedor: "Administrador Climario", marcaNome: marcaSel, marcaLogo: marcaSel.split(' ')[0].toLowerCase(), filial: "MATRIZ"
        };

        document.getElementById('lista-itens-resumo').innerHTML = itensHtml;
        document.getElementById('resumo-subtotal').innerText = subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('resumo-frete').innerText = '+ ' + valorFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('resumo-total').innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('resumo-total').classList.remove('opacity-40');
        
        document.getElementById('resumo-btu-cond').innerText = totalBtuCond.toLocaleString('pt-BR') + ' BTU';
        document.getElementById('resumo-btu-evap').innerText = totalBtuEvap.toLocaleString('pt-BR') + ' BTU';
        document.getElementById('resumo-simultaneidade').innerText = sim.toFixed(1) + '%';

        const btnF = document.getElementById('btn-finalizar-admin');
        btnF.disabled = false;
        btnF.className = "w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded uppercase text-xs transition-colors shadow-md cursor-pointer";
        btnF.onclick = () => {
            sessionStorage.setItem('orcamentoDados', JSON.stringify(window.dadosParaOrcamentoAdmin));
            window.open('../orcamento.html', '_blank');
        };

        // Puxa os preços de toda a tabela visível em background para não ficar girando o ícone
        document.querySelectorAll('.qtd-input').forEach(i => {
            if(i.value == 0 || i.value === "") {
                 const s = i.getAttribute('data-sku');
                 if(dadosAPI.precos[s]) i.closest('tr').querySelector('.preco-col').innerText = dadosAPI.precos[s].precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            }
        });

    } catch (e) {
        document.getElementById('resumo-total').innerText = "Erro no Cálculo";
        document.getElementById('resumo-total').classList.remove('opacity-40');
    }
}

window.fazerTesteHipotese = function() {
    const alvo = parseFloat(document.getElementById('input-evidencia').value);
    if (!alvo || alvo <= 0) return alert("Valor inválido.");
    const totalAtual = window.dadosParaOrcamentoAdmin.totalGeral || 0;
    if (totalAtual === 0) return alert("Adicione itens.");
    
    const descAtual = parseFloat(document.getElementById('input-desconto').value) || 0;
    if (descAtual >= 100) return alert("Remova desconto de 100%.");
    
    const base = totalAtual / (1 - (descAtual / 100));
    let novo = (1 - (alvo / base)) * 100;
    if (novo < 0) novo = 0;
    
    document.getElementById('input-desconto').value = novo.toFixed(6);
    window.atualizarResumo();
};

window.abrirEvidenciaSegura = async function(url) {
    const btn = document.getElementById('modal-analise-evidencia-link');
    const textoOriginal = btn.innerHTML;
    
    try {
        // Muda o visual do botão temporariamente
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Pesando...';
        btn.classList.add('opacity-70', 'cursor-wait');

        // A Mágica: O método 'HEAD' baixa APENAS o cabeçalho do arquivo, e não o conteúdo!
        const resposta = await fetch(url, { method: 'HEAD' });
        const bytes = resposta.headers.get('content-length');

        btn.innerHTML = textoOriginal;
        btn.classList.remove('opacity-70', 'cursor-wait');

        // Se o Supabase devolver o tamanho com sucesso
        if (bytes) {
            const megabytes = (bytes / (1024 * 1024)).toFixed(2);
            
            // Se for maior que 2 MB, dispara o alerta de segurança
            if (megabytes > 3.00) {
                const confirmar = confirm(`⚠️ ALERTA DE DADOS ⚠️\n\nEste arquivo é pesado (${megabytes} MB).\nTem certeza que deseja gastar seus dados para abri-lo?`);
                if (!confirmar) return; // Se o admin cancelar, a função morre aqui e economiza os dados
            }
        }

        // Se for leve (imagens de 300kb) ou se o admin confirmar o aviso, abre a nova aba
        window.open(url, '_blank');

    } catch(e) {
        // Se a rede oscilar ou der erro no teste, volta o botão ao normal e abre direto por segurança
        btn.innerHTML = textoOriginal;
        btn.classList.remove('opacity-70', 'cursor-wait');
        window.open(url, '_blank');
    }
};