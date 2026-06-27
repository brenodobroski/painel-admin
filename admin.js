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
const formataMoeda = (valor) => {
    return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

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
            carregarFamilias();
            carregarSolicitacoes();
            iniciarMonitoramentoAdmin();
            solicitarPermissaoNotificacao();
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
let paginaAtualAprovacoes = 1;
const itensPorPagina = 15;
let totalOrcamentos = 0;

// Filtros com "Debounce" (evita metralhar o banco a cada tecla digitada)
let timerBuscaAdmin;
const aplicarFiltrosComAtraso = () => {
    clearTimeout(timerBuscaAdmin);
    timerBuscaAdmin = setTimeout(() => {
        paginaAtualAprovacoes = 1; // Resetamos a página ao filtrar
        carregarSolicitacoes(false); // false = Manda substituir a tela inteira
        iniciarMonitoramentoAdmin(); // <--- MÁGICA: Reinicia o Túnel com a regra da caixinha!
    }, 500);
};

document.getElementById('filtro-busca-orcamento')?.addEventListener('input', aplicarFiltrosComAtraso);
document.getElementById('filtro-filial-orcamento')?.addEventListener('input', aplicarFiltrosComAtraso);
document.getElementById('filtro-status-orcamento')?.addEventListener('change', aplicarFiltrosComAtraso);
document.getElementById('filtro-marca-orcamento')?.addEventListener('change', aplicarFiltrosComAtraso);
document.getElementById('filtro-ocultar-baixos')?.addEventListener('change', aplicarFiltrosComAtraso);
document.getElementById('filtro-ocultar-baixos')?.addEventListener('change', aplicarFiltrosComAtraso);
document.getElementById('filtro-com-evidencia')?.addEventListener('change', aplicarFiltrosComAtraso);

// Como não baixamos mais todos os dados de uma vez, fazemos uma consulta super leve só para contar os pendentes
async function atualizarBadgePendentes() {
    try {
        const ocultarDescontosBaixos = document.getElementById('filtro-ocultar-baixos')?.checked;
        
        let query = supabase
            .from('solicitacoes_orcamento')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pendente');
            
        // Faz o sininho ignorar os baixos se a caixinha estiver marcada
        if (ocultarDescontosBaixos) {
            query = query.gt('desconto_solicitado', 18);
        }
        
        const { count, error } = await query;
        if (!error) atualizarBadge(count || 0);
    } catch(err) { console.error("Erro no badge:", err); }
}
async function carregarSolicitacoes(isLoadMore = false) {
    try {
        const termoBusca = (document.getElementById('filtro-busca-orcamento')?.value || "").trim().toLowerCase();
        const filtroStatus = document.getElementById('filtro-status-orcamento')?.value || "";
        const filtroFilial = (document.getElementById('filtro-filial-orcamento')?.value || "").trim();
        const filtroMarca = document.getElementById('filtro-marca-orcamento')?.value || "";
        const ocultarDescontosBaixos = document.getElementById('filtro-ocultar-baixos')?.checked;
        const filtroEvidencia = document.getElementById('filtro-com-evidencia')?.checked;

       let query = supabase
            .from('solicitacoes_orcamento')
            .select('id, created_at, vendedor_email, filial, valor_alvo, desconto_solicitado, status, codigo_orcamento, pagamento, rt, motivo, url_evidencia, itens, snapshot', { count: 'exact' });

            if (filtroStatus) query = query.eq('status', filtroStatus);
        if (filtroFilial) query = query.ilike('filial', `%${filtroFilial}%`);
        if (filtroMarca) query = query.ilike('snapshot->>marcaNome', `%${filtroMarca}%`);
        if (ocultarDescontosBaixos) {
            query = query.gt('desconto_solicitado', 18);
        }
        if (filtroEvidencia) {
            query = query.not('url_evidencia', 'is', null).neq('url_evidencia', '').neq('url_evidencia', 'null');
        }
        
        if (termoBusca) {
            query = query.or(`vendedor_email.ilike.%${termoBusca}%,codigo_orcamento.ilike.%${termoBusca}%`);
        }

        // A MATEMÁTICA DA ECONOMIA: Pega APENAS o bloco de 15 itens
        const from = (paginaAtualAprovacoes - 1) * itensPorPagina;
        const to = from + itensPorPagina - 1;

        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        totalOrcamentos = count || 0;

        // Se o clique foi no "Carregar Mais", ele COLA os novos no final
        if (isLoadMore) {
            todosOrcamentos = todosOrcamentos.concat(data || []);
        } else {
            todosOrcamentos = data || []; // Se foi filtro, substitui a tela
        }

        renderizarTabelaAprovacoes();
        
        // Controla o botão Carregar Mais
        const btnMais = document.getElementById('btn-carregar-mais-admin');
        if (btnMais) {
            if (todosOrcamentos.length >= totalOrcamentos) btnMais.classList.add('hidden');
            else btnMais.classList.remove('hidden');
        }

        atualizarBadgePendentes(); 
        if (typeof auditarDownload === 'function') auditarDownload('SUPABASE', isLoadMore ? `Carregar Mais (Pág ${paginaAtualAprovacoes})` : 'Lista Orçamentos', data);
    } catch (err) {
        console.error("Erro ao carregar solicitações:", err);
    }
}

window.carregarMaisSolicitacoesAdmin = async function() {
    const btn = document.getElementById('btn-carregar-mais-admin');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Puxando...';
        btn.disabled = true;
    }
    
    paginaAtualAprovacoes++; 
    await carregarSolicitacoes(true); // true = Manda anexar os itens novos sem baixar tudo de novo
    
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

// A tabela não filtra mais no JavaScript, ela apenas imprime os 15 que o Supabase mandou
function renderizarTabelaAprovacoes() {
    const corpo = document.getElementById('corpo-aprovacoes');
    if (!corpo) return;
    corpo.innerHTML = '';

    if (todosOrcamentos.length === 0) {
        corpo.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500 italic">Nenhum orçamento encontrado.</td></tr>`;
        return;
    }

    todosOrcamentos.forEach(req => {
        const dt = new Date(req.created_at);
        const dataFormatada = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const horaFormatada = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const nomeVendedor = (req.vendedor_email || '').split('@')[0];

        let statusHtml = '';
        let acaoHtml = '<div class="flex flex-col gap-1">';
        const btnAvaliar = `<button onclick="abrirModalAnaliseJS('${req.id}')" class="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors w-full"><i class="fas fa-search mr-1"></i> Avaliar</button>`;
        const btnDetalhes = `<button onclick="abrirModalAnaliseJS('${req.id}')" class="border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition-colors w-full"><i class="fas fa-eye mr-1"></i> Detalhes</button>`;

        let borderColor = '#ef4444';
        if (req.status === 'aprovado') {
            statusHtml = `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Aprovado</span>`;
            acaoHtml += btnDetalhes;
            borderColor = '#16a34a';
        } else if (req.status === 'reprovado') {
            statusHtml = `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Reprovado</span>`;
            acaoHtml += btnDetalhes;
        } else {
            statusHtml = `<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Pendente</span>`;
            acaoHtml += btnAvaliar;
            borderColor = '#f97316';
        }

        acaoHtml += '</div>';

        let valorAVista = req.snapshot?.totalGeralAVista || req.valor_alvo || 0;
        let valorParcelado = req.snapshot?.totalGeralParcelado || (valorAVista * 1.05);

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors";
        tr.style.borderLeft = `3px solid ${borderColor}`;
        tr.innerHTML = `
            <td class="p-4 text-xs text-slate-500">
                <div class="font-bold text-slate-700">${dataFormatada}</div>
                <div class="text-slate-400">${horaFormatada}</div>
            </td>
            <td class="p-4">
                <div class="text-[11px] text-slate-400 font-mono mb-0.5">#${req.codigo_orcamento || req.id.split('-')[0]}</div>
                <div class="font-bold text-slate-800 text-sm">${nomeVendedor}</div>
                <div class="text-[10px] text-slate-400 uppercase mt-0.5">Filial ${req.filial || '1028'}</div>
            </td>
            <td class="p-4 text-right">
                <div class="font-black text-blue-700">${formataMoeda(valorAVista)} <span class="text-[9px] font-bold text-slate-400 uppercase">à vista</span></div>
                <div class="font-bold text-slate-500 mt-0.5 text-sm">${formataMoeda(valorParcelado)} <span class="text-[9px] font-bold text-slate-400 uppercase">10x</span></div>
            </td>
            <td class="p-4 text-center font-bold text-slate-700 text-sm">${parseFloat(req.desconto_solicitado).toFixed(2)}%</td>
            <td class="p-4 text-center">${statusHtml}</td>
            <td class="p-4 text-center w-32">${acaoHtml}</td>
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
        auditarDownload('SUPABASE', `Download Snapshot PDF #${id.substring(0,4)}`, data);    } catch (err) {
        alert("Erro ao abrir PDF.");
    } finally {
        document.body.style.cursor = 'default';
    }
}

window.abrirModalAnaliseJS = function(id) {
    const req = todosOrcamentos.find(s => s.id === id);
    if (!req) return;

    solicitacaoAtivaId = id; 

    // 1. Criamos um "Avaliador de Risco" (Função ajudante defensiva)
    const setTextoSeguro = (idElemento, texto) => {
        const el = document.getElementById(idElemento);
        if (el) el.innerText = texto; // Só tenta escrever se a caixa realmente existir na tela
        else console.warn(`⚠️ Aviso: O campo HTML '${idElemento}' não foi encontrado.`);
    };

    // 2. Aplicamos a injeção de dados conectando com os novos IDs do HTML
    setTextoSeguro('modal-analise-id', `ID: #${req.codigo_orcamento || req.id.split('-')[0]}`);
    setTextoSeguro('modal-analise-vendedor', (req.vendedor_email || '').split('@')[0]);
    setTextoSeguro('modal-analise-filial', `Filial: ${req.filial}`);

    let valorAVista = req.snapshot?.totalGeralAVista || req.valor_alvo || 0;
    let valorParcelado = req.snapshot?.totalGeralParcelado || 0;
    
    // Se o vendedor mandou de um telemóvel com cache antigo, o Admin deduz os 5% automaticamente para não dar erro
    if (valorParcelado === 0 && valorAVista > 0) valorParcelado = valorAVista * 1.05;

    setTextoSeguro('modal-analise-avista', formataMoeda(valorAVista));
    setTextoSeguro('modal-analise-parcelado', formataMoeda(valorParcelado));
    setTextoSeguro('modal-analise-desconto', `${parseFloat(req.desconto_solicitado).toFixed(2)}%`);
    setTextoSeguro('modal-analise-rt', `${parseFloat(req.rt || 0).toFixed(2)}%`);
    setTextoSeguro('modal-analise-motivo', `"${req.motivo || 'Sem justificativa preenchida.'}"`);

    // ==========================================
    // 2. CÁLCULO PROTHEUS (Limpo e Exato)
    // ==========================================
    const descBaseNum = parseFloat(req.desconto_solicitado || 0);
    const rtNum = parseFloat(req.rt || 0);

    // Tenta pegar o desconto exato do snapshot. Se for um orçamento antigo, calcula na hora usando a regra de subtração limpa.
    let descProtheusAVista = req.snapshot?.descontoProtheusAVista !== undefined ? req.snapshot.descontoProtheusAVista : Math.max(0, descBaseNum - rtNum);
    let descProtheusParcelado = req.snapshot?.descontoProtheusParcelado !== undefined ? req.snapshot.descontoProtheusParcelado : Math.max(0, descBaseNum - rtNum - 5.00);

    setTextoSeguro('modal-analise-protheus-avista', `${descProtheusAVista.toFixed(2)}%`);
    setTextoSeguro('modal-analise-protheus-parcelado', `${descProtheusParcelado.toFixed(2)}%`);

    // ==========================================
    // 3. CÁLCULO DE CUSTOS E LISTAGEM DA TABELA
    // ==========================================
    const corpoItens = document.getElementById('modal-analise-itens');
    corpoItens.innerHTML = '';
    
    let custoTotalPedido = 0;
    let custoTotalBruto = 0;
    const itens = req.itens || [];

    itens.forEach(item => {
        const produtoBase = produtos.find(p => String(p.sku) === String(item.codigo));
        let estoqueAtual = 0;
        let custo = 0;
        let verba = 0;
        let custoLiquido = 0;

        if (produtoBase) {
            custo = parseFloat(produtoBase.custo || produtoBase.custos?.custo || 0);
            verba = parseFloat(produtoBase.verba || produtoBase.custos?.verba || 0);
            custoLiquido = custo - verba;

            estoqueAtual = parseInt(produtoBase.estoque) || 0;

            if (custo > 0) custoTotalBruto += (custo * parseInt(item.qtd));
            if (custoLiquido > 0) custoTotalPedido += (custoLiquido * parseInt(item.qtd));
        }

        const subtotalParceladoExibicao = item.subtotalParcelado || (item.subtotal * 1.05) || 0;

        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-50 last:border-0";
        tr.innerHTML = `
            <td class="p-2 font-bold text-slate-800 text-[10px]">${item.codigo}</td>
            <td class="p-2 font-bold text-slate-800 text-[10px] leading-tight">${item.descricao}</td>
            <td class="p-2 text-center font-bold text-slate-800 text-[10px]">${item.qtd}</td>
            <td class="p-2 text-center font-bold text-[10px]">${estoqueAtual}</td>
            <td class="p-2 text-right font-bold text-[10px] text-slate-800">${formataMoeda(custo)}</td>
            <td class="p-2 text-right font-bold text-[10px] text-emerald-600">${verba > 0 ? '-' + formataMoeda(verba) : 'R$ 0,00'}</td>
            <td class="p-2 text-right font-bold text-[11px] text-slate-800">${formataMoeda(custoLiquido)}</td>
            <td class="p-2 text-right font-bold text-indigo-700 text-[11px]">${formataMoeda(subtotalParceladoExibicao)}</td>
        `;
        corpoItens.appendChild(tr);
    });
    
    setTextoSeguro('modal-analise-custo-bruto', formataMoeda(custoTotalBruto));
    setTextoSeguro('modal-analise-custo-total', formataMoeda(custoTotalPedido));

    // ==========================================
    // 4. MARKUP GERAL REAL (Venda Total / Custo Total)
    // ==========================================
    let mkGeralAVista = 0;
    let mkGeralParcelado = 0;
    
    const subtotalAVista = req.snapshot?.totalBrutoAVista || req.valor_alvo || 0;
    const subtotalParcelado = req.snapshot?.totalBrutoParcelado || subtotalAVista * 1.05;

    if (custoTotalPedido > 0) {
        mkGeralAVista = subtotalAVista / custoTotalPedido;
        mkGeralParcelado = subtotalParcelado / custoTotalPedido;
    }

    setTextoSeguro('modal-analise-mk-avista', mkGeralAVista.toFixed(3));
    setTextoSeguro('modal-analise-mk-parcelado', mkGeralParcelado.toFixed(3));

    // ==========================================
    // CONTROLE DE EVIDÊNCIA OPCIONAL
    // ==========================================
   const linkEvidenciaOriginal = document.getElementById('modal-analise-evidencia-link');
    const containerEvidencias = linkEvidenciaOriginal.parentElement;
    const avisoVazio = document.getElementById('modal-analise-evidencia-vazia');
    
    // 1. Limpa botões gerados na análise anterior
    document.querySelectorAll('.link-evidencia-gerado').forEach(el => el.remove());
    linkEvidenciaOriginal.classList.add('hidden'); 

    if (req.url_evidencia && String(req.url_evidencia).trim() !== '' && String(req.url_evidencia) !== 'null') {
        if (avisoVazio) avisoVazio.classList.add('hidden');
        
        // 2. Corta as URLs pelas vírgulas
        const urls = String(req.url_evidencia).split(',');
        
        // 3. Clona e cria um botão para cada anexo
        urls.forEach((url, index) => {
            const novoLink = linkEvidenciaOriginal.cloneNode(true);
            novoLink.classList.remove('hidden');
            novoLink.classList.add('link-evidencia-gerado'); // Marca para ser apagado no próximo clique
            novoLink.classList.add('mr-2', 'mb-2', 'inline-block');
            novoLink.id = ''; // Evita IDs duplicados
            
            // Nomeia dinamicamente: "Anexo 1", "Anexo 2"...
            novoLink.innerHTML = `<i class="fas fa-paperclip mr-1"></i> Anexo ${index + 1}`;
            
            novoLink.onclick = (e) => {
                e.preventDefault();
                abrirEvidenciaSegura(url.trim());
            };
            containerEvidencias.appendChild(novoLink);
        });
    } else {
        if (avisoVazio) avisoVazio.classList.remove('hidden');
    }

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
        // 1. PRIMEIRO: Pega a sessão para saber qual Admin está clicando no botão agora
        const { data: { session } } = await supabase.auth.getSession();
        
        // Formata o nome de quem avaliou (Pega o nome configurado ou o email)
        const emailAdmin = session?.user?.email || 'Admin Desconhecido';
        const nomeAdmin = session?.user?.user_metadata?.full_name || emailAdmin;

        // 2. Prepara o pacote de dados para o banco, incluindo a assinatura e a hora
        const payloadAtualizacao = { 
            status: String(novoStatus), 
            motivo_reprovacao: motivo,
            avaliado_por: nomeAdmin,
            // Envia a data e hora local do seu PC para o banco sem o "Z" do UTC
            avaliado_em: new Date().toLocaleString('sv-SE').replace(' ', 'T')
        };

        const { data, error } = await supabase
            .from('solicitacoes_orcamento')
            .update(payloadAtualizacao)
            .eq('id', solicitacaoAtivaId)
            .select(); 

        if (error) throw error;

        if (data && data.length > 0) {
            alert(`Sucesso! O orçamento agora está como: ${novoStatus.toUpperCase()}`);
            const modal = document.getElementById('modal-analise-solicitacao');
            if (modal) modal.classList.add('hidden');

            // ATUALIZAÇÃO DIRETO NA MEMÓRIA RAM (ZERO GASTO DE BANDA)
            const index = todosOrcamentos.findIndex(o => o.id === solicitacaoAtivaId);
            if (index !== -1) {
                const filtroStatus = document.getElementById('filtro-status-orcamento')?.value || "";
                
                // Se a tela está filtrada só para "Pendente" e você aprovou, tira da tela instantaneamente
                if (filtroStatus && filtroStatus !== novoStatus) {
                    todosOrcamentos.splice(index, 1);
                } else {
                    // Se estiver em "Todos", apenas muda o visual para Aprovado/Reprovado
                    todosOrcamentos[index].status = novoStatus;
                }
            }
            renderizarTabelaAprovacoes();
            
            // Subtrai do sininho vermelho imediatamente sem usar a internet
            const badge = document.getElementById('badge-solicitacoes');
            if (badge && novoStatus !== 'pendente') {
                let atual = parseInt(badge.innerText) || 0;
                if (atual > 0) atualizarBadge(atual - 1);
            }
        }

        auditarDownload('SUPABASE', 'Status de Orçamento Atualizado (Com Auditoria)', data);

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
        // 1. Puxa as duas versões para saber se houve mudança
        const [resEstoque, resCustos] = await Promise.all([
            supabase.from('configuracoes').select('valor').eq('chave', 'versao_estoque').single(),
            supabase.from('configuracoes').select('valor').eq('chave', 'versao_catalogo').single()
        ]);

        const vEstoqueNuvem = resEstoque.data?.valor || '1';
        const vCustosNuvem = resCustos.data?.valor || '1';

        const cache = localStorage.getItem('climario_catalogo_admin');
        const vEstoqueLocal = localStorage.getItem('climario_versao_admin_estoque');
        const vCustosLocal = localStorage.getItem('climario_versao_admin_custos');

        // Se nada mudou, usa a memória RAM
        if (!forcarBaixar && cache && vEstoqueLocal === vEstoqueNuvem && vCustosLocal === vCustosNuvem) {
            produtos = JSON.parse(cache);
            console.log(`📦 Admin: Catálogo carregado do Cache.`);
            renderizarTabelaAdmin();
            return;
        }

        console.log("🔄 Admin: Baixando catálogo atualizado do Supabase...");
        const { data, error } = await supabase.from('produtos').select(`*, custos (custo, verba)`);
        auditarDownload('SUPABASE', 'Catálogo Completo do Admin', data);
        
        if (error) throw error;
        if (data) {
            produtos = data;
            localStorage.setItem('climario_catalogo_admin', JSON.stringify(produtos));
            localStorage.setItem('climario_versao_admin_estoque', vEstoqueNuvem);
            localStorage.setItem('climario_versao_admin_custos', vCustosNuvem);
            renderizarTabelaAdmin();
        }
    } catch (err) { console.error("Erro ao carregar produtos admin:", err); }
}

let usandoPlanoBAdmin = false;
let canalAdminGlobal = null; // Trava para evitar conexões duplicadas

async function iniciarMonitoramentoAdmin() {
    // 1. Limpeza rigorosa: Remove o canal anterior garantindo que não ficam "fantasmas"
    if (window.canalAdminGlobal) {
        await supabase.removeChannel(window.canalAdminGlobal);
        window.canalAdminGlobal = null;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    console.log("📡 Construindo barreira de nuvem...");

    const ocultarDescontosBaixos = document.getElementById('filtro-ocultar-baixos')?.checked;
    
    let regraRealtime = { event: 'INSERT', schema: 'public', table: 'solicitacoes_orcamento' };
    
    // O Filtro na Nuvem de < 18% continua ativo!
    if (ocultarDescontosBaixos) {
        regraRealtime.filter = 'desconto_solicitado=gt.18';
    }

    // 2. A MÁGICA: Criamos um nome ÚNICO para o túnel usando o relógio do sistema.
    // Isso impede que o Supabase empilhe ouvintes (acaba com os logs duplicados!)
    const nomeDoTunel = 'torre-controle-' + Date.now();

    window.canalAdminGlobal = supabase.channel(nomeDoTunel)
        .on('postgres_changes', regraRealtime, (payload) => {
            
            // 3. A TRAVA DE TITÂNIO: Se não for um orçamento 100% novo, morre aqui! (0 KB gastos)
            // Impede orçamentos velhos ou edições de ativarem a sua tela.
            if (payload.eventType !== 'INSERT') return;

            console.log("🔔 NOVO ORÇAMENTO RECEBIDO!");
            if (typeof auditarDownload === 'function') auditarDownload('SUPABASE', 'Realtime Push: Novo Orçamento', payload);
            
            const novoOrcamento = payload.new;
            novoOrcamento.marca = novoOrcamento.snapshot ? novoOrcamento.snapshot.marcaNome : "---";

            // 4. LÊ AS REGRAS DA TELA (O Segurança da Porta Visual)
            const checkBaixos = document.getElementById('filtro-ocultar-baixos')?.checked;
            const termoBusca = (document.getElementById('filtro-busca-orcamento')?.value || "").trim().toLowerCase();
            const filtroStatus = document.getElementById('filtro-status-orcamento')?.value || "";
            const filtroFilial = (document.getElementById('filtro-filial-orcamento')?.value || "").trim();
            const filtroMarca = document.getElementById('filtro-marca-orcamento')?.value || "";
            const checkEvidencia = document.getElementById('filtro-com-evidencia')?.checked;

            let passaNoFiltro = true;
            
            if (checkBaixos && (parseFloat(novoOrcamento.desconto_solicitado) || 0) <= 18) passaNoFiltro = false;
            if (checkEvidencia && (!novoOrcamento.url_evidencia || String(novoOrcamento.url_evidencia).trim() === '' || String(novoOrcamento.url_evidencia) === 'null')) passaNoFiltro = false;
            if (filtroStatus && novoOrcamento.status !== filtroStatus) passaNoFiltro = false;
            if (filtroFilial && !String(novoOrcamento.filial).includes(filtroFilial)) passaNoFiltro = false;
            if (filtroMarca && !(novoOrcamento.marca || "").toUpperCase().includes(filtroMarca)) passaNoFiltro = false;
            if (termoBusca) {
                const vendedor = (novoOrcamento.vendedor_email || "").toLowerCase();
                const codigo = (novoOrcamento.codigo_orcamento || "").toLowerCase();
                if (!vendedor.includes(termoBusca) && !codigo.includes(termoBusca)) passaNoFiltro = false;
            }

            // 5. SE PASSOU NO FILTRO, DEIXA ENTRAR NA TELA!
            if (passaNoFiltro) {
                todosOrcamentos.unshift(novoOrcamento);
                const limiteAtualDaTela = paginaAtualAprovacoes * itensPorPagina;
                if (todosOrcamentos.length > limiteAtualDaTela) {
                    todosOrcamentos.pop();
                }
                renderizarTabelaAprovacoes();
                totalOrcamentos++;
            }

            // 6. SOMA NO SININHO 
            if (novoOrcamento.status === 'pendente') {
                if (!checkBaixos || (parseFloat(novoOrcamento.desconto_solicitado) || 0) > 18) {
                    const badge = document.getElementById('badge-solicitacoes');
                    if (badge) {
                        let atual = parseInt(badge.innerText) || 0;
                        atualizarBadge(atual + 1);
                    }
                    if (typeof dispararNotificacaoDesktop === 'function') dispararNotificacaoDesktop(novoOrcamento);
                }
            }
        })
        // Ouvinte B: Atualização de Estoque (Python)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'configuracoes', 
            filter: 'chave=eq.versao_estoque' 
        }, () => {
            console.log("⚡ Realtime Admin: Estoque atualizado pelo script.");
            carregarProdutosAdmin(true);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log("🟢 Conectado Websocket.");
                
                // MÁGICA: O túnel voltou? Desliga o Polling de emergência na hora!
                if (window.timerPollingAdmin) {
                    clearInterval(window.timerPollingAdmin);
                    window.timerPollingAdmin = null;
                    usandoPlanoBAdmin = false;
                    console.log("✅ Conexão restaurada. Polling desligado para poupar banda.");
                }
                
            } else if (status === 'CHANNEL_ERROR') {
                window.canalAdminGlobal = null; 
                
                if (!usandoPlanoBAdmin) {
                    usandoPlanoBAdmin = true;
                    console.warn("🟡 Admin: Erro de canal. Ativando Polling.");
                    let ultimoCountBanco = -1;

                    // Guarda o Polling numa variável global para podermos "matar" ele depois
                    window.timerPollingAdmin = setInterval(async () => {
                        try {
                            const checkBaixos = document.getElementById('filtro-ocultar-baixos')?.checked;
                            let query = supabase.from('solicitacoes_orcamento').select('*', { count: 'exact', head: true }).eq('status', 'pendente');
                            if (checkBaixos) query = query.gt('desconto_solicitado', 18);
                            
                            const { count } = await query;
                            
                            // 0 KB PING: Só gasta internet se o número de orçamentos mudar!
                            if (count !== null && count !== ultimoCountBanco) {
                                if (ultimoCountBanco !== -1) carregarSolicitacoes();
                                ultimoCountBanco = count;
                            }
                            carregarProdutosAdmin(); 
                        } catch(e) {}
                    }, 60000);
                }
            } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
                console.log("💤 Realtime em pausa (Aba em segundo plano). Aguardando reconexão automática...");
            }
        });
}

// Chame a função após verificar o acesso
iniciarMonitoramentoAdmin();

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
    return 1.75;
}

function renderizarTabelaAdmin() {
    const corpo = document.getElementById('corpo-tabela-admin');
    if (!corpo) return;
    corpo.innerHTML = '';
    
    const markupBaseCalculado = calcularMarkupBaseFixa();

    const produtosFiltrados = produtos.filter(item => {
        const skuStr = String(item.sku || "").toLowerCase();
        const descStr = String(item.descricao || item.produto || "").toLowerCase();
        
        // Extrai o Código do Fabricante para a busca
        const codFabStr = String(item.codfab || item["codigo fabricante"] || item.MODELO || "").toLowerCase();
        
        // A mágica da Busca: Agora procura por SKU, Nome OU Código do Fabricante
        const matchBusca = skuStr.includes(filtroBusca) || descStr.includes(filtroBusca) || codFabStr.includes(filtroBusca);
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
        const precoBD = novoCusto * markupLinha;

        // Extrai o Código do Fabricante para exibir na tela
        const codFabricante = item.codfab || item["codigo fabricante"] || item.MODELO || "---";

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100 transition-colors text-xs";
        
     tr.innerHTML = `
            <td class="p-4 font-bold text-slate-800 text-center">${id}</td>
            <td class="p-4 font-bold text-slate-800">${(item.descricao || item.produto || "---").toUpperCase()}</td>
            <td class="p-4 font-bold text-slate-800">${codFabricante}</td>
            <td class="p-4 text-center font-bold text-slate-700">R$ ${custo.toFixed(2)}</td>
            <td class="p-4 text-center font-bold text-slate-700">${verba > 0 ? 'R$ ' + verba.toFixed(2) : '—'}</td>
            <td class="p-4 text-right font-bold text-slate-900">R$ ${novoCusto.toFixed(2)}</td>
            <td class="p-4 text-center font-bold text-blue-600">${markupLinha.toFixed(4)}</td>
            <td class="p-4 text-right font-black text-blue-600">R$ ${precoBD.toFixed(2)}</td>
            <td class="p-4 text-center">
                <button onclick="abrirModalProduto('${id}')" class="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors" title="Editar produto">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        `;
        corpo.appendChild(tr);
    });
}


window.recalcularLinha = function(id, markupFix, valorForcado = null) {
    const custo = parseFloat(document.getElementById(`custo-${id}`)?.value || 0);
    const verba = parseFloat(document.getElementById(`verba-${id}`)?.value || 0);
    
    // Captura o Markup digitado diretamente na tela
    const inputMarkup = document.getElementById(`markup-${id}`);
    let markupAtual = parseFloat(inputMarkup?.value);
    
    // Trava de segurança: se apagar tudo, assume a base fixa
    if (isNaN(markupAtual) || markupAtual <= 0) markupAtual = markupFix;
         
    const novoCustoLiq = custo - verba;
    const spanCustoLiq = document.getElementById(`custoliq-${id}`);
    if(spanCustoLiq) spanCustoLiq.innerText = `R$ ${novoCustoLiq.toFixed(2)}`;
    
    // Muda a cor do campo de Markup se for editado (diferente da base)
    if (inputMarkup) {
        if (markupAtual !== markupFix) {
            // Editado: Fundo azul claro, texto azul escuro, borda azul clara
            inputMarkup.classList.add('bg-blue-50', 'text-blue-700', 'border-blue-300');
            inputMarkup.classList.remove('bg-white', 'text-blue-600', 'border-slate-200');
        } else {
            // Padrão: Fundo branco, texto azul base, borda cinza
            inputMarkup.classList.add('bg-white', 'text-blue-600', 'border-slate-200');
            inputMarkup.classList.remove('bg-blue-50', 'text-blue-700', 'border-blue-300');
        }
    }
    
    const novoPreco = novoCustoLiq * markupAtual;
    const colPreco = document.getElementById(`sugestao-${id}`);
         
    if (colPreco) {
        const exibir = valorForcado !== null ? valorForcado : novoPreco;
        colPreco.innerHTML = `R$ ${exibir.toFixed(2)} <span class="text-[9px] text-slate-400 block font-normal"></span>`;
                 
        const produto = produtos.find(p => String(p.sku) === String(id));
        const custoOriginal = parseFloat(produto?.custos?.custo || produto?.custo || 0);
        const markupOriginal = parseFloat(produto?.markup_base) || markupFix;
        
        // Se mudou o Markup ou o Custo, deixa o preço num azul mais escuro para mostrar a alteração
        if (markupAtual !== markupOriginal || custo !== custoOriginal) {
            colPreco.classList.replace('text-blue-600', 'text-blue-800');
        } else {
            colPreco.classList.replace('text-blue-800', 'text-blue-600');
        }
    }
};

// ==========================================
// 4. ATUALIZAÇÕES EM LOTE PARA O SUPABASE
// ==========================================
document.getElementById('btn-subir-supabase')?.addEventListener('click', async () => {
    const confirmacao = confirm("Deseja salvar APENAS as alterações feitas na tela no banco de dados?");
    if (!confirmacao) return;

    const markupBaseCalculado = calcularMarkupBaseFixa(); 
    const promessas = [];

    // 1. Atualiza a versão do catálogo para forçar os vendedores a baixarem a atualização
    promessas.push(
        supabase.from('configuracoes').update({ valor: new Date().getTime().toString() }).eq('chave', 'versao_catalogo')
    );

    // 2. O Auditor: Vasculha a tela e marca apenas os produtos que foram alterados
    const linhasVisiveis = document.querySelectorAll('#corpo-tabela-admin tr');
    linhasVisiveis.forEach(tr => {
        const id = tr.querySelector('td').innerText.trim(); 
        const inputCusto = document.getElementById(`custo-${id}`);
        const inputVerba = document.getElementById(`verba-${id}`);
        const inputMarkup = document.getElementById(`markup-${id}`);
        
        if(!inputCusto || !inputVerba || !inputMarkup) return;

        const custoTela = parseFloat(inputCusto.value || 0);
        const verbaTela = parseFloat(inputVerba.value || 0);
        const markupFinalBanco = parseFloat(inputMarkup.value) || markupBaseCalculado;

        const produtoDb = produtos.find(p => String(p.sku) === id);
        if (produtoDb) {
            const custoAntigo = parseFloat(produtoDb.custos?.custo || 0);
            const verbaAntiga = parseFloat(produtoDb.custos?.verba || 0);
            const markupAntigo = parseFloat(produtoDb.markup_base) || markupBaseCalculado;

            // Compara para ver se houve alguma edição real nesta linha
            if (custoTela !== custoAntigo || verbaTela !== verbaAntiga || markupFinalBanco !== markupAntigo) {
                produtoDb.foiAlterado = true; 
                
                if (!produtoDb.custos) produtoDb.custos = {};
                produtoDb.custos.custo = custoTela;  // <-- Erro corrigido aqui
                produtoDb.custos.verba = verbaTela;  // <-- Erro corrigido aqui
                produtoDb.markup_base = markupFinalBanco; // <-- Substituição da variação
            }
        }
    });

    // 3. Monta as promessas de envio APENAS para quem foi alterado
    let qtdAtualizados = 0;
    produtos.forEach(p => {
        if (p.foiAlterado) {
            const id = String(p.sku);
            const custoSalvar = parseFloat(p.custos?.custo || 0);
            const verbaSalvar = parseFloat(p.custos?.verba || 0);
            const mkFinalSalvar = parseFloat(p.markup_base) || markupBaseCalculado;

            promessas.push(
                supabase.from('produtos').update({ markup_base: mkFinalSalvar }).eq('sku', id)
            );
            promessas.push(
                supabase.from('custos').update({ custo: custoSalvar, verba: verbaSalvar }).eq('sku', id)
            );
            
            qtdAtualizados++;
            p.foiAlterado = false; // Reseta a marcação
        }
    });

    // Se ele não detectou nenhuma alteração, avisa e cancela
    if (qtdAtualizados === 0) {
        alert("Nenhuma alteração de preço, custo ou markup foi detectada na tela.");
        return;
    }

    // 4. Envia para a nuvem
    try {
        const btn = document.getElementById('btn-subir-supabase');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        btn.disabled = true;

        await Promise.all(promessas);

        alert(`Sucesso! ${qtdAtualizados} produto(s) foram atualizados no banco de dados e os vendedores já receberam o sinal de atualização.`);
        
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Salvar Alterações';
        btn.disabled = false;
        
        // Força a baixar a tabela recém-salva do banco para o cofre do Admin ficar 100% fiel
        carregarProdutosAdmin(true);
    } catch (error) {
        console.error("Erro na sincronização:", error);
        alert("Erro ao salvar alterações no Supabase.");
        const btn = document.getElementById('btn-subir-supabase');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Salvar Alterações';
            btn.disabled = false;
        }
    }
});

// ==========================================
// FORÇAR UPDATE GLOBAL
// ==========================================
document.getElementById('btn-forcar-update')?.addEventListener('click', async () => {
    const confirmacao = confirm("Isso forçará TODOS os vendedores a baixarem o catálogo de produtos silenciosamente nos próximos 60 segundos. Tem certeza?");
    if (!confirmacao) return;

    try {
        await supabase.from('configuracoes').update({ valor: new Date().getTime().toString() }).eq('chave', 'versao_catalogo');
        alert("📡 Sinal de atualização global enviado para todos os dispositivos!");
        carregarProdutosAdmin(true);
    } catch (error) {
        alert("Erro ao enviar o sinal global.");
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
                const custoAntigo = parseFloat(produtoDb.custos?.custo || 0);
                const verbaAntiga = parseFloat(produtoDb.custos?.verba || 0);
                const markupAntigo = parseFloat(produtoDb.markup_base || calcularMarkupBaseFixa());

                // MÁGICA CSV: O código joga no lixo linhas do CSV que não tiveram alterações
                if (Math.abs(custoCsv - custoAntigo) > 0.001 || Math.abs(verbaCsv - verbaAntiga) > 0.001 || Math.abs(mkCsv - markupAntigo) > 0.0001) {
                    produtoDb.foiAlterado = true; // Selo de alteração para o botão de salvar ver depois
                    
                    if (!produtoDb.custos) produtoDb.custos = {};
                    produtoDb.custos.custo = custoCsv;
                    produtoDb.custos.verba = verbaCsv;
                    produtoDb.markup_base = mkCsv;
                    countAtualizados++;
                }
            }
        }

        renderizarTabelaAdmin();

        alert(`✅ Planilha lida com sucesso!\n\nDos itens lidos, apenas ${countAtualizados} apresentaram valores novos.\n\nRevise a tela e clique em "Salvar Alterações" para enviar apenas as mudanças.`);
        document.getElementById('input-csv-markup').value = ""; 
    };
    reader.readAsText(file);
});

// Logout
document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = "../login.html";
});

window.consumoBanda = {
    supabase: 0,
    cloudflare: 0
};

function auditarDownload(origem, nomeRequisicao, dataResult) {
    if (!dataResult) return;
    
    // Calcula o peso aproximado do payload JSON em bytes
    const bytes = new Blob([JSON.stringify(dataResult)]).size;
    
    // Soma na caixinha correta
    if (origem === 'SUPABASE') {
        window.consumoBanda.supabase += bytes;
    } else if (origem === 'CLOUDFLARE') {
        window.consumoBanda.cloudflare += bytes;
    }

    // Formatações
    const formatarKB = (valorBytes) => (valorBytes / 1024).toFixed(2);
    const atualKB = formatarKB(bytes);
    const totalSupa = formatarKB(window.consumoBanda.supabase);
    const totalCloud = formatarKB(window.consumoBanda.cloudflare);

    console.log(`⬇️ [${origem}] ${nomeRequisicao}: +${atualKB} KB`);
    console.log(`📊 TOTAL GASTO -> Supabase: ${totalSupa} KB | Cloudflare: ${totalCloud} KB`);
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
        
        auditarDownload('CLOUDFLARE', 'Busca Preço Unitário (Tabela)', dados);

       if (dados.sucesso) {
            skusParaBuscar.forEach(sku => {
                const inputElement = document.querySelector(`.qtd-input[data-sku="${sku}"]`);
                if (inputElement) {
                    const tr = inputElement.closest('tr');
                    const tdPreco = tr.querySelector('.preco-col');
                    if (tdPreco && dados.precos[sku]) {
                        const infoPreco = dados.precos[sku];
                        
                        // USA OS NOMES EXATOS DA API
                        let precoExibir = (penalidadePagto > 0) ? infoPreco.precoUnitarioParcelado : infoPreco.precoUnitarioAVista;

                        tdPreco.innerText = (precoExibir || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
                    <td class="border border-slate-200 px-4 py-2 text-center font-bold preco-col"><i class="fas fa-spinner fa-spin text-slate-300 text-[10px]"></i></td>
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

async function executarCalculoAdminAPI() {
    // [1] Captura de Inputs da Interface
    const descontoBase = parseFloat(document.getElementById('input-desconto').value) || 0;
    const rt = parseFloat(document.getElementById('input-rt').value) || 0;
    const penalidadePagto = parseFloat(document.getElementById('select-pagamento').value) || 0;
    
    const selectUf = document.getElementById('select-uf');
    const percentualFrete = parseFloat(selectUf.value) || 0;

    let carrinho = [];
    let totalBtuCond = 0; 
    let totalBtuEvap = 0;
    let itensMapeados = [];

    // [2] Mapeamento dos Itens da Tabela
    document.querySelectorAll('.qtd-input').forEach(input => {
        const qtd = parseInt(input.value) || 0;
        const sku = input.getAttribute('data-sku');
        carrinho.push({ sku: sku, qtd: qtd });
        
        if (qtd > 0) {
            const p = produtos.find(x => String(x.sku) === sku);
            if (p) {
                const tipo = (p.tipo || p.TIPO || "").toUpperCase();
                const btu = parseInt(p.capacidade || p.CAPACIDADE) || 0;
                
                if (tipo.includes('CONDENSADORA')) totalBtuCond += (qtd * btu);
                else if (tipo.includes('EVAPORADORA')) totalBtuEvap += (qtd * btu);
                
                itensMapeados.push({
                    codigo: sku, 
                    descricao: p.descricao || p.produto,
                    qtd: qtd
                });
            }
        }
    });

    // [3] Utilitários e Limpeza da Tela
    const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    
    const formatarHtmlLista = (html) => {
        const el = document.getElementById('lista-itens-resumo');
        if (el) {
            el.innerHTML = html;
            // 👉 SOLUÇÃO DO SCROLL: Remove as travas de altura para a caixinha expandir livremente
            el.classList.remove('max-h-80', 'overflow-y-auto', 'custom-scrollbar');
        }
        
        // Esconde o rodapé estático antigo do index.html
        const elSubtotal = document.getElementById('resumo-subtotal');
        if (elSubtotal) {
            const divRodape = elSubtotal.closest('.space-y-2.mb-6.border-t');
            if (divRodape) divRodape.style.display = 'none';
        }
    };

    if (carrinho.length === 0 || itensMapeados.length === 0) {
        formatarHtmlLista('<p class="text-xs text-slate-500 italic mt-2">Nenhum item selecionado.</p>');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // [4] Comunicação com a API de Precificação
    try {
        const resposta = await fetch('/api/calcular', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` 
            },
            body: JSON.stringify({ 
                itens: carrinho, 
                descontoBase, 
                rt, 
                penalidadePagto, 
                versaoCatalogo: "ADMIN_BYPASS_" + (localStorage.getItem('climario_versao_admin') || '1') 
            })
        });
        
        const dadosAPI = await resposta.json();
        if (!dadosAPI.sucesso) throw new Error(dadosAPI.erro);

        // Atualiza os preços unitários na tabela
        Object.keys(dadosAPI.precos).forEach(sku => {
            const infoPreco = dadosAPI.precos[sku];
            const inputQtd = document.querySelector(`.qtd-input[data-sku="${sku}"]`);
            if(inputQtd) {
                const tr = inputQtd.closest('tr');
                if(tr) {
                    const tdPreco = tr.querySelector('.preco-col');
                    if(tdPreco) {
                        let precoExibir = (penalidadePagto > 0) ? infoPreco.precoUnitarioParcelado : infoPreco.precoUnitarioAVista;
                        tdPreco.innerText = formatadorMoeda.format(precoExibir || 0);
                    }
                }
            }
        });

        // [5] Lógica Financeira (Custos, Verbas e Venda)
        let totalCustoLiquidoPedido = 0;
        let totalCustoBrutoPedido = 0;
        let subtotalCalculadoDinamicamente = 0;
        
        let itensHtml = "";
        let verbasHtml = "";
        let temVerba = false;
        
        itensMapeados.forEach(item => {
            const info = dadosAPI.precos[item.codigo];
            if (info) {
                let precoUsado = (penalidadePagto > 0) ? info.precoUnitarioParcelado : info.precoUnitarioAVista;
                let subtotalUsado = precoUsado * item.qtd;
                subtotalCalculadoDinamicamente += subtotalUsado;
                
                const p = produtos.find(x => String(x.sku) === item.codigo);
                if (p) {
                    const custoUnitario = parseFloat(p.custo || p.custos?.custo) || 0;
                    const verbaUnitario = parseFloat(p.verba || p.custos?.verba) || 0;
                    
                    const custoBrutoItem = custoUnitario * item.qtd;
                    const verbaTotalItem = verbaUnitario * item.qtd;
                    const custoLiqItem = custoBrutoItem - verbaTotalItem;

                    totalCustoBrutoPedido += custoBrutoItem;
                    totalCustoLiquidoPedido += custoLiqItem;
                    
                    if (verbaTotalItem > 0) {
                        temVerba = true;
                        verbasHtml += `
                            <div class="flex justify-between items-center py-0.5">
                                <span class="text-[10px] text-slate-500 truncate pr-2">- ${item.qtd}x ${item.descricao}</span>
                                <span class="text-[10px] font-medium text-slate-600 whitespace-nowrap">- ${formatadorMoeda.format(verbaTotalItem)}</span>
                            </div>`;
                    }
                    
                    const mkReal = custoLiqItem > 0 ? (subtotalUsado / custoLiqItem) : 0;
                    
                    itensHtml += `<div class="text-[11px] border-b border-slate-100 py-1.5 flex justify-between items-center">
                        <div class="truncate pr-2"><b>${item.qtd}x</b> ${item.descricao}</div>
                        <span class="text-indigo-600 font-bold ml-2">Mk: ${mkReal.toFixed(4)}</span>
                    </div>`;
                }
            }
        });

        const subtotal = Math.round(subtotalCalculadoDinamicamente * 100) / 100;
        const valorFrete = Math.round((subtotal * (percentualFrete / 100)) * 100) / 100;
        const totalFinal = subtotal + valorFrete;

        const markupGeral = totalCustoLiquidoPedido > 0 ? (subtotal / totalCustoLiquidoPedido) : 0;
        const sim = totalBtuCond > 0 ? (totalBtuEvap / totalBtuCond) * 100 : 0;

        // [6] Layout do Extrato Sequencial Ajustado
        if (totalCustoBrutoPedido > 0) {
            itensHtml += `
                <div class="mt-4 flex flex-col gap-1 border-t border-slate-200 pt-3 pb-2">
                    
                    <div class="flex justify-between items-center px-1 mb-2">
                        <span class="text-[11px] font-bold text-slate-500 uppercase">Simultaneidade</span>
                        <span class="text-[12px] font-bold text-slate-700">${sim.toFixed(1)}%</span>
                    </div>

                    <div class="flex justify-between items-center px-1">
                        <span class="text-[11px] font-bold text-slate-500 uppercase">Custo Total (Bruto)</span>
                        <span class="text-[12px] font-bold text-slate-700">${formatadorMoeda.format(totalCustoBrutoPedido)}</span>
                    </div>
                    
                    ${temVerba ? `
                    <div class="px-1 mt-4 mb-1">
                        <span class="text-[10px] font-bold text-slate-500 uppercase block mb-1">Verbas Aplicadas</span>
                        ${verbasHtml}
                    </div>` : ''}

                    <div class="flex justify-between items-center px-1 pt-2 pb-3 border-b border-slate-200">
                        <span class="text-[11px] font-black text-slate-800 uppercase">Custo Total Líquido</span>
                        <span class="text-[13px] font-black text-slate-900">${formatadorMoeda.format(totalCustoLiquidoPedido)}</span>
                    </div>

                    <div class="flex justify-between items-center px-1 pt-3">
                        <span class="text-[11px] font-bold text-slate-800 uppercase">Venda (Sem Frete)</span>
                        <span class="text-[13px] font-bold text-blue-700">${formatadorMoeda.format(subtotal)}</span>
                    </div>

                    <div class="flex justify-between items-center px-1 pt-1 pb-3 border-b border-slate-200">
                        <span class="text-[11px] font-bold text-slate-500 uppercase">Frete</span>
                        <span class="text-[13px] font-bold text-slate-600">+ ${formatadorMoeda.format(valorFrete)}</span>
                    </div>

                    <div class="flex justify-between items-center px-1 pt-3 pb-1">
                        <span class="text-sm font-black uppercase text-slate-900">Total Cotação</span>
                        <span class="text-xl sm:text-2xl font-black text-amber-600">${formatadorMoeda.format(totalFinal)}</span>
                    </div>

                    <div class="flex justify-between items-center px-1 pt-2 pb-1">
                        <span class="text-[11px] font-black uppercase text-indigo-700 tracking-wide">Markup do Pedido</span>
                        <span class="text-sm font-black text-indigo-700">${markupGeral.toFixed(4)}</span>
                    </div>
                </div>
            `;
        }

        window.dadosParaOrcamentoAdmin = {
            totalGeral: totalFinal
        };

        formatarHtmlLista(itensHtml);

    } catch (e) {
        console.error("Erro ao calcular orçamento do Admin:", e);
        formatarHtmlLista(`
            <div class="p-3 bg-red-50 border border-red-200 rounded text-center mt-2">
                <p class="text-xs text-red-600 font-bold"><i class="fas fa-exclamation-triangle"></i> Erro no Cálculo.</p>
            </div>
        `);
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

window.solicitarPermissaoNotificacao = function() {
    if (!("Notification" in window)) {
        console.log("Este navegador não suporta notificações de desktop.");
    } else if (Notification.permission !== "denied" && Notification.permission !== "granted") {
        // Pede a permissão para o usuário
        Notification.requestPermission();
    }
};

window.dispararNotificacaoDesktop = function(orcamento) {
    if (("Notification" in window) && Notification.permission === "granted") {
        const vendedor = orcamento.vendedor_email ? orcamento.vendedor_email.split('@')[0] : 'VENDEDOR';
        const desconto = parseFloat(orcamento.desconto_solicitado).toFixed(2);
        
        const notificacao = new Notification('🚨 Novo Orçamento Pendente', {
            body: `${vendedor} solicitou ${desconto}% de desconto.\nFilial: ${orcamento.filial} | Marca: ${orcamento.marca}`,
            icon: './img/logo-site.jpg' // Mostra a logo da Climario no card
        });

        // Se você clicar na notificação, ele te puxa direto para a aba do sistema!
        notificacao.onclick = function() {
            window.focus(); 
            notificacao.close();
        };
    }
};

// ==========================================
// 6. MÓDULO DE CATÁLOGO (CRUD PRODUTOS + FAMÍLIAS)
// ==========================================

let familias = [];

async function carregarFamilias() {
    const { data, error } = await supabase.from('familias_sku').select('*').order('nome');
    if (!error && data) {
        familias = data;
        renderizarGestorFamilias();
    }
}

// --- PRODUTOS CRUD ---

window.renderizarGestorProdutos = function() {
    const buscaVal = (document.getElementById('cat-busca')?.value || '').toLowerCase();
    const marcaVal = (document.getElementById('cat-marca')?.value || '').toUpperCase();
    const capVal   = (document.getElementById('cat-cap')?.value   || '');

    const filtrados = produtos.filter(item => {
        const sku  = String(item.sku || '').toLowerCase();
        const desc = String(item.descricao || item.produto || '').toLowerCase();
        const cod  = String(item.codfab || item["codigo fabricante"] || '').toLowerCase();
        const matchBusca = !buscaVal || sku.includes(buscaVal) || desc.includes(buscaVal) || cod.includes(buscaVal);
        const matchMarca = !marcaVal || (item.marca || '').toUpperCase() === marcaVal;
        const matchCap   = !capVal   || String(item.capacidade || '') === capVal;
        return matchBusca && matchMarca && matchCap;
    });

    const corpo = document.getElementById('cat-corpo-tabela');
    if (!corpo) return;
    corpo.innerHTML = '';

    if (filtrados.length === 0) {
        corpo.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 text-sm italic">Nenhum produto encontrado.</td></tr>';
        return;
    }

    filtrados.forEach(item => {
        const skuEsc = String(item.sku).replace(/'/g, "\\'");
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
        tr.innerHTML = `
            <td class="p-3 font-mono font-bold text-slate-800">${item.sku}</td>
            <td class="p-3 text-slate-700 max-w-[200px] truncate">${(item.descricao || item.produto || '---').toUpperCase()}</td>
            <td class="p-3 text-slate-500">${item.codfab || item["codigo fabricante"] || '---'}</td>
            <td class="p-3 font-bold text-slate-700">${item.marca || '---'}</td>
            <td class="p-3 text-center whitespace-nowrap">
                <button onclick="abrirModalProduto('${skuEsc}')" class="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 mr-1 transition-colors" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="confirmarExclusaoProduto('${skuEsc}')" class="text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>`;
        corpo.appendChild(tr);
    });
};

document.getElementById('cat-busca')?.addEventListener('input',  () => window.renderizarGestorProdutos());
document.getElementById('cat-marca')?.addEventListener('change', () => window.renderizarGestorProdutos());
document.getElementById('cat-cap')?.addEventListener('change',   () => window.renderizarGestorProdutos());

window.abrirModalProduto = function(sku = null) {
    const modal  = document.getElementById('modal-produto');
    const titulo = document.getElementById('modal-produto-titulo');
    document.getElementById('form-produto').reset();
    document.getElementById('mp-sku-original').value = '';
    document.getElementById('mp-sku').removeAttribute('readonly');
    document.getElementById('mp-sku').classList.remove('bg-slate-100', 'cursor-not-allowed');
    document.getElementById('mp-markup').value = '1.7500';
    document.getElementById('mp-custo').value  = '0.00';
    document.getElementById('mp-verba').value  = '0.00';

    if (sku) {
        const item = produtos.find(p => String(p.sku) === String(sku));
        if (!item) return;
        titulo.textContent = `Editar Produto: ${sku}`;
        document.getElementById('mp-sku').value        = item.sku;
        document.getElementById('mp-sku').setAttribute('readonly', true);
        document.getElementById('mp-sku').classList.add('bg-slate-100', 'cursor-not-allowed');
        document.getElementById('mp-sku-original').value = item.sku;
        document.getElementById('mp-descricao').value  = item.descricao || item.produto || '';
        document.getElementById('mp-codfab').value     = item.codfab || item["codigo fabricante"] || '';
        document.getElementById('mp-marca').value      = item.marca || '';
        document.getElementById('mp-tipo').value       = item.tipo  || '';
        document.getElementById('mp-capacidade').value = item.capacidade || '';
        document.getElementById('mp-modelo').value     = item.modelo || '';
        document.getElementById('mp-estoque').value    = item.estoque ?? '';
        document.getElementById('mp-markup').value     = parseFloat(item.markup_base || 1.75).toFixed(4);
        document.getElementById('mp-custo').value      = parseFloat(item.custos?.custo || item.custo || 0).toFixed(2);
        document.getElementById('mp-verba').value      = parseFloat(item.custos?.verba || item.verba || 0).toFixed(2);
    } else {
        titulo.textContent = 'Novo Produto';
    }

    modal.classList.remove('hidden');
};

window.fecharModalProduto = function() {
    document.getElementById('modal-produto').classList.add('hidden');
};

window.salvarProduto = async function() {
    const skuOriginal = document.getElementById('mp-sku-original').value;
    const sku         = document.getElementById('mp-sku').value.trim();
    const descricao   = document.getElementById('mp-descricao').value.trim().toUpperCase();
    const codfab      = document.getElementById('mp-codfab').value.trim() || null;
    const marca       = document.getElementById('mp-marca').value.trim().toUpperCase();
    const tipo        = document.getElementById('mp-tipo').value.trim().toUpperCase();
    const capacidade  = document.getElementById('mp-capacidade').value;
    const modelo      = document.getElementById('mp-modelo').value.trim() || null;
    const estoque     = document.getElementById('mp-estoque').value;
    const markup      = parseFloat(document.getElementById('mp-markup').value) || 1.75;
    const custo       = parseFloat(document.getElementById('mp-custo').value) || 0;
    const verba       = parseFloat(document.getElementById('mp-verba').value) || 0;

    if (!sku || !descricao || !marca || !tipo) {
        alert('Preencha os campos obrigatórios: SKU, Descrição, Marca e Tipo.');
        return;
    }

    const btn = document.getElementById('btn-salvar-produto');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const dadosProduto = { sku, codfab, marca, tipo, capacidade: capacidade ? parseInt(capacidade) : null, modelo, estoque: estoque !== '' ? parseInt(estoque) : null, markup_base: markup };
        const dadosCusto   = { sku, descricao, codfab, marca, custo, verba };

        if (skuOriginal) {
            const [r1, r2] = await Promise.all([
                supabase.from('produtos').update(dadosProduto).eq('sku', skuOriginal),
                supabase.from('custos').update(dadosCusto).eq('sku', skuOriginal)
            ]);
            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;
        } else {
            const [r1, r2] = await Promise.all([
                supabase.from('produtos').insert(dadosProduto),
                supabase.from('custos').insert(dadosCusto)
            ]);
            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;
        }

        await supabase.from('configuracoes').update({ valor: new Date().getTime().toString() }).eq('chave', 'versao_catalogo');
        window.fecharModalProduto();
        await carregarProdutosAdmin(true);
        window.renderizarGestorProdutos();
        alert(`✅ Produto ${sku} salvo com sucesso!`);
    } catch (err) {
        console.error('Erro ao salvar produto:', err);
        alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)));
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Produto';
    }
};

window.confirmarExclusaoProduto = async function(sku) {
    if (!confirm(`Excluir o produto SKU ${sku}?\n\nEssa ação remove o produto do catálogo e não pode ser desfeita.`)) return;

    try {
        const { error: e1 } = await supabase.from('agendamento_transito').delete().eq('sku', sku);
        if (e1) throw new Error('agendamento_transito: ' + e1.message);

        const { error: e2 } = await supabase.from('custos').delete().eq('sku', sku);
        if (e2) throw new Error('custos: ' + e2.message);

        const { error: e3 } = await supabase.from('produtos').delete().eq('sku', sku);
        if (e3) throw new Error('produtos: ' + e3.message);

        await supabase.from('configuracoes').update({ valor: new Date().getTime().toString() }).eq('chave', 'versao_catalogo');
        await carregarProdutosAdmin(true);
        window.renderizarGestorProdutos();
        alert(`✅ Produto ${sku} excluído.`);
    } catch (err) {
        console.error('Erro ao excluir produto:', err);
        alert('Erro ao excluir: ' + err.message);
    }
};

// --- FAMÍLIAS CRUD ---

window.renderizarGestorFamilias = function() {
    const busca     = (document.getElementById('cat-busca-familia')?.value || '').toLowerCase().trim();
    const marcaFil  = (document.getElementById('fam-marca')?.value || '').toUpperCase();

    const filtradas = familias.filter(f => {
        // Busca por nome OU por SKU dentro da família
        const matchBusca = !busca ||
            f.nome.toLowerCase().includes(busca) ||
            (f.skus || []).some(s => s.includes(busca));

        // Filtro de marca: verifica a marca dos produtos que estão na família
        let matchMarca = !marcaFil;
        if (marcaFil && !matchMarca) {
            for (const sku of (f.skus || [])) {
                const prod = produtos.find(p => String(p.sku) === String(sku));
                if (prod && (prod.marca || '').toUpperCase() === marcaFil) {
                    matchMarca = true;
                    break;
                }
            }
            // Fallback: testa se o nome da família contém a marca
            if (!matchMarca) matchMarca = f.nome.includes(marcaFil);
        }

        return matchBusca && matchMarca;
    });

    const lista = document.getElementById('cat-lista-familias');
    if (!lista) return;
    lista.innerHTML = '';

    if (filtradas.length === 0) {
        lista.innerHTML = '<p class="text-sm text-slate-400 italic p-4">Nenhuma família encontrada. Use "Migrar do Código" para importar as famílias existentes.</p>';
        return;
    }

    filtradas.forEach(familia => {
        const card = document.createElement('div');
        card.className = 'bg-white border border-slate-200 rounded p-4 flex flex-col sm:flex-row sm:items-center gap-3';
        const tagsHtml = (familia.skus || []).map(s =>
            `<span class="inline-block bg-slate-100 text-slate-600 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-slate-200">${s}</span>`
        ).join(' ');
        const nomeEsc = familia.nome.replace(/'/g, "\\'");
        card.innerHTML = `
            <div class="flex-1 min-w-0">
                <p class="font-bold text-sm text-slate-800">${familia.nome}</p>
                <div class="flex flex-wrap gap-1 mt-1.5">${tagsHtml || '<span class="text-xs text-slate-400 italic">Sem SKUs</span>'}</div>
            </div>
            <div class="flex gap-2 flex-shrink-0">
                <button onclick="abrirModalFamilia('${familia.id}')" class="text-blue-600 hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                    <i class="fas fa-edit mr-1"></i>Editar
                </button>
                <button onclick="confirmarExclusaoFamilia('${familia.id}', '${nomeEsc}')" class="text-red-500 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded text-xs font-bold transition-colors">
                    <i class="fas fa-trash mr-1"></i>Excluir
                </button>
            </div>`;
        lista.appendChild(card);
    });
};

document.getElementById('cat-busca-familia')?.addEventListener('input',  () => window.renderizarGestorFamilias());
document.getElementById('fam-marca')?.addEventListener('change', () => window.renderizarGestorFamilias());

let skusDaFamiliaAtual = [];

window.abrirModalFamilia = function(id = null) {
    skusDaFamiliaAtual = [];
    const modal  = document.getElementById('modal-familia');
    const titulo = document.getElementById('modal-familia-titulo');
    document.getElementById('mf-id').value       = '';
    document.getElementById('mf-nome').value     = '';
    document.getElementById('mf-sku-input').value = '';

    if (id) {
        const familia = familias.find(f => f.id === id);
        if (!familia) return;
        titulo.textContent = 'Editar Família';
        document.getElementById('mf-id').value   = familia.id;
        document.getElementById('mf-nome').value = familia.nome;
        skusDaFamiliaAtual = [...(familia.skus || [])];
    } else {
        titulo.textContent = 'Nova Família de SKU';
    }

    renderizarTagsFamilia();
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('mf-nome').focus(), 50);
};

window.fecharModalFamilia = function() {
    document.getElementById('modal-familia').classList.add('hidden');
};

function renderizarTagsFamilia() {
    const container = document.getElementById('mf-tags');
    if (!container) return;
    if (skusDaFamiliaAtual.length === 0) {
        container.innerHTML = '<span class="text-xs text-slate-400 italic">Nenhum SKU adicionado.</span>';
        return;
    }
    container.innerHTML = skusDaFamiliaAtual.map(s => `
        <span class="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold px-2 py-1 rounded">
            ${s}
            <button type="button" onclick="removerSkuFamilia('${s}')" class="text-blue-400 hover:text-red-500 font-bold leading-none ml-1">&times;</button>
        </span>`).join('');
}

window.adicionarSkuFamilia = function() {
    const input = document.getElementById('mf-sku-input');
    const sku   = input.value.trim();
    if (!sku) return;
    if (skusDaFamiliaAtual.includes(sku)) { alert('Este SKU já está na família.'); return; }
    skusDaFamiliaAtual.push(sku);
    renderizarTagsFamilia();
    input.value = '';
    input.focus();
};

window.removerSkuFamilia = function(sku) {
    skusDaFamiliaAtual = skusDaFamiliaAtual.filter(s => s !== sku);
    renderizarTagsFamilia();
};

document.getElementById('mf-sku-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); window.adicionarSkuFamilia(); }
});

window.salvarFamilia = async function() {
    const id   = document.getElementById('mf-id').value;
    const nome = document.getElementById('mf-nome').value.trim().toUpperCase();

    if (!nome) { alert('Informe o nome da família.'); document.getElementById('mf-nome').focus(); return; }
    if (skusDaFamiliaAtual.length === 0) { alert('Adicione pelo menos um SKU à família.'); return; }

    const btn = document.getElementById('btn-salvar-familia');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        const payload = { nome, skus: skusDaFamiliaAtual };
        const { error } = id
            ? await supabase.from('familias_sku').update(payload).eq('id', id)
            : await supabase.from('familias_sku').insert(payload);
        if (error) throw error;
        window.fecharModalFamilia();
        await carregarFamilias();
        alert('✅ Família salva com sucesso!');
    } catch (err) {
        console.error('Erro ao salvar família:', err);
        alert('Erro ao salvar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Família';
    }
};

window.confirmarExclusaoFamilia = async function(id, nome) {
    if (!confirm(`Excluir a família "${nome}"?\n\nOs produtos não são deletados, apenas o agrupamento.`)) return;
    try {
        const { error } = await supabase.from('familias_sku').delete().eq('id', id);
        if (error) throw error;
        await carregarFamilias();
        alert('✅ Família excluída.');
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    }
};

window.migrarFamiliasParaBanco = async function() {
    if (!confirm(`Isso importa todas as ${Object.keys(familiasConfig).length} famílias do código para o banco.\nFamílias com nome igual às já existentes serão ignoradas.\n\nContinuar?`)) return;

    const btn = document.getElementById('btn-migrar-familias');
    btn.disabled = true;
    btn.textContent = 'Migrando...';

    try {
        const { data: existentes } = await supabase.from('familias_sku').select('nome');
        const nomesExistentes = new Set((existentes || []).map(f => f.nome.toUpperCase()));

        const payload = Object.entries(familiasConfig)
            .filter(([nome]) => !nomesExistentes.has(nome.toUpperCase()))
            .map(([nome, skus]) => ({ nome: nome.toUpperCase(), skus: skus.map(String) }));

        if (payload.length === 0) {
            alert('✅ Todas as famílias já estão no banco. Nada a migrar.');
            return;
        }

        const { error } = await supabase.from('familias_sku').insert(payload);
        if (error) throw error;

        await carregarFamilias();
        alert(`✅ ${payload.length} famílias migradas com sucesso!`);
    } catch (err) {
        console.error('Erro na migração:', err);
        alert('Erro na migração: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Migrar do Código (1x)';
    }
};

// Forcando update