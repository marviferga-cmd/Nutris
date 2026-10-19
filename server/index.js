'use strict';

const { criarPool, migrar, garantirAdmin } = require('./db');
const { criarApp } = require('./app');

async function iniciar() {
  const pool = criarPool();
  await migrar(pool);
  await garantirAdmin(pool);

  const porta = Number(process.env.PORT) || 3000;
  const servidor = criarApp(pool).listen(porta, () => {
    console.log(`[nutris] Servidor rodando na porta ${porta}`);
  });

  const encerrar = () => {
    servidor.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch((e) => {
  console.error('[nutris] Falha ao iniciar:', e.message);
  process.exit(1);
});
