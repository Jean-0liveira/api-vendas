const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function iniciarBanco() {
  let tentativas = 10;
  while (true) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS produtos (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          descricao TEXT,
          preco NUMERIC(10, 2) NOT NULL,
          estoque INTEGER NOT NULL DEFAULT 0,
          criado_em TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log("Conectado ao Postgres");
      return;
    } catch (err) {
      tentativas -= 1;
      if (tentativas === 0) throw err;
      console.log(`Aguardando o banco... (${err.message})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

app.get("/itens", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM produtos ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao listar produtos" });
  }
});

app.get("/item/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: "id inválido" });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM produtos WHERE id = $1", [
      id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Produto não encontrado" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar produto" });
  }
});

app.post("/item", async (req, res) => {
  const { nome, descricao, preco, estoque } = req.body;
  if (!nome || preco === undefined || Number.isNaN(Number(preco))) {
    return res.status(400).json({ erro: 'Informe ao menos "nome" e "preco"' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO produtos (nome, descricao, preco, estoque)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nome, descricao || null, preco, estoque || 0],
    );
    res.status(201).json({ mensagem: "Produto cadastrado", produto: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao cadastrar produto" });
  }
});

app.delete("/item/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: "id inválido" });
  }
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM produtos WHERE id = $1",
      [id],
    );
    if (rowCount === 0) {
      return res.status(404).json({ erro: "Produto não encontrado" });
    }
    res.json({ mensagem: "Produto excluído" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao excluir produto" });
  }
});

iniciarBanco()
  .then(() => {
    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });
  })
  .catch((err) => {
    console.error("Não foi possível conectar ao banco", err);
    process.exit(1);
  });
