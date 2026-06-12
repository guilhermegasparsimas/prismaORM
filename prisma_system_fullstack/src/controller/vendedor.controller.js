import { prisma } from "../lib/prisma.js"; 

export const getVendedores = async (req, res) => {
  try {
    const { busca, ativo } = req.query;

    const queryFiltro = {
      where: {
        // Se passar o filtro "ativo" na URL (transforma a string em boolean)
        ...(ativo && { ativo: ativo === "true" }),
        
        // Busca por aproximação no nome ou e-mail
        ...(busca && {
          OR: [
            { nome: { contains: busca } },
            { email: { contains: busca } }
          ]
        })
      },
      orderBy: {
        nome: 'asc' // Lista em ordem alfabética para facilitar a busca visual dos gestores
      }
    };

    const vendedores = await prisma.vendedor.findMany(queryFiltro);
    res.json(vendedores);
  } catch (error) {
    console.error("Erro ao buscar vendedores:", error);
    res.status(500).json({ error: "Erro interno ao buscar a listagem de vendedores." });
  }
};

export const getVendedorById = async (req, res) => {
  try {
    const { id } = req.params;

    const vendedor = await prisma.vendedor.findUnique({
      where: { id: parseInt(id) },
      include: {
        // Traz todas as vendas do funcionário e os dados do carro vendido
        vendas: {
          include: {
            veiculo: true 
          }
        }
      }
    });

    if (!vendedor) {
      return res.status(404).json({ error: "Vendedor não localizado." });
    }

    res.json(vendedor);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar os dados do vendedor." });
  }
};

export const createVendedor = async (req, res) => {
  try {
    const { nome, email, cpf, telefone } = req.body;

    // Validação de chaves únicas (@unique do schema) para evitar erros no banco
    const emailOuCpfExistente = await prisma.vendedor.findFirst({
      where: {
        OR: [{ email }, { cpf }]
      }
    });

    if (emailOuCpfExistente) {
      return res.status(400).json({ error: "E-mail ou CPF já cadastrado para outro vendedor." });
    }

    const novoVendedor = await prisma.vendedor.create({
      data: {
        nome,
        email,
        cpf,
        telefone,
        ativo: true // Todo vendedor entra no sistema ativo por padrão
      }
    });

    res.status(201).json(novoVendedor);
  } catch (error) {
    console.error("Erro ao cadastrar vendedor:", error);
    res.status(500).json({ error: "Erro ao registrar o vendedor no sistema." });
  }
};

export const updateVendedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, cpf, telefone, ativo } = req.body;

    const vendedorAtualizado = await prisma.vendedor.update({
      where: { id: parseInt(id) },
      data: {
        ...(nome && { nome }),
        ...(email && { email }),
        ...(cpf && { cpf }),
        ...(telefone && { telefone }),
        // Garante que o valor recebido seja tratado estritamente como Boolean
        ...(ativo !== undefined && { ativo: String(ativo) === "true" || ativo === true })
      }
    });

    res.json(vendedorAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar vendedor:", error);
    res.status(500).json({ error: "Erro ao atualizar os dados do vendedor." });
  }
};

export const deleteVendedor = async (req, res) => {
  try {
    const { id } = req.params;
    const idInt = parseInt(id);

    // Busca o vendedor junto com a contagem de vendas feitas por ele
    const vendedor = await prisma.vendedor.findUnique({
      where: { id: idInt },
      include: {
        _count: { select: { vendas: true } }
      }
    });

    if (!vendedor) {
      return res.status(404).json({ error: "Vendedor não encontrado." });
    }

    // REGRA DE OURO SaaS: Se o vendedor já vendeu algum carro, ele tem histórico financeiro.
    // Apagar ele quebraria os relatórios de comissão da loja. Em vez disso, nós barramos a exclusão.
    if (vendedor._count.vendas > 0) {
      return res.status(400).json({ 
        error: "Não é possível excluir este vendedor pois ele possui registros de vendas. Para desligá-lo, atualize o campo 'ativo' para false." 
      });
    }

    await prisma.vendedor.delete({ where: { id: idInt } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar o cadastro do vendedor." });
  }
};