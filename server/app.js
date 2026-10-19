'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { CUSTO_BCRYPT } = require('./db');

const COOKIE = 'nutris_sessao';
const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000; // 12 horas
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PACIENTE_RE = /^[a-z0-9]{6,40}$/i;
const SENHA_MIN = 8;

// Usado para que o tempo de resposta do login não revele se o e-mail existe
const HASH_FALSO = bcrypt.hashSync('senha-que-nao-existe', CUSTO_BCRYPT);

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const texto = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const usuarioPublico = (u) => ({
  id: u.id,
  nome: u.nome,
  email: u.email,
  crn: u.crn,
  papel: u.papel,
  status: u.status,
  criadoEm: u.criado_em,
  decididoEm: u.decidido_em,
});

/** Limitador simples em memória, por IP. */
function limitador({ janelaMs, max }) {
  const tentativas = new Map();
  setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of tentativas) if (v.reinicia < agora) tentativas.delete(k);
  }, janelaMs).unref();

  const mw = (req, res, next) => {
    const agora = Date.now();
    const e = tentativas.get(req.ip);
    if (!e || e.reinicia < agora) {
      tentativas.set(req.ip, { n: 1, reinicia: agora + janelaMs });
      return next();
    }
    if (++e.n > max) {
      return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
  };
  mw.limpar = (ip) => tentativas.delete(ip);
  return mw;
}

function criarApp(db) {
  const app = express();
  app.set('trust proxy', 1); // Railway fica atrás de proxy (HTTPS terminado no proxy)
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Proteção CSRF: requisições que alteram dados precisam do cabeçalho customizado
  // (formulários de outros sites não conseguem enviá-lo sem preflight CORS, que não é permitido).
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.get('X-Requested-With') !== 'nutris') {
      return res.status(403).json({ erro: 'Requisição inválida.' });
    }
    res.set('Cache-Control', 'no-store');
    next();
  });

  // ---------- Sessão ----------
  async function criarSessao(req, res, usuarioId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expira = new Date(Date.now() + DURACAO_SESSAO_MS);
    await db.query('DELETE FROM sessoes WHERE expira_em < now()');
    await db.query('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES ($1, $2, $3)', [hashToken(token), usuarioId, expira]);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: DURACAO_SESSAO_MS,
      path: '/',
    });
  }

  async function autenticar(req, res, next) {
    const token = req.cookies[COOKIE];
    if (!token) return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    const { rows } = await db.query(
      `SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = $1 AND s.expira_em > now() AND u.status = 'aprovado'`,
      [hashToken(token)],
    );
    if (!rows.length) {
      res.clearCookie(COOKIE, { path: '/' });
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    req.usuario = rows[0];
    req.tokenHash = hashToken(token);
    next();
  }

  const exigirAdmin = (req, res, next) => (req.usuario.papel === 'admin'
    ? next()
    : res.status(403).json({ erro: 'Acesso restrito ao administrador.' }));

  const contarPendentes = async () => {
    const { rows } = await db.query("SELECT count(*)::int AS n FROM usuarios WHERE status = 'pendente'");
    return rows[0].n;
  };

  // ---------- Saúde ----------
  app.get('/api/saude', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });

  // ---------- Autenticação ----------
  const limiteLogin = limitador({ janelaMs: 15 * 60 * 1000, max: 10 });
  const limiteCadastro = limitador({ janelaMs: 60 * 60 * 1000, max: 5 });

  app.post('/api/auth/login', limiteLogin, async (req, res) => {
    const email = texto(req.body?.email).toLowerCase();
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const u = rows[0];
    const confere = await bcrypt.compare(senha, u ? u.senha_hash : HASH_FALSO);
    if (!u || !confere) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

    const mensagens = {
      pendente: 'Seu cadastro ainda aguarda aprovação do administrador.',
      rejeitado: 'Sua solicitação de acesso não foi aprovada. Fale com o administrador da clínica.',
      bloqueado: 'Seu acesso está bloqueado. Fale com o administrador da clínica.',
    };
    if (u.status !== 'aprovado') return res.status(403).json({ erro: mensagens[u.status], status: u.status });

    limiteLogin.limpar(req.ip);
    await criarSessao(req, res, u.id);
    res.json({ usuario: usuarioPublico(u), pendentes: u.papel === 'admin' ? await contarPendentes() : 0 });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = req.cookies[COOKIE];
    if (token) await db.query('DELETE FROM sessoes WHERE token_hash = $1', [hashToken(token)]);
    res.clearCookie(COOKIE, { path: '/' });
    res.status(204).end();
  });

  app.get('/api/auth/me', autenticar, async (req, res) => {
    res.json({
      usuario: usuarioPublico(req.usuario),
      pendentes: req.usuario.papel === 'admin' ? await contarPendentes() : 0,
    });
  });

  // Solicitação de acesso: cria o usuário como "pendente" até o admin aprovar
  app.post('/api/auth/cadastro', limiteCadastro, async (req, res) => {
    const nome = texto(req.body?.nome, 120);
    const email = texto(req.body?.email, 200).toLowerCase();
    const crn = texto(req.body?.crn, 40);
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

    if (!nome) return res.status(400).json({ erro: 'Informe seu nome.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    if (senha.length < SENHA_MIN) return res.status(400).json({ erro: `A senha deve ter pelo menos ${SENHA_MIN} caracteres.` });
    if (senha.length > 200) return res.status(400).json({ erro: 'Senha muito longa.' });

    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    const { rows } = await db.query('SELECT id, status FROM usuarios WHERE email = $1', [email]);
    if (!rows.length) {
      await db.query('INSERT INTO usuarios (nome, email, senha_hash, crn) VALUES ($1, $2, $3, $4)', [nome, email, hash, crn || null]);
    } else if (rows[0].status === 'rejeitado') {
      // Permite nova solicitação após uma rejeição
      await db.query(
        "UPDATE usuarios SET nome = $1, senha_hash = $2, crn = $3, status = 'pendente', criado_em = now(), decidido_em = NULL, decidido_por = NULL WHERE id = $4",
        [nome, hash, crn || null, rows[0].id],
      );
    }
    // Mesma resposta mesmo se o e-mail já existir (não revela quem tem cadastro)
    res.status(201).json({ mensagem: 'Solicitação enviada! Você poderá entrar assim que o administrador aprovar seu acesso.' });
  });

  app.post('/api/auth/senha', autenticar, async (req, res) => {
    const atual = typeof req.body?.atual === 'string' ? req.body.atual : '';
    const nova = typeof req.body?.nova === 'string' ? req.body.nova : '';
    if (!(await bcrypt.compare(atual, req.usuario.senha_hash))) return res.status(400).json({ erro: 'Senha atual incorreta.' });
    if (nova.length < SENHA_MIN || nova.length > 200) return res.status(400).json({ erro: `A nova senha deve ter pelo menos ${SENHA_MIN} caracteres.` });
    const hash = await bcrypt.hash(nova, CUSTO_BCRYPT);
    await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.usuario.id]);
    // Encerra as outras sessões do usuário
    await db.query('DELETE FROM sessoes WHERE usuario_id = $1 AND token_hash <> $2', [req.usuario.id, req.tokenHash]);
    res.json({ mensagem: 'Senha alterada.' });
  });

  // ---------- Usuários (admin) ----------
  app.get('/api/usuarios', autenticar, exigirAdmin, async (req, res) => {
    const { rows } = await db.query(
      `SELECT * FROM usuarios ORDER BY CASE status WHEN 'pendente' THEN 0 ELSE 1 END, criado_em DESC`,
    );
    res.json(rows.map(usuarioPublico));
  });

  app.patch('/api/usuarios/:id', autenticar, exigirAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Usuário inválido.' });
    if (id === req.usuario.id) return res.status(400).json({ erro: 'Você não pode alterar o seu próprio acesso.' });

    const { status, papel } = req.body || {};
    if (status != null && !['aprovado', 'rejeitado', 'bloqueado'].includes(status)) return res.status(400).json({ erro: 'Status inválido.' });
    if (papel != null && !['admin', 'nutricionista'].includes(papel)) return res.status(400).json({ erro: 'Papel inválido.' });
    if (status == null && papel == null) return res.status(400).json({ erro: 'Nada para alterar.' });

    const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const novo = { status: status ?? rows[0].status, papel: papel ?? rows[0].papel };
    const r = await db.query(
      `UPDATE usuarios SET status = $1, papel = $2,
         decidido_em = CASE WHEN $1 <> status THEN now() ELSE decidido_em END,
         decidido_por = CASE WHEN $1 <> status THEN $3 ELSE decidido_por END
       WHERE id = $4 RETURNING *`,
      [novo.status, novo.papel, req.usuario.id, id],
    );
    if (novo.status !== 'aprovado') await db.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
    res.json(usuarioPublico(r.rows[0]));
  });

  app.post('/api/usuarios/:id/senha', autenticar, exigirAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Usuário inválido.' });
    if (senha.length < SENHA_MIN || senha.length > 200) return res.status(400).json({ erro: `A senha deve ter pelo menos ${SENHA_MIN} caracteres.` });
    const hash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    const r = await db.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, id]);
    if (!r.rowCount) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    await db.query('DELETE FROM sessoes WHERE usuario_id = $1', [id]);
    res.json({ mensagem: 'Senha redefinida.' });
  });

  // ---------- Pacientes ----------
  function validarPaciente(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'Dados do paciente inválidos.';
    if (!ID_PACIENTE_RE.test(p.id || '')) return 'Identificador do paciente inválido.';
    if (!texto(p.nome)) return 'Informe o nome do paciente.';
    if (!['M', 'F'].includes(p.sexo)) return 'Sexo inválido.';
    if (p.avaliacoes != null && !Array.isArray(p.avaliacoes)) return 'Avaliações inválidas.';
    if (p.planos != null && !Array.isArray(p.planos)) return 'Planos inválidos.';
    return null;
  }

  const salvarPaciente = (cliente, p, usuarioId) => cliente.query(
    `INSERT INTO pacientes (id, dados, criado_por, atualizado_por) VALUES ($1, $2, $3, $3)
     ON CONFLICT (id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()`,
    [p.id, JSON.stringify(p), usuarioId],
  );

  app.get('/api/pacientes', autenticar, async (req, res) => {
    const { rows } = await db.query('SELECT dados FROM pacientes ORDER BY atualizado_em DESC');
    res.json(rows.map((r) => r.dados));
  });

  app.put('/api/pacientes/:id', autenticar, async (req, res) => {
    const p = req.body;
    const erro = validarPaciente(p);
    if (erro) return res.status(400).json({ erro });
    if (p.id !== req.params.id) return res.status(400).json({ erro: 'Identificador divergente.' });
    await salvarPaciente(db, p, req.usuario.id);
    res.json({ ok: true });
  });

  app.delete('/api/pacientes/:id', autenticar, async (req, res) => {
    await db.query('DELETE FROM pacientes WHERE id = $1', [req.params.id]);
    res.status(204).end();
  });

  // Importação em lote (backup JSON / dados antigos salvos no navegador) — apenas admin
  app.post('/api/pacientes/importar', autenticar, exigirAdmin, async (req, res) => {
    const lista = req.body?.pacientes;
    if (!Array.isArray(lista)) return res.status(400).json({ erro: 'Envie uma lista de pacientes.' });
    for (const p of lista) {
      const erro = validarPaciente(p);
      if (erro) return res.status(400).json({ erro: `${texto(p?.nome) || 'Paciente'}: ${erro}` });
    }
    const cliente = db.connect ? await db.connect() : db;
    try {
      await cliente.query('BEGIN');
      for (const p of lista) await salvarPaciente(cliente, p, req.usuario.id);
      await cliente.query('COMMIT');
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release?.();
    }
    res.json({ importados: lista.length });
  });

  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  // ---------- Frontend ----------
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Dados muito grandes.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  });

  return app;
}

module.exports = { criarApp };
