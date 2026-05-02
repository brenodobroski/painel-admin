export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const body = await request.json();
        const { itens, descontoBase, rt, penalidadePagto, versaoCatalogo } = body;

        // A chave única do cofre baseada na versão atual do catálogo
        const CACHE_KEY = `CUSTOS_VERSAO_${versaoCatalogo || '1'}`;

        // 1. O CLOUDFLARE TENTA ABRIR O COFRE LOCAL (O Vendedor 2 ao 450 caem aqui)
        let catalogoCustos = await env.CLIMARIO_CUSTOS.get(CACHE_KEY, "json");

        // 2. O COFRE ESTÁ VAZIO? O primeiro vendedor do dia (ou após uma atualização) caiu aqui!
        if (!catalogoCustos) {
            
            // Credenciais do Supabase
            const SUPABASE_URL = 'https://ijkzolhxuuqmkuztdliv.supabase.co';
            const SUPABASE_KEY = env.SUPABASE_CHAVE;

            // Puxa o catálogo de custos INTEIRO do Supabase de uma vez só (Gasta 1 única requisição)
            const respostaSupabase = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=sku,markup_base,custos(custo,verba)`, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (!respostaSupabase.ok) throw new Error("Falha ao puxar custos do Supabase.");

            const dadosBrutos = await respostaSupabase.json();

            // Transforma a lista do banco num "Dicionário" fácil e super rápido de pesquisar
            catalogoCustos = {};
            dadosBrutos.forEach(produto => {
                catalogoCustos[produto.sku] = {
                    custo: produto.custos?.custo || 0,
                    verba: produto.custos?.verba || 0,
                    markup_base: produto.markup_base
                };
            });

            // SALVA NA MEMÓRIA DA CLOUDFLARE PARA OS PRÓXIMOS!
            // Adicionamos um prazo de validade de 24 horas (86400 segundos) para limpar o lixo antigo automaticamente
            await env.CLIMARIO_CUSTOS.put(CACHE_KEY, JSON.stringify(catalogoCustos), { expirationTtl: 86400 });
        }

        // ==============================================================
        // 3. DAQUI PARA BAIXO É SÓ MATEMÁTICA USANDO A MEMÓRIA!
        // Nenhuma requisição a mais vai para o Supabase.
        // ==============================================================
        let resultados = {};
        let custoTotalPedido = 0;
        let totalBrutoTabela = 0;

        const MARKUP_BASE_FIXA = parseFloat(env.MARKUP_BASE_FIXA);
        const descDecimal = (parseFloat(descontoBase) || 0) / 100;
        const rtDecimal = (parseFloat(rt) || 0) / 100;
        const pagtoDecimal = (parseFloat(penalidadePagto) || 0) / 100;

        const novoMarkupProtheus = (MARKUP_BASE_FIXA * ((1 - descDecimal) * (1 + (rtDecimal * 1.4)) * (1 + pagtoDecimal))) / 0.965;
        let descProtheusPedido = (((novoMarkupProtheus / 1.699) - 1) * -1) * 100;
        if (descProtheusPedido < 0) descProtheusPedido = 0;

        // Faz o loop calculando os SKUs que o vendedor pediu
        itens.forEach(itemPedido => {
            if (itemPedido.qtd > 0) {
                // Pega os dados secretos direto do Dicionário que estava no Cofre
                const dadosSecretos = catalogoCustos[itemPedido.sku];
                
                if (dadosSecretos) {
                    const custo = parseFloat(dadosSecretos.custo || 0);
                    const verba = parseFloat(dadosSecretos.verba || 0);
                    const markupVenda = parseFloat(dadosSecretos.markup_base) || MARKUP_BASE_FIXA;

                    const variacao = 1 - (MARKUP_BASE_FIXA / markupVenda);
                    const divisor = 1 - variacao;
                    const novoMarkup = (MARKUP_BASE_FIXA * ((1 - descDecimal) * (1 + (rtDecimal * 1.4)) * (1 + pagtoDecimal))) / divisor;

                    const precoCalculado = (custo - verba) * novoMarkup;

                    resultados[itemPedido.sku] = {
                        precoUnitario: precoCalculado,
                        subtotal: precoCalculado * itemPedido.qtd
                    };

                    custoTotalPedido += (itemPedido.qtd * (custo - verba));
                    totalBrutoTabela += (itemPedido.qtd * precoCalculado);
                }
            }
        });

        // Devolve o preço final polido para o app.js exibir na tela
        return new Response(JSON.stringify({
            sucesso: true,
            precos: resultados,
            totalBruto: totalBrutoTabela,
            descontoProtheus: descProtheusPedido
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ sucesso: false, erro: error.message }), { status: 500 });
    }
}