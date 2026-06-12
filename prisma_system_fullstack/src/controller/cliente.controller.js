import { prisma } from "../lib/prisma.js"; // Importa a nossa instância configurada do prisma


export const getClientes = async (req, res) => {
  try {
    const { busca } = req.query;

    const queryFiltro = {
      where: {
        ...(busca && {
          OR: [
            { nome: { contains: busca } },
            { cpfCnpj: { contains: busca } },
            { email: { contains: busca } }
          ]
        })
      },
      orderBy: {
        nome: 'asc' 
      }
    };

    const clientes = await prisma.cliente.findMany(queryFiltro);
    res.json(clientes);
  } catch (error) {
    console.error("Erro ao buscar clientes:", error);
    res.status(500).json({ error: "Erro interno ao buscar a listagem de clientes." });
  }
};


export const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;

    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(id) },
      include: {
        vendas: {
          include: {
            veiculo: true,  
            vendedor: true  
          }
        }
      }
    });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente não localizado." });
    }

    res.json(cliente);
  } catch (error) {
    console.error("Erro ao detalhar cliente:", error);
    res.status(500).json({ error: "Erro ao buscar os dados do cliente." });
  }
};

export const createCliente = async (req, res) => {
  try {
    const { nome, cpfCnpj, email, telefone } = req.body;

   
    const clienteExiste = await prisma.cliente.findFirst({
      where: {
        OR: [{ cpfCnpj }, { email }]
      }
    });

    if (clienteExiste) {
      return res.status(400).json({ error: "CPF/CNPJ ou E-mail já cadastrado para outro cliente." });
    }

    const novoCliente = await prisma.cliente.create({
      data: {
        nome,
        cpfCnpj,
        email,
        telefone
      }
    });

    res.status(201).json(novoCliente);
  } catch (error) {
    console.error("Erro ao cadastrar cliente:", error);
    res.status(500).json({ error: "Erro ao registrar o cliente no sistema." });
  }
};


export const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cpfCnpj, email, telefone } = req.body;

    const clienteAtualizado = await prisma.cliente.update({
      where: { id: parseInt(id) },
      data: {
        ...(nome && { nome }),
        ...(cpfCnpj && { cpfCnpj }),
        ...(email && { email }),
        ...(telefone && { telefone })
      }
    });

    res.json(clienteAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({ error: "Erro ao atualizar os dados do cliente." });
  }
};

export const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const idInt = parseInt(id);

    const cliente = await prisma.cliente.findUnique({
      where: { id: idInt },
      include: {
        _count: { select: { vendas: true } }
      }
    });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    if (cliente._count.vendas > 0) {
      return res.status(400).json({ 
        error: "Não é possível excluir este cliente porque ele possui um histórico de compras na concessionária." 
      });
    }

    await prisma.cliente.delete({ where: { id: idInt } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar cliente:", error);
    res.status(500).json({ error: "Erro ao remover o cadastro do cliente." });
  }
};