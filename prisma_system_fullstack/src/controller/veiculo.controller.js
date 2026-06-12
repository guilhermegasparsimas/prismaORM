import { prisma } from "../lib/prisma.js"; // Importa a nossa instância configurada do prisma

export const getVeiculos = async (req, res) => {
  try {
    const { busca, status, precoMax } = req.query;

    // Monta a query dinâmica baseada nos filtros da tela
    const queryFiltro = {
      where: {
        // Se passar um status na URL (ex: disponível, vendido), filtra. Senão, traz todos.
        ...(status && { status: status }),
        
        // Se o usuário estipular um preço máximo na barra de pesquisa
        ...(precoMax && { preco: { lte: parseFloat(precoMax) } }),

        // O coração da busca: Procura por termos parecidos na marca, modelo ou placa
        ...(busca && {
          OR: [
            { marca: { contains: busca } },
            { modelo: { contains: busca } },
            { placa: { contains: busca } }
          ]
        })
      },
      orderBy: {
        dataCadastro: 'desc' // Mostra sempre os carros mais novos inseridos no estoque primeiro
      }
    };

    const veiculos = await prisma.veiculo.findMany(queryFiltro);
    res.json(veiculos);
  } catch (error) {
    console.error("Erro ao buscar veículos:", error);
    res.status(500).json({ error: "Erro interno ao buscar o catálogo de veículos." });
  }
};

export const getVeiculoById = async (req, res) => {
  try {
    const { id } = req.params;
    const veiculo = await prisma.veiculo.findUnique({
      where: { id: parseInt(id) },
      include: {
        vendas: true // Se já foi vendido, traz o histórico da venda atrelado
      }
    });

    if (!veiculo) {
      return res.status(404).json({ error: "Veículo não encontrado no estoque." });
    }

    res.json(veiculo);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar detalhes do veículo." });
  }
};

export const createVeiculo = async (req, res) => {
  try {
    const { marca, modelo, anoFabricacao, anoModelo, preco, placa, cor, quilometragem } = req.body;

    // Validação básica de segurança para a placa
    const placaExiste = await prisma.veiculo.findUnique({ where: { placa } });
    if (placaExiste) {
      return res.status(400).json({ error: "Já existe um veículo cadastrado com esta placa." });
    }

    const novoVeiculo = await prisma.veiculo.create({
      data: {
        marca,
        modelo,
        anoFabricacao: parseInt(anoFabricacao),
        anoModelo: parseInt(anoModelo),
        preco: parseFloat(preco), // Convertendo para Float exigido pelo seu Schema
        placa,
        cor,
        quilometragem: parseInt(quilometragem),
        status: "disponível" // Todo veículo entra no estoque disponível por padrão
      }
    });

    res.status(201).json(novoVeiculo);
  } catch (error) {
    console.error("Erro ao cadastrar veículo:", error);
    res.status(500).json({ error: "Erro ao cadastrar o veículo no estoque." });
  }
};

export const updateVeiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const { marca, modelo, anoFabricacao, anoModelo, preco, placa, cor, quilometragem, status } = req.body;

    const veiculoAtualizado = await prisma.veiculo.update({
      where: { id: parseInt(id) },
      data: {
        ...(marca && { marca }),
        ...(modelo && { modelo }),
        ...(anoFabricacao && { anoFabricacao: parseInt(anoFabricacao) }),
        ...(anoModelo && { anoModelo: parseInt(anoModelo) }),
        ...(preco && { preco: parseFloat(preco) }),
        ...(placa && { placa }),
        ...(cor && { cor }),
        ...(quilometragem && { quilometragem: parseInt(quilometragem) }),
        ...(status && { status })
      }
    });

    res.json(veiculoAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar veículo:", error);
    res.status(500).json({ error: "Erro ao atualizar os dados do veículo." });
  }
};

export const deleteVeiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const idInt = parseInt(id);

    const veiculo = await prisma.veiculo.findUnique({ where: { id: idInt } });
    if (!veiculo) {
      return res.status(404).json({ error: "Veículo não encontrado para exclusão." });
    }

    // Regra de segurança: Se o carro já foi vendido, não pode deletar para não quebrar o histórico fiscal/vendas
    if (veiculo.status === "vendido") {
      return res.status(400).json({ error: "Não é possível deletar um veículo que já possui histórico de venda ativa." });
    }

    await prisma.veiculo.delete({ where: { id: idInt } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar o veículo do estoque." });
  }
};