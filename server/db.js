'use strict';

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const CUSTO_BCRYPT = 12;

function criarPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('A variável DATABASE_URL não está definida.');
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    // Na rede interna do Railway não há SSL; para conexões externas defina DATABASE_SSL=true
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });
}

const MIGRACOES = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    crn TEXT,
    papel TEXT NOT NULL DEFAULT 'nutricionista' CHECK (papel IN ('admin', 'nutricionista')),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'bloqueado')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    decidido_em TIMESTAMPTZ,
    decidido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pacientes (
    id TEXT PRIMARY KEY,
    dados JSONB NOT NULL,
    criado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    atualizado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

async function migrar(db) {
  for (const sql of MIGRACOES) await db.query(sql);
}

/**
 * Garante que exista o administrador definido em ADMIN_EMAIL / ADMIN_PASSWORD.
 * Se o usuário já existir, apenas assegura papel admin e status aprovado
 * (a senha só é redefinida quando ADMIN_REDEFINIR_SENHA=true).
 */
async function garantirAdmin(db, env = process.env) {
  const email = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = env.ADMIN_PASSWORD || '';

  if (!email || !senha) {
    const { rows } = await db.query("SELECT 1 FROM usuarios WHERE papel = 'admin' AND status = 'aprovado' LIMIT 1");
    if (!rows.length) console.warn('[nutris] Nenhum administrador cadastrado. Defina ADMIN_EMAIL e ADMIN_PASSWORD.');
    return;
  }
  if (senha.length < 8) throw new Error('ADMIN_PASSWORD deve ter pelo menos 8 caracteres.');

  const { rows } = await db.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    await db.query(
      `INSERT INTO usuarios (nome, email, senha_hash, papel, status, decidido_em)
       VALUES ($1, $2, $3, 'admin', 'aprovado', now())`,
      [env.ADMIN_NOME || 'Administrador', email, hash],
    );
    console.log(`[nutris] Administrador criado: ${email}`);
    return;
  }

  await db.query("UPDATE usuarios SET papel = 'admin', status = 'aprovado' WHERE id = $1", [rows[0].id]);
  if (env.ADMIN_REDEFINIR_SENHA === 'true') {
    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, rows[0].id]);
    await db.query('DELETE FROM sessoes WHERE usuario_id = $1', [rows[0].id]);
    console.log('[nutris] Senha do administrador redefinida a partir de ADMIN_PASSWORD.');
  }
}

module.exports = { criarPool, migrar, garantirAdmin, CUSTO_BCRYPT };
