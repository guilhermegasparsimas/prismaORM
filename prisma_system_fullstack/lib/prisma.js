import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
});

const prismaRaw = new PrismaClient({ adapter });

const prisma = prismaRaw.$extends({
  query: {
    venda: {
      async create({ model, operation, args, query }) {
        const { veiculoId, valorVenda } = args.data;
        let precoFinal = valorVenda;

        if (!precoFinal) {
          const veiculo = await prismaRaw.veiculo.findUnique({
            where: { id: parseInt(veiculoId) },
            select: { preco: true }
          });
          if (!veiculo) throw new Error('Veículo não encontrado para calcular o valor da venda.');
          precoFinal = veiculo.preco;
        }

        const comissaoCalculada = Number(precoFinal) * 0.15;

        args.data.valorVenda = precoFinal;
        args.data.valorComissao = comissaoCalculada;

        return query(args);
      }
    }
  }
});

export { prisma };