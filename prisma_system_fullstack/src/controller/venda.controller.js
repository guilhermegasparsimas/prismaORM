import { prisma } from "../lib/prisma.js"; // Importa a nossa instância estendida e inteligente do prisma


export const realizarVenda = async (req, res) => {
  try {
    const { veiculoId, vendedorId, clienteId, valorVenda } = req.body;

    // Validação inicial dos campos obrigatórios
    if (!veiculoId || !vendedorId || !clienteId) {
      return res.status(400).json({ error: "Os campos veiculoId, vendedorId e clienteId são obrigatórios." });
    }

    // Executa todo o fluxo dentro de uma Transação para garantir consistência total do estoque
    const resultadoTransacao = await prisma.$transaction(async (tx) => {
      
      // Passo 1: Busca o veículo e verifica se ele está realmente disponível
      const veiculo = await tx.veiculo.findUnique({
        where: { id: parseInt(veiculoId) }
      });

      if (!veiculo) throw new Error("Veículo não encontrado no estoque.");
      if (veiculo.status !== "disponível") {
        throw new Error(`Este veículo não está disponível para venda. Status atual: ${veiculo.status}`);
      }

      // Passo 2: Busca o vendedor e confere se ele está ativo na empresa
      const vendedor = await tx.vendedor.findUnique({
        where: { id: parseInt(vendedorId) }
      });

      if (!vendedor) throw new Error("Vendedor não encontrado no sistema.");
      if (!vendedor.ativo) throw new Error("Este vendedor está inativo e não pode realizar novas vendas.");

      // Passo 3: Busca o cliente para garantir que ele existe no banco de dados
      const cliente = await tx.cliente.findUnique({
        where: { id: parseInt(clienteId) }
      });

      if (!cliente) throw new Error("Cliente não encontrado. Cadastre o cliente antes de realizar a venda.");

      // Passo 4: ATUALIZAÇÃO AUTOMÁTICA DE ESTOQUE
      // Muda o status do veículo para 'vendido' para que ele suma das buscas de carros disponíveis
      await tx.veiculo.update({
        where: { id: veiculo.id },
        data: { status: "vendido" }
      });

      // Passo 5: Cria o registro da Venda
      // ATENÇÃO: O valor da comissão de 15% NÃO é passado aqui. O seu arquivo `prisma.js`
      // vai interceptar esse comando e injetar o cálculo exato por baixo dos panos!
      const novaVenda = await tx.venda.create({
        data: {
          veiculoId: veiculo.id,
          vendedorId: vendedor.id,
          clienteId: cliente.id,
          // Se for passado um valorVenda no body (desconto ou acréscimo), o sistema usa ele. 
          // Se não for passado, a nossa extensão do Prisma usará o preço cheio do cadastro do carro.
          ...(valorVenda && { valorVenda: parseFloat(valorVenda) })
        },
        // Já traz no retorno todos os dados conectados para o recibo na tela do sistema
        include: {
          veiculo: true,
          vendedor: true,
          cliente: true
        }
      });

      return novaVenda;
    });

    // Se o código chegou até aqui, a transação foi um sucesso absoluto!
    res.status(201).json({
      mensagem: "Venda realizada com sucesso! Estoque atualizado e comissão gerada.",
      venda: resultadoTransacao
    });

  } catch (error) {
    console.error("Erro ao processar venda:", error);
    // Retorna a mensagem exata do erro que travou o processo (ex: Veículo já vendido)
    res.status(400).json({ error: error.message || "Erro interno ao processar o checkout." });
  }
};


export const getVendas = async (req, res) => {
  try {
    const vendas = await prisma.venda.findMany({
      include: {
        veiculo: true,
        vendedor: true,
        cliente: true
      },
      orderBy: {
        dataVenda: 'desc' // Mostra as vendas mais recentes no topo do relatório
      }
    });
    res.json(vendas);
  } catch (error) {
    console.error("Erro ao buscar histórico de vendas:", error);
    res.status(500).json({ error: "Erro ao carregar o relatório de vendas." });
  }
};


export const getVendaById = async (req, res) => {
  try {
    const { id } = req.params;

    const venda = await prisma.venda.findUnique({
      where: { id: parseInt(id) },
      include: {
        veiculo: true,
        vendedor: true,
        cliente: true
      }
    });

    if (!venda) {
      return res.status(404).json({ error: "Registro de venda não localizado." });
    }

    res.json(venda);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar detalhes da venda." });
  }
};