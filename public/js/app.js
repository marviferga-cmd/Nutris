'use strict';

/* ============================================================
 * Utilitários
 * ============================================================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const selo = (c) => (c ? `<span class="selo ${c.nivel}">${esc(c.texto)}</span>` : '');
const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).filter(Boolean)
  .filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('').toUpperCase();
const opcoes = (lista, sel, val = (x) => x.id, txt = (x) => x.nome) => lista
  .map((x) => `<option value="${esc(val(x))}" ${String(val(x)) === String(sel ?? '') ? 'selected' : ''}>${esc(txt(x))}</option>`).join('');

function hoje() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visivel');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('visivel'), 2500);
}

const ir = (hash) => { location.hash = hash; };

/* ============================================================
 * API (servidor) e armazenamento
 * ============================================================ */
const Api = {
  async req(metodo, url, corpo) {
    const r = await fetch(url, {
      method: metodo,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'nutris' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const dados = r.status === 204 ? null : await r.json().catch(() => null);
    if (r.status === 401 && Store.usuario && !url.startsWith('/api/auth/')) sessaoExpirada();
    if (!r.ok) {
      const e = new Error(dados?.erro || `Erro ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return dados;
  },
  get: (url) => Api.req('GET', url),
  post: (url, corpo = {}) => Api.req('POST', url, corpo),
  put: (url, corpo) => Api.req('PUT', url, corpo),
  patch: (url, corpo) => Api.req('PATCH', url, corpo),
  del: (url) => Api.req('DELETE', url),
};

/**
 * Pacientes ficam no servidor (PostgreSQL) e são mantidos em cache na memória.
 * Apenas o rascunho do plano alimentar fica no navegador, separado por usuário.
 */
const Store = {
  CHAVE_LEGADA: 'nutris.v1', // dados da versão anterior, que salvava tudo no navegador
  usuario: null,
  pendentes: 0,
  dados: { pacientes: [], rascunhoPlano: null },

  chaveRascunho() { return 'nutris.rascunho.' + this.usuario?.id; },
  async carregar() {
    this.dados.pacientes = await Api.get('/api/pacientes');
    try { this.dados.rascunhoPlano = JSON.parse(localStorage.getItem(this.chaveRascunho())); } catch { this.dados.rascunhoPlano = null; }
  },
  limpar() {
    this.usuario = null;
    this.pendentes = 0;
    this.dados = { pacientes: [], rascunhoPlano: null };
  },
  salvar() {
    try { localStorage.setItem(this.chaveRascunho(), JSON.stringify(this.dados.rascunhoPlano)); } catch { /* rascunho é opcional */ }
  },
  pacientes() { return this.dados.pacientes; },
  paciente(id) { return this.dados.pacientes.find((p) => p.id === id); },
  salvarPaciente(p) {
    const i = this.dados.pacientes.findIndex((x) => x.id === p.id);
    p.atualizadoEm = new Date().toISOString();
    if (i >= 0) this.dados.pacientes[i] = p; else this.dados.pacientes.push(p);
    return Api.put('/api/pacientes/' + encodeURIComponent(p.id), p).catch((e) => {
      toast('Erro ao salvar no servidor: ' + e.message);
      this.recarregar();
    });
  },
  excluirPaciente(id) {
    this.dados.pacientes = this.dados.pacientes.filter((p) => p.id !== id);
    return Api.del('/api/pacientes/' + encodeURIComponent(id)).catch((e) => {
      toast('Erro ao excluir no servidor: ' + e.message);
      this.recarregar();
    });
  },
  async recarregar() {
    try { this.dados.pacientes = await Api.get('/api/pacientes'); rotear(); } catch { /* já sinalizado */ }
  },
  pacientesLegados() {
    try {
      const salvo = JSON.parse(localStorage.getItem(this.CHAVE_LEGADA));
      return Array.isArray(salvo?.pacientes) ? salvo.pacientes : [];
    } catch { return []; }
  },
};

const ehAdmin = () => Store.usuario?.papel === 'admin';

const ultimaAvaliacao = (p) => [...(p?.avaliacoes || [])].sort((a, b) => b.data.localeCompare(a.data))[0];

/* ============================================================
 * Rotas
 * ============================================================ */
const ROTAS = {
  '': viewInicio,
  pacientes: viewPacientes,
  paciente: viewPaciente,
  'paciente-form': viewPacienteForm,
  avaliacao: viewAvaliacao,
  plano: viewPlano,
  dietas: viewDietas,
  dieta: viewDieta,
  receitas: viewReceitas,
  receita: viewReceita,
  alimentos: viewAlimentos,
  usuarios: viewUsuarios,
  conta: viewConta,
};
const ROTAS_PUBLICAS = { login: viewLogin, cadastro: viewCadastro };
const MENU_DE = { '': 'inicio', paciente: 'pacientes', 'paciente-form': 'pacientes', dieta: 'dietas', receita: 'receitas' };

function rotear() {
  const [, nome = '', ...args] = location.hash.split('/');
  document.body.classList.toggle('sem-sessao', !Store.usuario);
  if (!Store.usuario) {
    const app = $('#app');
    app.innerHTML = '';
    const raiz = document.createElement('div');
    raiz.className = 'auth';
    app.appendChild(raiz);
    (ROTAS_PUBLICAS[nome] || viewLogin)(raiz);
    return;
  }
  if (ROTAS_PUBLICAS[nome]) return ir('#/');
  if (nome === 'usuarios' && !ehAdmin()) return ir('#/');
  const view = ROTAS[nome] || viewInicio;
  const menu = MENU_DE[nome] ?? nome;
  $$('#menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === menu));
  const app = $('#app');
  app.innerHTML = '';
  const raiz = document.createElement('div');
  app.appendChild(raiz);
  view(raiz, ...args.map(decodeURIComponent));
  window.scrollTo(0, 0);
}

/* ============================================================
 * Início
 * ============================================================ */
function viewInicio(raiz) {
  const pacs = Store.pacientes();
  const nAval = pacs.reduce((t, p) => t + (p.avaliacoes?.length || 0), 0);
  const recentes = [...pacs].sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || '')).slice(0, 5);

  const legados = ehAdmin() ? Store.pacientesLegados() : [];

  const nPlanos = pacs.reduce((t, p) => t + (p.planos?.length || 0), 0);
  const limite30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const aval30 = pacs.reduce((t, p) => t + (p.avaliacoes || []).filter((a) => a.data >= limite30).length, 0);
  const hojeExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const kpi = (ic, cor, rotulo, valor, detalhe) => `<div class="kpi"><div class="kpi-icone ${cor}">${icone(ic)}</div>
    <div><div class="rotulo">${rotulo}</div><div class="valor">${valor}</div><div class="detalhe">${detalhe}</div></div></div>`;
  const atalho = (href, ic, cor, titulo, desc) => `<a class="atalho" href="${href}"><div class="kpi-icone ${cor}">${icone(ic)}</div>
    <div><strong>${titulo}</strong><span class="desc">${desc}</span></div>${icone('seta')}</a>`;

  raiz.innerHTML = `
    <div class="cabecalho">
      <div>
        <p class="sobretitulo">${esc(hojeExtenso)}</p>
        <h1>Olá, ${esc(Store.usuario.nome.split(' ')[0])}</h1>
        <p class="subtitulo">Acompanhe a sua clínica e comece um novo atendimento.</p>
      </div>
      <div class="acoes"><a class="btn" href="#/paciente-form">${icone('novoPaciente')}Novo paciente</a></div>
    </div>

    ${Store.pendentes ? `<div class="aviso">Há <strong>${Store.pendentes}</strong> solicitação(ões) de acesso aguardando aprovação. <a href="#/usuarios">Revisar agora →</a></div>` : ''}
    ${legados.length ? `<div class="info">
      Encontramos <strong>${legados.length}</strong> paciente(s) salvos neste navegador pela versão anterior do sistema.
      <div class="acoes" style="margin-top:10px">
        <button class="btn btn-sm" id="migrar">${icone('importar')}Enviar para o servidor</button>
        <button class="btn btn-sec btn-sm" id="descartar-legado">Descartar dados do navegador</button>
      </div></div>` : ''}

    <div class="kpis">
      ${kpi('pacientes', '', 'Pacientes', pacs.length, 'cadastrados na clínica')}
      ${kpi('avaliacao', 'azul', 'Avaliações', nAval, `${aval30} nos últimos 30 dias`)}
      ${kpi('plano', 'ambar', 'Planos alimentares', nPlanos, 'salvos nos prontuários')}
      ${kpi('receitas', 'rosa', 'Biblioteca', DIETAS.length + RECEITAS.length, `${DIETAS.length} dietas · ${RECEITAS.length} receitas`)}
    </div>

    <div class="grid grid-3" style="margin-bottom:20px">
      ${atalho('#/avaliacao', 'avaliacao', 'azul', 'Avaliação rápida', 'IMC, % gordura, TMB, GET e macros')}
      ${atalho('#/plano', 'plano', 'ambar', 'Montar plano alimentar', 'Refeições com cálculo automático')}
      ${atalho('#/dietas', 'dietas', '', 'Modelos de dieta', 'Cardápios ajustáveis por kcal')}
    </div>

    <div class="card">
      <div class="card-cab"><h2>Pacientes recentes</h2><a class="btn btn-sec btn-sm" href="#/pacientes">Ver todos${icone('seta')}</a></div>
      ${recentes.length ? tabelaPacientes(recentes) : '<p class="vazio">Nenhum paciente cadastrado ainda. Comece em “Novo paciente”.</p>'}
    </div>`;

  $('#migrar', raiz)?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const r = await Api.post('/api/pacientes/importar', { pacientes: legados });
      localStorage.removeItem(Store.CHAVE_LEGADA);
      await Store.carregar();
      toast(`${r.importados} paciente(s) enviados para o servidor.`);
      rotear();
    } catch (err) {
      e.target.disabled = false;
      toast('Erro na migração: ' + err.message);
    }
  });
  $('#descartar-legado', raiz)?.addEventListener('click', () => {
    if (!confirm('Apagar os pacientes salvos neste navegador? Eles NÃO foram enviados ao servidor.')) return;
    localStorage.removeItem(Store.CHAVE_LEGADA);
    rotear();
  });
}

/* ============================================================
 * Pacientes
 * ============================================================ */
function tabelaPacientes(lista) {
  return `<div class="tabela-wrap"><table>
    <thead><tr><th>Nome</th><th>Idade</th><th>Sexo</th><th>Objetivo</th><th>Última avaliação</th><th class="num">Peso</th><th class="num">IMC</th></tr></thead>
    <tbody>${lista.map((p) => {
    const u = ultimaAvaliacao(p);
    return `<tr data-href="#/paciente/${p.id}">
        <td><div class="pessoa"><span class="avatar sm">${esc(iniciais(p.nome))}</span><strong>${esc(p.nome)}</strong></div></td>
        <td>${fmt(Calc.idade(p.nascimento))}</td>
        <td>${p.sexo === 'M' ? 'Masc.' : 'Fem.'}</td>
        <td>${esc(p.objetivo || '—')}</td>
        <td>${u ? dataBR(u.data) : '<span class="vazio">nenhuma</span>'}</td>
        <td class="num">${u ? fmt(u.resultado.peso, 1) + ' kg' : '—'}</td>
        <td class="num">${u ? fmt(u.resultado.imc, 1) + ' ' + selo(Calc.classificaIMC(u.resultado.imc, Calc.idade(p.nascimento))) : '—'}</td>
      </tr>`;
  }).join('')}</tbody></table></div>`;
}

function viewPacientes(raiz) {
  raiz.innerHTML = `
    <div class="cabecalho">
      <div><h1>Pacientes</h1><p class="subtitulo">${Store.pacientes().length} paciente(s) cadastrado(s)</p></div>
      <a class="btn" href="#/paciente-form">${icone('novoPaciente')}Novo paciente</a>
    </div>
    <div class="card">
      <div class="filtros"><input class="busca" type="search" placeholder="Buscar por nome…" id="busca"></div>
      <div id="lista"></div>
    </div>`;
  const render = () => {
    const q = $('#busca', raiz).value.trim().toLowerCase();
    const lista = Store.pacientes().filter((p) => p.nome.toLowerCase().includes(q)).sort((a, b) => a.nome.localeCompare(b.nome));
    $('#lista', raiz).innerHTML = lista.length ? tabelaPacientes(lista) : '<p class="vazio">Nenhum paciente encontrado.</p>';
  };
  $('#busca', raiz).addEventListener('input', render);
  render();
}

function viewPacienteForm(raiz, id) {
  const p = id ? Store.paciente(id) : null;
  if (id && !p) return ir('#/pacientes');
  const v = p || {};
  raiz.innerHTML = `
    <h1>${p ? 'Editar paciente' : 'Novo paciente'}</h1>
    <p class="subtitulo">Dados cadastrais e anamnese resumida.</p>
    <form class="card" id="form">
      <div class="campos">
        <div class="campo largo"><label>Nome completo *</label><input name="nome" required value="${esc(v.nome)}"></div>
        <div class="campo"><label>Sexo *</label><select name="sexo" required>${opcoes([{ id: 'F', nome: 'Feminino' }, { id: 'M', nome: 'Masculino' }], v.sexo)}</select></div>
        <div class="campo"><label>Data de nascimento *</label><input type="date" name="nascimento" required value="${esc(v.nascimento)}"></div>
        <div class="campo"><label>Telefone</label><input name="telefone" value="${esc(v.telefone)}"></div>
        <div class="campo"><label>E-mail</label><input type="email" name="email" value="${esc(v.email)}"></div>
        <div class="campo largo"><label>Objetivo</label><input name="objetivo" placeholder="Ex.: emagrecimento, hipertrofia, controle glicêmico" value="${esc(v.objetivo)}"></div>
        <div class="campo largo"><label>Patologias / medicamentos</label><textarea name="patologias">${esc(v.patologias)}</textarea></div>
        <div class="campo largo"><label>Alergias / intolerâncias / aversões</label><textarea name="restricoes">${esc(v.restricoes)}</textarea></div>
        <div class="campo largo"><label>Observações (rotina, hábitos, histórico)</label><textarea name="obs">${esc(v.obs)}</textarea></div>
      </div>
      <div class="acoes" style="margin-top:16px">
        <button class="btn" type="submit">${icone('salvar')}Salvar</button>
        <a class="btn btn-sec" href="${p ? '#/paciente/' + p.id : '#/pacientes'}">Cancelar</a>
      </div>
    </form>`;
  $('#form', raiz).addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(e.target));
    const novo = { avaliacoes: [], planos: [], criadoEm: new Date().toISOString(), ...p, ...dados, id: p?.id || uid() };
    Store.salvarPaciente(novo);
    toast('Paciente salvo.');
    ir('#/paciente/' + novo.id);
  });
}

function viewPaciente(raiz, id) {
  const p = Store.paciente(id);
  if (!p) return ir('#/pacientes');
  const avals = [...(p.avaliacoes || [])].sort((a, b) => a.data.localeCompare(b.data));
  const u = avals[avals.length - 1];
  const primeira = avals[0];
  const planos = [...(p.planos || [])].sort((a, b) => b.data.localeCompare(a.data));

  raiz.innerHTML = `
    <div class="cabecalho">
      <div>
        <h1>${esc(p.nome)}</h1>
        <p class="subtitulo">${p.sexo === 'M' ? 'Masculino' : 'Feminino'} · ${fmt(Calc.idade(p.nascimento))} anos · nascido(a) em ${dataBR(p.nascimento)}</p>
      </div>
      <div class="acoes">
        <a class="btn" href="#/avaliacao/${p.id}">${icone('avaliacao')}Nova avaliação</a>
        <button class="btn btn-sec" id="novo-plano">${icone('plano')}Novo plano alimentar</button>
        <a class="btn btn-sec" href="#/paciente-form/${p.id}">${icone('editar')}Editar</a>
        <button class="btn btn-perigo" id="excluir">Excluir</button>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h2>Dados e anamnese</h2>
        <table><tbody>
          <tr><th>Telefone</th><td>${esc(p.telefone || '—')}</td></tr>
          <tr><th>E-mail</th><td>${esc(p.email || '—')}</td></tr>
          <tr><th>Objetivo</th><td>${esc(p.objetivo || '—')}</td></tr>
          <tr><th>Patologias</th><td>${esc(p.patologias || '—')}</td></tr>
          <tr><th>Restrições</th><td>${esc(p.restricoes || '—')}</td></tr>
          <tr><th>Observações</th><td>${esc(p.obs || '—')}</td></tr>
        </tbody></table>
      </div>
      <div class="card">
        <h2>Situação atual ${u ? `<small class="selo neutro">${dataBR(u.data)}</small>` : ''}</h2>
        ${u ? `
          <div class="indicadores">
            <div class="indicador"><div class="rotulo">Peso</div><div class="valor">${fmt(u.resultado.peso, 1)} <small>kg</small></div>
              ${primeira !== u ? `<small>${u.resultado.peso - primeira.resultado.peso >= 0 ? '+' : ''}${fmt(u.resultado.peso - primeira.resultado.peso, 1)} kg desde ${dataBR(primeira.data)}</small>` : ''}</div>
            <div class="indicador"><div class="rotulo">IMC</div><div class="valor">${fmt(u.resultado.imc, 1)}</div><small>${esc(u.resultado.imcClass || '')}</small></div>
            <div class="indicador"><div class="rotulo">% Gordura</div><div class="valor">${fmt(u.resultado.pctGordura, 1)}${u.resultado.pctGordura != null ? '<small>%</small>' : ''}</div></div>
            <div class="indicador"><div class="rotulo">VET (meta)</div><div class="valor">${fmt(u.resultado.vet)} <small>kcal</small></div></div>
          </div>` : '<p class="vazio">Nenhuma avaliação registrada. Clique em “Nova avaliação”.</p>'}
      </div>
    </div>

    <div class="card">
      <h2>Histórico de avaliações</h2>
      ${avals.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Data</th><th class="num">Peso (kg)</th><th class="num">Δ peso</th><th class="num">IMC</th><th class="num">% G</th><th class="num">M. magra (kg)</th><th class="num">Cintura (cm)</th><th class="num">GET</th><th class="num">VET</th><th></th></tr></thead>
        <tbody>${avals.map((a, i) => {
    const r = a.resultado;
    const delta = i > 0 ? r.peso - avals[i - 1].resultado.peso : null;
    return `<tr>
            <td>${dataBR(a.data)}</td>
            <td class="num">${fmt(r.peso, 1)}</td>
            <td class="num">${delta == null ? '—' : (delta >= 0 ? '+' : '') + fmt(delta, 1)}</td>
            <td class="num">${fmt(r.imc, 1)}</td>
            <td class="num">${fmt(r.pctGordura, 1)}</td>
            <td class="num">${fmt(r.massaMagra, 1)}</td>
            <td class="num">${fmt(r.cintura, 1)}</td>
            <td class="num">${fmt(r.get)}</td>
            <td class="num">${fmt(r.vet)}</td>
            <td class="num"><div class="acoes" style="justify-content:flex-end">
              <a class="btn btn-sec btn-sm" href="#/avaliacao/${p.id}/${a.id}">Abrir</a>
              <button class="btn-x" data-excluir-aval="${a.id}" title="Excluir">${icone('lixeira')}</button></div></td>
          </tr>`;
  }).join('')}</tbody></table></div>` : '<p class="vazio">Sem avaliações.</p>'}
    </div>

    <div class="card">
      <h2>Planos alimentares</h2>
      ${planos.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Data</th><th>Nome</th><th class="num">Calorias</th><th class="num">Refeições</th><th></th></tr></thead>
        <tbody>${planos.map((pl) => `<tr>
          <td>${dataBR(pl.data)}</td><td>${esc(pl.nome)}</td>
          <td class="num">${fmt(totaisPlano(pl).kcal)} kcal</td>
          <td class="num">${pl.refeicoes.length}</td>
          <td class="num"><div class="acoes" style="justify-content:flex-end">
            <button class="btn btn-sec btn-sm" data-abrir-plano="${pl.id}">Abrir</button>
            <button class="btn-x" data-excluir-plano="${pl.id}" title="Excluir">${icone('lixeira')}</button></div></td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="vazio">Nenhum plano salvo.</p>'}
    </div>`;

  $('#excluir', raiz).onclick = () => {
    if (!confirm(`Excluir o paciente "${p.nome}" e todo o seu histórico?`)) return;
    Store.excluirPaciente(p.id);
    toast('Paciente excluído.');
    ir('#/pacientes');
  };
  $('#novo-plano', raiz).onclick = () => {
    Store.dados.rascunhoPlano = novoPlano(p.id);
    Store.salvar();
    ir('#/plano');
  };
  raiz.addEventListener('click', (e) => {
    const t = e.target.closest('[data-excluir-aval],[data-excluir-plano],[data-abrir-plano]');
    if (!t) return;
    if (t.dataset.excluirAval && confirm('Excluir esta avaliação?')) {
      p.avaliacoes = p.avaliacoes.filter((a) => a.id !== t.dataset.excluirAval);
      Store.salvarPaciente(p); rotear();
    } else if (t.dataset.excluirPlano && confirm('Excluir este plano alimentar?')) {
      p.planos = p.planos.filter((x) => x.id !== t.dataset.excluirPlano);
      Store.salvarPaciente(p); rotear();
    } else if (t.dataset.abrirPlano) {
      const pl = p.planos.find((x) => x.id === t.dataset.abrirPlano);
      Store.dados.rascunhoPlano = structuredClone({ ...pl, pacienteId: p.id });
      Store.salvar();
      ir('#/plano');
    }
  });
}

/* ============================================================
 * Avaliação e cálculos
 * ============================================================ */
const PADRAO_AVALIACAO = {
  protocolo: 'pollock3', formula: 'mifflin', atividade: 'leve', injuria: 'nenhum',
  pesoCalculo: 'atual', objetivo: 'manter', protGkg: '1.2', lipPct: '30',
};

function viewAvaliacao(raiz, pid, aid) {
  const pac = pid ? Store.paciente(pid) : null;
  const salva = pac && aid ? pac.avaliacoes.find((a) => a.id === aid) : null;
  const ant = pac ? ultimaAvaliacao(pac) : null;
  const v = {
    ...PADRAO_AVALIACAO,
    ...(ant ? { altura: ant.entrada.altura, atividade: ant.entrada.atividade, formula: ant.entrada.formula, objetivo: ant.entrada.objetivo } : {}),
    ...(pac ? { sexo: pac.sexo, idade: Calc.idade(pac.nascimento) } : {}),
    ...(salva ? salva.entrada : {}),
    data: salva?.data || hoje(),
  };

  const campo = (nome, rotulo, extra = '') => `<div class="campo"><label for="f-${nome}">${rotulo}</label>
    <input id="f-${nome}" name="${nome}" type="number" step="any" min="0" value="${esc(v[nome])}" ${extra}></div>`;

  const formulas = [...Object.entries(Calc.FORMULAS_TMB).map(([id, f]) => ({ id, nome: f.nome })), { id: 'iom', nome: 'EER — IOM/DRI 2005 (GET direto, ≥ 19 anos)' }];

  raiz.innerHTML = `
    <div class="cabecalho">
      <div>
        <h1>Avaliação nutricional</h1>
        <p class="subtitulo">${salva ? `Avaliação de ${dataBR(salva.data)} — ${esc(pac.nome)}` : 'Antropometria, composição corporal, gasto energético e distribuição de macronutrientes.'}</p>
      </div>
    </div>
    <div class="layout-avaliacao">
      <form class="card" id="form" autocomplete="off">
        <div class="campos" style="margin-bottom:14px">
          <div class="campo largo"><label>Paciente</label>
            <select name="paciente" id="sel-paciente"><option value="">— Cálculo avulso (sem salvar) —</option>${opcoes(Store.pacientes(), pac?.id)}</select></div>
          <div class="campo"><label>Data</label><input type="date" name="data" value="${esc(v.data)}"></div>
          <div class="campo"><label>Sexo</label><select name="sexo"><option value="">—</option>${opcoes([{ id: 'F', nome: 'Feminino' }, { id: 'M', nome: 'Masculino' }], v.sexo)}</select></div>
          ${campo('idade', 'Idade (anos)')}
          ${campo('peso', 'Peso (kg)')}
          ${campo('altura', 'Altura (cm)')}
        </div>

        <fieldset><legend>Circunferências (cm)</legend><div class="campos">
          ${campo('cintura', 'Cintura')}${campo('quadril', 'Quadril')}${campo('braco', 'Braço')}${campo('panturrilha', 'Panturrilha')}
        </div></fieldset>

        <fieldset><legend>Dobras cutâneas (mm)</legend>
          <div class="campo" style="margin-bottom:10px"><label>Protocolo</label>
            <select name="protocolo">${opcoes(Object.entries(Calc.PROTOCOLOS_DOBRAS).map(([id, p]) => ({ id, nome: p.nome })), v.protocolo)}</select></div>
          <div class="campos">${Object.entries(Calc.NOMES_DOBRAS).map(([k, n]) => campo('dc_' + k, n)).join('')}</div>
          <p class="ajuda" id="ajuda-dobras"></p>
        </fieldset>

        <fieldset><legend>Gasto energético</legend><div class="campos">
          <div class="campo largo"><label>Fórmula de referência</label><select name="formula">${opcoes(formulas, v.formula)}</select></div>
          <div class="campo largo"><label>Nível de atividade física</label><select name="atividade">${opcoes(Calc.NIVEIS_ATIVIDADE, v.atividade, (x) => x.id, (x) => `${x.nome} — FA ${x.fa}`)}</select></div>
          <div class="campo largo"><label>Fator injúria / estresse</label><select name="injuria">${opcoes(Calc.FATORES_INJURIA, v.injuria, (x) => x.id, (x) => `${x.nome} — ${x.f}`)}</select></div>
          <div class="campo largo"><label>Peso usado nos cálculos</label><select name="pesoCalculo">${opcoes([
    { id: 'atual', nome: 'Peso atual' }, { id: 'ideal', nome: 'Peso ideal (IMC médio)' }, { id: 'ajustado', nome: 'Peso ajustado (obesidade, IMC ≥ 30)' }], v.pesoCalculo)}</select></div>
          <div class="campo largo"><label>Objetivo</label><select name="objetivo">${opcoes(Calc.OBJETIVOS, v.objetivo)}</select></div>
        </div></fieldset>

        <fieldset><legend>Macronutrientes</legend><div class="campos">
          ${campo('protGkg', 'Proteína (g/kg)')}
          ${campo('lipPct', 'Lipídios (% VET)')}
        </div>
        <p class="ajuda">Carboidratos = calorias restantes. Referências: proteína 0,8 g/kg (sedentário) · 1,2–1,6 (emagrecimento/idoso) · 1,6–2,2 (hipertrofia). Lipídios 20–35% (DRI).</p>
        </fieldset>

        <div class="campo largo" style="margin-bottom:14px"><label>Observações da consulta</label><textarea name="obs">${esc(v.obs)}</textarea></div>

        <div class="acoes">
          <button class="btn" type="submit" id="btn-salvar">${icone('salvar')}Salvar avaliação</button>
          <button class="btn btn-sec" type="button" id="btn-plano">${icone('plano')}Gerar plano com esta meta</button>
          <button class="btn btn-sec" type="button" data-imprimir>${icone('imprimir')}Imprimir</button>
        </div>
      </form>
      <div class="resultados" id="resultados"></div>
    </div>`;

  const form = $('#form', raiz);
  let resultado = null;

  const atualizar = () => {
    const d = Object.fromEntries(new FormData(form));
    resultado = Calc.avaliar(d);
    $('#resultados', raiz).innerHTML = htmlResultados(resultado, d);
    const prot = Calc.PROTOCOLOS_DOBRAS[d.protocolo];
    $('#ajuda-dobras', raiz).textContent = d.sexo
      ? 'Dobras usadas neste protocolo: ' + prot.dobras(d.sexo).map((k) => Calc.NOMES_DOBRAS[k]).join(', ') + '.'
      : 'Selecione o sexo para ver as dobras do protocolo.';
    $('#btn-salvar', raiz).disabled = !d.paciente;
    $('#btn-salvar', raiz).title = d.paciente ? '' : 'Selecione um paciente para salvar';
    $('#btn-salvar', raiz).style.opacity = d.paciente ? 1 : 0.5;
  };

  form.addEventListener('input', atualizar);
  $('#sel-paciente', raiz).addEventListener('change', (e) => {
    const p = Store.paciente(e.target.value);
    if (p) {
      form.elements.sexo.value = p.sexo;
      form.elements.idade.value = Calc.idade(p.nascimento) ?? '';
      const a = ultimaAvaliacao(p);
      if (a && !form.elements.altura.value) form.elements.altura.value = a.entrada.altura ?? '';
    }
    atualizar();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const p = Store.paciente(d.paciente);
    if (!p) return toast('Selecione um paciente para salvar.');
    if (!resultado?.imc) return toast('Informe ao menos sexo, idade, peso e altura.');
    const { paciente, data, ...entrada } = d;
    const r = resultado;
    const aval = {
      id: salva && salva.id && pac?.id === p.id ? salva.id : uid(),
      data: data || hoje(),
      entrada,
      resultado: {
        peso: r.peso, altura: r.altura, imc: r.imc, imcClass: r.imcClass?.texto,
        pctGordura: r.composicao?.pctGordura ?? null, massaMagra: r.composicao?.massaMagra ?? null,
        massaGorda: r.composicao?.massaGorda ?? null, cintura: +entrada.cintura || null,
        formula: r.formula, tmb: r.tmb, get: r.get, vet: r.vet,
        macros: r.macros ? { p: r.macros.proteina.g, c: r.macros.carboidrato.g, l: r.macros.lipidio.g } : null,
        agua: r.agua, fibras: r.fibras,
      },
    };
    p.avaliacoes = (p.avaliacoes || []).filter((a) => a.id !== aval.id).concat(aval);
    Store.salvarPaciente(p);
    toast('Avaliação salva.');
    ir('#/paciente/' + p.id);
  });

  $('#btn-plano', raiz).onclick = () => {
    if (!resultado?.vet) return toast('Complete os dados para calcular o VET.');
    const d = Object.fromEntries(new FormData(form));
    const plano = novoPlano(d.paciente || '');
    plano.meta = metaDeResultado(resultado);
    Store.dados.rascunhoPlano = plano;
    Store.salvar();
    ir('#/plano');
  };

  atualizar();
}

function htmlResultados(r, d) {
  if (!r.sexo || !r.peso || !r.altura || r.idade == null) {
    return '<div class="card"><h2>Resultados</h2><p class="vazio">Preencha sexo, idade, peso e altura para ver os cálculos.</p></div>';
  }
  const c = r.composicao;
  const m = r.macros;
  const pi = r.pesoIdeal;

  const linhaMacro = (nome, x) => `<tr><td>${nome}</td><td class="num">${fmt(x.g)} g</td><td class="num">${fmt(x.kcal)}</td><td class="num">${fmt(x.pct, 1)}%</td><td class="num">${fmt(x.gkg, 2)}</td></tr>`;

  return `
  <div class="card">
    <h2>Resumo</h2>
    <div class="indicadores">
      <div class="indicador"><div class="rotulo">IMC</div><div class="valor">${fmt(r.imc, 1)} <small>kg/m²</small></div>${selo(r.imcClass)}</div>
      <div class="indicador"><div class="rotulo">% Gordura</div><div class="valor">${c ? fmt(c.pctGordura, 1) + '<small>%</small>' : '—'}</div>${c ? selo(r.gorduraClass) : '<small class="vazio">informe as dobras</small>'}</div>
      <div class="indicador"><div class="rotulo">GET</div><div class="valor">${fmt(r.get)} <small>kcal</small></div><small>${esc(r.formula || '')}</small></div>
      <div class="indicador"><div class="rotulo">VET (meta)</div><div class="valor">${fmt(r.vet)} <small>kcal</small></div><small>${esc(r.objetivo)}</small></div>
    </div>
    ${r.alertaVet ? '<div class="aviso">O VET ficou abaixo da TMB. Reavalie o déficit calórico.</div>' : ''}
  </div>

  <div class="card">
    <h2>Antropometria</h2>
    <table><tbody>
      <tr><th>IMC</th><td>${fmt(r.imc, 2)} kg/m² ${selo(r.imcClass)}</td></tr>
      <tr><th>Faixa de peso saudável</th><td>${fmt(pi.min, 1)} – ${fmt(pi.max, 1)} kg <span class="medida">(IMC 18,5–24,9)</span></td></tr>
      <tr><th>Peso ideal</th><td>${fmt(pi.ideal, 1)} kg <span class="medida">(IMC ${pi.imcMedio})</span></td></tr>
      ${r.pesoAjustado ? `<tr><th>Peso ajustado</th><td>${fmt(r.pesoAjustado, 1)} kg <span class="medida">(PA − PI) × 0,25 + PI</span></td></tr>` : ''}
      <tr><th>Peso usado nos cálculos</th><td><strong>${fmt(r.pesoCalculo, 1)} kg</strong></td></tr>
      <tr><th>Circunferência da cintura</th><td>${d.cintura ? fmt(+d.cintura, 1) + ' cm ' + selo(r.cintura) : '<span class="vazio">não informada</span>'}</td></tr>
      <tr><th>Relação cintura/quadril</th><td>${r.rcq ? fmt(r.rcq.valor, 2) + ' ' + selo(r.rcq.class) : '<span class="vazio">informe cintura e quadril</span>'}</td></tr>
      <tr><th>Relação cintura/estatura</th><td>${r.rcest ? fmt(r.rcest.valor, 2) + ' ' + selo(r.rcest.class) : '<span class="vazio">informe a cintura</span>'}</td></tr>
    </tbody></table>
  </div>

  <div class="card">
    <h2>Composição corporal</h2>
    ${c ? `<table><tbody>
      <tr><th>Protocolo</th><td>${esc(c.protocolo)} + equação de Siri</td></tr>
      <tr><th>Soma das dobras</th><td>${fmt(c.somaDobras, 1)} mm</td></tr>
      <tr><th>Densidade corporal</th><td>${fmt(c.densidade, 4)} g/cm³</td></tr>
      <tr><th>% Gordura</th><td><strong>${fmt(c.pctGordura, 1)}%</strong> ${selo(r.gorduraClass)}</td></tr>
      <tr><th>Massa gorda</th><td>${fmt(c.massaGorda, 1)} kg</td></tr>
      <tr><th>Massa livre de gordura</th><td>${fmt(c.massaMagra, 1)} kg</td></tr>
    </tbody></table>` : '<p class="vazio">Preencha as dobras cutâneas do protocolo selecionado.</p>'}
  </div>

  <div class="card">
    <h2>Gasto energético</h2>
    <p class="ajuda" style="margin:0 0 8px">GET = TMB × FA (${fmt(r.fa, 3)}) × FI (${fmt(r.fi, 2)}) · peso de ${fmt(r.pesoCalculo, 1)} kg</p>
    <div class="tabela-wrap"><table>
      <thead><tr><th>Fórmula</th><th class="num">TMB (kcal)</th><th class="num">GET (kcal)</th></tr></thead>
      <tbody>
        ${r.tmbs.map((t) => `<tr class="${d.formula === t.id ? 'destaque' : ''}"><td>${esc(t.nome)}</td><td class="num">${fmt(t.tmb)}</td><td class="num">${fmt(t.get)}</td></tr>`).join('')}
        <tr class="${d.formula === 'iom' ? 'destaque' : ''}"><td>EER — IOM/DRI (2005)</td><td class="num">—</td><td class="num">${fmt(r.eer != null ? r.eer * r.fi : null)}</td></tr>
      </tbody>
    </table></div>
    ${r.regraBolso ? `<h3>Regra de bolso (kcal/kg)</h3>
    <table><tbody>
      <tr><th>Perda de peso (20–25 kcal/kg)</th><td class="num">${fmt(r.regraBolso.perda[0])} – ${fmt(r.regraBolso.perda[1])} kcal</td></tr>
      <tr><th>Manutenção (25–30 kcal/kg)</th><td class="num">${fmt(r.regraBolso.manter[0])} – ${fmt(r.regraBolso.manter[1])} kcal</td></tr>
      <tr><th>Ganho de peso (30–35 kcal/kg)</th><td class="num">${fmt(r.regraBolso.ganho[0])} – ${fmt(r.regraBolso.ganho[1])} kcal</td></tr>
    </tbody></table>` : ''}
  </div>

  <div class="card">
    <h2>Distribuição de macronutrientes ${r.vet ? `<small class="selo neutro">${fmt(r.vet)} kcal</small>` : ''}</h2>
    ${m ? `
      <div class="macro-barra">
        <span class="cor-c" style="width:${Math.max(0, m.carboidrato.pct)}%"></span>
        <span class="cor-p" style="width:${m.proteina.pct}%"></span>
        <span class="cor-l" style="width:${m.lipidio.pct}%"></span>
      </div>
      <div class="legenda"><span><i class="cor-c"></i>Carboidratos</span><span><i class="cor-p"></i>Proteínas</span><span><i class="cor-l"></i>Lipídios</span></div>
      <div class="tabela-wrap"><table style="margin-top:10px">
        <thead><tr><th>Nutriente</th><th class="num">Gramas</th><th class="num">kcal</th><th class="num">% VET</th><th class="num">g/kg</th></tr></thead>
        <tbody>${linhaMacro('Carboidratos', m.carboidrato)}${linhaMacro('Proteínas', m.proteina)}${linhaMacro('Lipídios', m.lipidio)}</tbody>
      </table></div>
      ${m.carboidrato.pct < 26 ? '<div class="aviso">Carboidratos abaixo de 26% do VET (padrão low carb). Verifique se é intencional.</div>' : ''}
      ${m.carboidrato.pct > 65 ? '<div class="aviso">Carboidratos acima de 65% do VET (acima da faixa da DRI de 45–65%).</div>' : ''}
      <h3>Hidratação e fibras</h3>
      <table><tbody>
        <tr><th>Água</th><td>${fmt(r.agua / 1000, 1)} L/dia <span class="medida">(${r.idade >= 65 ? 30 : 35} ml/kg)</span></td></tr>
        <tr><th>Fibras</th><td>${fmt(r.fibras)} g/dia <span class="medida">(14 g/1000 kcal; mín. 25 g)</span></td></tr>
      </tbody></table>` : '<p class="vazio">Complete os dados para calcular o VET.</p>'}
  </div>`;
}

/* ============================================================
 * Plano alimentar
 * ============================================================ */
const REFEICOES_PADRAO = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];

function metaDeResultado(r) {
  return {
    kcal: Math.round(r.vet),
    p: r.macros ? Math.round(r.macros.proteina.g) : null,
    c: r.macros ? Math.round(r.macros.carboidrato.g) : null,
    l: r.macros ? Math.round(r.macros.lipidio.g) : null,
    f: r.fibras ? Math.round(r.fibras) : null,
  };
}

function metaDoPaciente(p) {
  const u = ultimaAvaliacao(p);
  if (!u?.resultado?.vet) return { kcal: null, p: null, c: null, l: null, f: null };
  const r = u.resultado;
  const arred = (v) => (v == null || isNaN(v) ? null : Math.round(v));
  return { kcal: arred(r.vet), p: arred(r.macros?.p), c: arred(r.macros?.c), l: arred(r.macros?.l), f: arred(r.fibras) };
}

function novoPlano(pacienteId = '') {
  const p = Store.paciente(pacienteId);
  return {
    id: null,
    pacienteId,
    nome: 'Plano alimentar',
    data: hoje(),
    meta: p ? metaDoPaciente(p) : { kcal: null, p: null, c: null, l: null, f: null },
    refeicoes: REFEICOES_PADRAO.map((nome) => ({ nome, itens: [] })),
    obs: '',
  };
}

const totaisRefeicao = (r) => Nutri.somar(r.itens.map((i) => [i.id, i.g]));
const totaisPlano = (pl) => Nutri.somar(pl.refeicoes.flatMap((r) => r.itens.map((i) => [i.id, i.g])));

function viewPlano(raiz) {
  if (!Store.dados.rascunhoPlano) Store.dados.rascunhoPlano = novoPlano();
  const plano = Store.dados.rascunhoPlano;
  const salvar = () => Store.salvar();

  const render = () => {
    const pac = Store.paciente(plano.pacienteId);
    const tot = totaisPlano(plano);
    const pct = Nutri.pctMacros(tot);
    const meta = plano.meta || {};

    const linhaMeta = (rot, valor, alvo, un) => {
      const p = alvo ? valor / alvo * 100 : 0;
      return `<div class="meta-linha"><span>${rot}</span>
        <div class="barra ${p > 105 ? 'excesso' : ''}"><span style="width:${Math.min(100, p)}%"></span></div>
        <span class="num">${fmt(valor)}${alvo ? ' / ' + fmt(alvo) : ''} ${un}${alvo ? ` <small>(${fmt(p)}%)</small>` : ''}</span></div>`;
    };

    raiz.innerHTML = `
      <div class="cabecalho">
        <div><h1>Plano alimentar</h1><p class="subtitulo">${pac ? esc(pac.nome) : 'Sem paciente vinculado'} · ${dataBR(plano.data)}</p></div>
        <div class="acoes nao-imprimir">
          <button class="btn" data-acao="salvar">${icone('salvar')}Salvar no paciente</button>
          <button class="btn btn-sec" data-imprimir>${icone('imprimir')}Imprimir</button>
          <button class="btn btn-perigo" data-acao="limpar">Novo / limpar</button>
        </div>
      </div>

      <div class="so-impressao">
        <p><strong>Paciente:</strong> ${esc(pac?.nome || '________________')} &nbsp; <strong>Data:</strong> ${dataBR(plano.data)}</p>
      </div>

      <div class="card nao-imprimir">
        <div class="campos">
          <div class="campo"><label>Paciente</label><select data-campo="pacienteId"><option value="">— Nenhum —</option>${opcoes(Store.pacientes(), plano.pacienteId)}</select></div>
          <div class="campo"><label>Nome do plano</label><input data-campo="nome" value="${esc(plano.nome)}"></div>
          <div class="campo"><label>Data</label><input type="date" data-campo="data" value="${esc(plano.data)}"></div>
        </div>
        <h3>Metas diárias</h3>
        <div class="campos">
          <div class="campo"><label>Energia (kcal)</label><input type="number" data-meta="kcal" value="${esc(meta.kcal)}"></div>
          <div class="campo"><label>Proteínas (g)</label><input type="number" data-meta="p" value="${esc(meta.p)}"></div>
          <div class="campo"><label>Carboidratos (g)</label><input type="number" data-meta="c" value="${esc(meta.c)}"></div>
          <div class="campo"><label>Lipídios (g)</label><input type="number" data-meta="l" value="${esc(meta.l)}"></div>
          <div class="campo"><label>Fibras (g)</label><input type="number" data-meta="f" value="${esc(meta.f)}"></div>
        </div>
        <div class="acoes" style="margin-top:12px">
          ${pac ? '<button class="btn btn-sec" data-acao="meta-paciente">Usar meta da última avaliação</button>' : ''}
          <select id="sel-dieta" style="width:auto"><option value="">Carregar modelo de dieta…</option>${opcoes(DIETAS, '')}</select>
          <button class="btn btn-sec" data-acao="carregar-dieta">Carregar ajustado à meta</button>
        </div>
      </div>

      <div class="card">
        <h2>Totais do dia</h2>
        ${linhaMeta('Energia', tot.kcal, meta.kcal, 'kcal')}
        ${linhaMeta('Proteínas', tot.p, meta.p, 'g')}
        ${linhaMeta('Carboidratos', tot.c, meta.c, 'g')}
        ${linhaMeta('Lipídios', tot.l, meta.l, 'g')}
        ${linhaMeta('Fibras', tot.f, meta.f, 'g')}
        ${tot.kcal > 0 ? `<div class="macro-barra" style="margin-top:12px">
          <span class="cor-c" style="width:${pct.c}%"></span><span class="cor-p" style="width:${pct.p}%"></span><span class="cor-l" style="width:${pct.l}%"></span></div>
          <div class="legenda"><span><i class="cor-c"></i>Carboidratos ${fmt(pct.c)}%</span><span><i class="cor-p"></i>Proteínas ${fmt(pct.p)}%</span><span><i class="cor-l"></i>Lipídios ${fmt(pct.l)}%</span>
          ${pac ? `<span>· ${fmt(tot.p / (ultimaAvaliacao(pac)?.resultado.peso || 1), 2)} g/kg de proteína</span>` : ''}</div>` : ''}
      </div>

      <datalist id="lista-alimentos">${ALIMENTOS.map((a) => `<option value="${esc(a.nome)}">`).join('')}</datalist>

      ${plano.refeicoes.map((r, ri) => {
    const t = totaisRefeicao(r);
    return `<div class="refeicao">
          <div class="refeicao-cab">
            <input data-ref-nome="${ri}" value="${esc(r.nome)}">
            <span class="medida">${fmt(t.kcal)} kcal · P ${fmt(t.p)} g · C ${fmt(t.c)} g · L ${fmt(t.l)} g</span>
            <button class="btn-x" data-rem-ref="${ri}" title="Remover refeição">${icone('lixeira')}</button>
          </div>
          ${r.itens.length ? `<div class="tabela-wrap"><table>
            <thead><tr><th>Alimento</th><th>Medida caseira</th><th class="num">Qtd (g)</th><th class="num">kcal</th><th class="num">P</th><th class="num">C</th><th class="num">L</th><th></th></tr></thead>
            <tbody>${r.itens.map((it, ii) => {
      const a = ALIMENTO_POR_ID[it.id];
      const n = Nutri.doItem(it.id, it.g);
      return `<tr>
                <td>${esc(a?.nome || it.id)}</td>
                <td class="medida">${esc(Nutri.medidaCaseira(it.id, it.g))}</td>
                <td class="num"><input type="number" min="0" step="5" value="${it.g}" data-qtd="${ri}:${ii}"></td>
                <td class="num">${fmt(n.kcal)}</td><td class="num">${fmt(n.p, 1)}</td><td class="num">${fmt(n.c, 1)}</td><td class="num">${fmt(n.l, 1)}</td>
                <td class="num"><button class="btn-x" data-rem-item="${ri}:${ii}" title="Remover">${icone('fechar')}</button></td>
              </tr>`;
    }).join('')}</tbody></table></div>` : ''}
          <div class="add-item">
            <input list="lista-alimentos" placeholder="Adicionar alimento…" data-add-nome="${ri}">
            <input type="number" min="0" step="5" placeholder="g" data-add-g="${ri}">
            <button class="btn btn-sec btn-sm" data-add="${ri}">Adicionar</button>
          </div>
        </div>`;
  }).join('')}

      <div class="acoes nao-imprimir" style="margin-bottom:18px"><button class="btn btn-sec" data-acao="add-ref">${icone('mais')}Adicionar refeição</button></div>

      <div class="card">
        <h2>Orientações</h2>
        <textarea data-campo="obs" style="min-height:110px" placeholder="Ex.: beber 2,5 L de água/dia; temperar com ervas naturais; substituições permitidas…">${esc(plano.obs)}</textarea>
      </div>`;
  };

  const adicionar = (ri) => {
    const nome = $(`[data-add-nome="${ri}"]`, raiz).value.trim();
    const a = ALIMENTOS.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
    if (!a) return toast('Escolha um alimento da lista.');
    const g = +$(`[data-add-g="${ri}"]`, raiz).value || a.med?.[1] || 100;
    plano.refeicoes[ri].itens.push({ id: a.id, g });
    salvar(); render();
    $(`[data-add-nome="${ri}"]`, raiz)?.focus();
  };

  raiz.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const ds = t.dataset;
    if (ds.add != null) return adicionar(+ds.add);
    if (ds.remItem) {
      const [ri, ii] = ds.remItem.split(':').map(Number);
      plano.refeicoes[ri].itens.splice(ii, 1);
    } else if (ds.remRef != null) {
      const r = plano.refeicoes[+ds.remRef];
      if (r.itens.length && !confirm(`Remover a refeição "${r.nome}"?`)) return;
      plano.refeicoes.splice(+ds.remRef, 1);
    } else if (ds.acao === 'add-ref') {
      plano.refeicoes.push({ nome: 'Nova refeição', itens: [] });
    } else if (ds.acao === 'meta-paciente') {
      plano.meta = metaDoPaciente(Store.paciente(plano.pacienteId));
      if (!plano.meta.kcal) toast('O paciente ainda não tem avaliação com VET.');
    } else if (ds.acao === 'carregar-dieta') {
      const dieta = DIETA_POR_ID[$('#sel-dieta', raiz).value];
      if (!dieta) return toast('Selecione um modelo de dieta.');
      const temItens = plano.refeicoes.some((r) => r.itens.length);
      if (temItens && !confirm('Substituir as refeições atuais pelo modelo?')) return;
      aplicarDieta(plano, dieta);
      toast(`Modelo "${dieta.nome}" carregado.`);
    } else if (ds.acao === 'limpar') {
      if (!confirm('Começar um novo plano? As alterações não salvas serão perdidas.')) return;
      Object.assign(plano, novoPlano(plano.pacienteId));
    } else if (ds.acao === 'salvar') {
      const p = Store.paciente(plano.pacienteId);
      if (!p) return toast('Selecione um paciente para salvar o plano.');
      plano.id = plano.id || uid();
      const { pacienteId, ...dados } = structuredClone(plano);
      p.planos = (p.planos || []).filter((x) => x.id !== plano.id).concat(dados);
      Store.salvarPaciente(p);
      toast('Plano salvo no paciente.');
      return;
    } else return;
    salvar(); render();
  });

  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target.dataset.addNome != null || e.target.dataset.addG != null)) {
      e.preventDefault();
      adicionar(+(e.target.dataset.addNome ?? e.target.dataset.addG));
    }
  });

  // Edição de texto sem re-renderizar (mantém o foco)
  raiz.addEventListener('input', (e) => {
    const ds = e.target.dataset;
    if (ds.campo === 'nome' || ds.campo === 'obs' || ds.campo === 'data') plano[ds.campo] = e.target.value;
    else if (ds.refNome != null) plano.refeicoes[+ds.refNome].nome = e.target.value;
    else return;
    salvar();
  });

  // Alterações numéricas recalculam ao confirmar (change)
  raiz.addEventListener('change', (e) => {
    const ds = e.target.dataset;
    if (ds.qtd) {
      const [ri, ii] = ds.qtd.split(':').map(Number);
      plano.refeicoes[ri].itens[ii].g = Math.max(0, +e.target.value || 0);
    } else if (ds.meta) {
      plano.meta = { ...plano.meta, [ds.meta]: e.target.value === '' ? null : +e.target.value };
    } else if (ds.campo === 'pacienteId') {
      plano.pacienteId = e.target.value;
      plano.id = null;
      const m = metaDoPaciente(Store.paciente(plano.pacienteId));
      if (m.kcal) plano.meta = m;
    } else if (ds.campo === 'data') {
      plano.data = e.target.value;
    } else return;
    salvar(); render();
  });

  render();
}

function aplicarDieta(plano, dieta, kcalAlvo) {
  const alvo = kcalAlvo || plano.meta?.kcal;
  const cardapio = alvo ? Nutri.escalarCardapio(dieta.cardapio, alvo) : dieta.cardapio;
  plano.refeicoes = cardapio.map((r) => ({ nome: r.nome, itens: r.itens.map(([id, g]) => ({ id, g })) }));
  if (plano.nome === 'Plano alimentar' || !plano.nome) plano.nome = 'Plano — ' + dieta.nome;
  if (!plano.obs) plano.obs = dieta.principios.map((p) => '• ' + p).join('\n');
  if (!plano.meta?.kcal && alvo) plano.meta = { ...plano.meta, kcal: alvo };
}

/* ============================================================
 * Modelos de dieta
 * ============================================================ */
function barraMacros(m) {
  return `<div class="macro-barra"><span class="cor-c" style="width:${m.c}%"></span><span class="cor-p" style="width:${m.p}%"></span><span class="cor-l" style="width:${m.l}%"></span></div>
    <div class="legenda"><span><i class="cor-c"></i>C ${fmt(m.c)}%</span><span><i class="cor-p"></i>P ${fmt(m.p)}%</span><span><i class="cor-l"></i>L ${fmt(m.l)}%</span></div>`;
}

function viewDietas(raiz) {
  raiz.innerHTML = `
    <h1>Modelos de dieta</h1>
    <p class="subtitulo">Composição de referência, princípios e cardápio-base de um dia. Os cardápios podem ser ajustados para qualquer meta calórica.</p>
    <div class="grid grid-3">${DIETAS.map((d) => {
    const kcal = Nutri.somar(d.cardapio.flatMap((r) => r.itens)).kcal;
    return `<a class="card item-card" href="#/dieta/${d.id}">
        <div class="faixa" style="background:${d.cor}"></div>
        <h2>${esc(d.nome)}</h2>
        <p>${esc(d.objetivo)}</p>
        ${barraMacros(d.macros)}
        <div class="rodape"><span>Cardápio-base ≈ <strong>${fmt(kcal)} kcal</strong></span>${icone('seta')}</div>
      </a>`;
  }).join('')}</div>`;
}

function viewDieta(raiz, id) {
  const d = DIETA_POR_ID[id];
  if (!d) return ir('#/dietas');
  const kcalBase = Math.round(Nutri.somar(d.cardapio.flatMap((r) => r.itens)).kcal);
  let alvo = kcalBase;

  raiz.innerHTML = `
    <div class="cabecalho">
      <div><h1>${esc(d.nome)}</h1><p class="subtitulo">${esc(d.objetivo)}</p></div>
      <div class="acoes nao-imprimir">
        <button class="btn" id="usar">${icone('plano')}Usar no plano alimentar</button>
        <button class="btn btn-sec" data-imprimir>${icone('imprimir')}Imprimir</button>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h2>Indicação</h2><p>${esc(d.indicacao)}</p>
        <h3>Distribuição de referência (% VET)</h3>${barraMacros(d.macros)}
        <h3>Princípios</h3><ul class="lista-simples">${d.principios.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h2>Alimentos</h2>
        <h3>Preferir</h3><ul class="lista-simples">${d.preferir.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        <h3>Evitar ou limitar</h3><ul class="lista-simples evitar">${d.evitar.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="card">
      <div class="cabecalho" style="margin-bottom:8px">
        <h2 style="margin:0">Cardápio de exemplo</h2>
        <div class="acoes nao-imprimir" style="align-items:center">
          <label for="alvo">Ajustar para</label>
          <input id="alvo" type="number" step="50" min="800" value="${kcalBase}" style="width:110px"> <span>kcal</span>
          <button class="btn btn-sec btn-sm" id="reset">Original (${fmt(kcalBase)})</button>
        </div>
      </div>
      <p class="ajuda" style="margin-top:0">Ao ajustar, as quantidades são escaladas proporcionalmente (hortaliças permanecem fixas) e arredondadas a 5 g.</p>
      <div id="cardapio"></div>
    </div>`;

  const render = () => {
    const card = alvo === kcalBase ? d.cardapio : Nutri.escalarCardapio(d.cardapio, alvo);
    const tot = Nutri.somar(card.flatMap((r) => r.itens));
    const pct = Nutri.pctMacros(tot);
    $('#cardapio', raiz).innerHTML = `<div class="tabela-wrap"><table>
      <thead><tr><th>Refeição / alimento</th><th>Medida caseira</th><th class="num">g</th><th class="num">kcal</th><th class="num">P (g)</th><th class="num">C (g)</th><th class="num">L (g)</th><th class="num">Fibra</th></tr></thead>
      <tbody>${card.map((r) => {
    const t = Nutri.somar(r.itens);
    return `<tr class="destaque"><td colspan="3">${esc(r.nome)}</td><td class="num">${fmt(t.kcal)}</td><td class="num">${fmt(t.p, 1)}</td><td class="num">${fmt(t.c, 1)}</td><td class="num">${fmt(t.l, 1)}</td><td class="num">${fmt(t.f, 1)}</td></tr>`
          + r.itens.map(([aid, g]) => {
            const n = Nutri.doItem(aid, g);
            return `<tr><td style="padding-left:24px">${esc(ALIMENTO_POR_ID[aid].nome)}</td><td class="medida">${esc(Nutri.medidaCaseira(aid, g))}</td><td class="num">${g}</td>
              <td class="num">${fmt(n.kcal)}</td><td class="num">${fmt(n.p, 1)}</td><td class="num">${fmt(n.c, 1)}</td><td class="num">${fmt(n.l, 1)}</td><td class="num">${fmt(n.f, 1)}</td></tr>`;
          }).join('');
  }).join('')}
        <tr class="total"><td colspan="3">Total do dia</td><td class="num">${fmt(tot.kcal)}</td><td class="num">${fmt(tot.p, 1)}</td><td class="num">${fmt(tot.c, 1)}</td><td class="num">${fmt(tot.l, 1)}</td><td class="num">${fmt(tot.f, 1)}</td></tr>
      </tbody></table></div>
      <h3>Distribuição obtida no cardápio</h3>
      ${barraMacros(pct)}
      <p class="ajuda">Referência do modelo: C ${d.macros.c}% · P ${d.macros.p}% · L ${d.macros.l}%. Ajuste fino deve ser feito no plano alimentar conforme o paciente.</p>`;
  };

  $('#alvo', raiz).addEventListener('change', (e) => { alvo = Math.max(800, +e.target.value || kcalBase); e.target.value = alvo; render(); });
  $('#reset', raiz).onclick = () => { alvo = kcalBase; $('#alvo', raiz).value = alvo; render(); };
  $('#usar', raiz).onclick = () => {
    const plano = Store.dados.rascunhoPlano && !Store.dados.rascunhoPlano.refeicoes.some((r) => r.itens.length)
      ? Store.dados.rascunhoPlano
      : novoPlano(Store.dados.rascunhoPlano?.pacienteId || '');
    if (Store.dados.rascunhoPlano?.refeicoes.some((r) => r.itens.length) && !confirm('Já existe um plano em edição. Substituí-lo por este modelo?')) return;
    aplicarDieta(plano, d, plano.meta?.kcal || alvo);
    Store.dados.rascunhoPlano = plano;
    Store.salvar();
    ir('#/plano');
  };
  render();
}

/* ============================================================
 * Receitas
 * ============================================================ */
function viewReceitas(raiz) {
  const categorias = [...new Set(RECEITAS.map((r) => r.categoria))];
  raiz.innerHTML = `
    <h1>Receitas básicas</h1>
    <p class="subtitulo">Preparações saudáveis com informação nutricional calculada por porção.</p>
    <div class="filtros">
      <input type="search" id="busca" placeholder="Buscar receita ou ingrediente…">
      <select id="cat"><option value="">Todas as categorias</option>${categorias.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
    </div>
    <div class="grid grid-3" id="lista"></div>`;

  const render = () => {
    const q = $('#busca', raiz).value.trim().toLowerCase();
    const cat = $('#cat', raiz).value;
    const lista = RECEITAS.filter((r) => (!cat || r.categoria === cat)
      && (!q || r.nome.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q))
        || r.ingredientes.some(([id]) => ALIMENTO_POR_ID[id].nome.toLowerCase().includes(q))));
    $('#lista', raiz).innerHTML = lista.map((r) => {
      const n = Nutri.dividir(Nutri.somar(r.ingredientes), r.porcoes);
      return `<a class="card item-card" href="#/receita/${r.id}">
        <span class="tag marca" style="align-self:flex-start">${esc(r.categoria)}</span>
        <h2>${esc(r.nome)}</h2>
        <div class="meta"><span>${icone('relogio')}${r.tempo} min</span><span>${icone('porcao')}${r.porcoes} porç${r.porcoes > 1 ? 'ões' : 'ão'}</span><span>${icone('fogo')}${fmt(n.kcal)} kcal/porção</span></div>
        <div class="tags">${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="rodape"><span>P ${fmt(n.p)} g · C ${fmt(n.c)} g · L ${fmt(n.l)} g</span>${icone('seta')}</div>
      </a>`;
    }).join('') || '<p class="vazio">Nenhuma receita encontrada.</p>';
  };
  $('#busca', raiz).addEventListener('input', render);
  $('#cat', raiz).addEventListener('change', render);
  render();
}

function viewReceita(raiz, id) {
  const r = RECEITA_POR_ID[id];
  if (!r) return ir('#/receitas');
  const tot = Nutri.somar(r.ingredientes);
  const por = Nutri.dividir(tot, r.porcoes);
  const pct = Nutri.pctMacros(tot);
  const pesoTotal = r.ingredientes.reduce((s, [, g]) => s + g, 0);

  raiz.innerHTML = `
    <div class="cabecalho">
      <div><h1>${esc(r.nome)}</h1><p class="subtitulo">${esc(r.categoria)} · ${r.tempo} min de preparo · rende ${r.porcoes} porç${r.porcoes > 1 ? 'ões' : 'ão'} (≈ ${fmt(pesoTotal / r.porcoes)} g cada, peso cru)</p></div>
      <div class="acoes nao-imprimir"><a class="btn btn-sec" href="#/receitas">${icone('voltar')}Receitas</a><button class="btn btn-sec" data-imprimir>${icone('imprimir')}Imprimir</button></div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h2>Ingredientes</h2>
        <ul class="lista-simples">
          ${r.ingredientes.map(([aid, g, txt]) => `<li>${esc(txt)} <span class="medida">(${g} g)</span></li>`).join('')}
          ${r.extras.map((x) => `<li>${esc(x)}</li>`).join('')}
        </ul>
        <h2 style="margin-top:20px">Modo de preparo</h2>
        <ol class="passos">${r.preparo.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
        <div class="tags" style="margin-top:12px">${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
      <div class="card">
        <h2>Informação nutricional</h2>
        <table>
          <thead><tr><th></th><th class="num">Por porção</th><th class="num">Receita inteira</th></tr></thead>
          <tbody>
            <tr><td>Energia</td><td class="num"><strong>${fmt(por.kcal)} kcal</strong></td><td class="num">${fmt(tot.kcal)} kcal</td></tr>
            <tr><td>Proteínas</td><td class="num">${fmt(por.p, 1)} g</td><td class="num">${fmt(tot.p, 1)} g</td></tr>
            <tr><td>Carboidratos</td><td class="num">${fmt(por.c, 1)} g</td><td class="num">${fmt(tot.c, 1)} g</td></tr>
            <tr><td>Lipídios</td><td class="num">${fmt(por.l, 1)} g</td><td class="num">${fmt(tot.l, 1)} g</td></tr>
            <tr><td>Fibras</td><td class="num">${fmt(por.f, 1)} g</td><td class="num">${fmt(tot.f, 1)} g</td></tr>
          </tbody>
        </table>
        <h3>Distribuição calórica</h3>${barraMacros(pct)}
        <h3>Composição por ingrediente</h3>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Ingrediente</th><th class="num">g</th><th class="num">kcal</th><th class="num">P</th><th class="num">C</th><th class="num">L</th></tr></thead>
          <tbody>${r.ingredientes.map(([aid, g]) => {
    const n = Nutri.doItem(aid, g);
    return `<tr><td>${esc(ALIMENTO_POR_ID[aid].nome)}</td><td class="num">${g}</td><td class="num">${fmt(n.kcal)}</td><td class="num">${fmt(n.p, 1)}</td><td class="num">${fmt(n.c, 1)}</td><td class="num">${fmt(n.l, 1)}</td></tr>`;
  }).join('')}</tbody>
        </table></div>
        <p class="ajuda">Valores estimados a partir da tabela de alimentos; temperos e água não contabilizados.</p>
      </div>
    </div>`;
}

/* ============================================================
 * Tabela de alimentos
 * ============================================================ */
function viewAlimentos(raiz) {
  const grupos = [...new Set(ALIMENTOS.map((a) => a.grupo))];
  raiz.innerHTML = `
    <h1>Tabela de composição de alimentos</h1>
    <p class="subtitulo">Valores por 100 g da parte comestível — baseados na TACO (Unicamp) e USDA. Valores aproximados.</p>
    <div class="card">
      <div class="filtros">
        <input type="search" id="busca" placeholder="Buscar alimento…">
        <select id="grupo"><option value="">Todos os grupos</option>${grupos.map((g) => `<option>${esc(g)}</option>`).join('')}</select>
      </div>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Alimento</th><th>Grupo</th><th class="num">kcal</th><th class="num">Prot. (g)</th><th class="num">Carb. (g)</th><th class="num">Lip. (g)</th><th class="num">Fibra (g)</th><th>Medida caseira</th></tr></thead>
        <tbody id="linhas"></tbody>
      </table></div>
    </div>`;
  const render = () => {
    const q = $('#busca', raiz).value.trim().toLowerCase();
    const g = $('#grupo', raiz).value;
    const lista = ALIMENTOS.filter((a) => (!g || a.grupo === g) && a.nome.toLowerCase().includes(q));
    $('#linhas', raiz).innerHTML = lista.map((a) => `<tr>
      <td><strong>${esc(a.nome)}</strong></td><td class="medida">${esc(a.grupo)}</td>
      <td class="num">${fmt(a.kcal)}</td><td class="num">${fmt(a.p, 1)}</td><td class="num">${fmt(a.c, 1)}</td><td class="num">${fmt(a.l, 1)}</td><td class="num">${fmt(a.f, 1)}</td>
      <td class="medida">${a.med ? `1 ${esc(a.med[0])} = ${String(a.med[1]).replace('.', ',')} g` : '—'}</td></tr>`).join('')
      || '<tr><td colspan="8" class="vazio">Nenhum alimento encontrado.</td></tr>';
  };
  $('#busca', raiz).addEventListener('input', render);
  $('#grupo', raiz).addEventListener('change', render);
  render();
}

/* ============================================================
 * Backup (exportar / importar JSON)
 * ============================================================ */
function exportar() {
  const dados = { exportadoEm: new Date().toISOString(), pacientes: Store.pacientes() };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `nutris-backup-${hoje()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup exportado.');
}

function importar(arquivo) {
  const leitor = new FileReader();
  leitor.onload = async () => {
    let dados;
    try {
      dados = JSON.parse(leitor.result);
      if (!Array.isArray(dados.pacientes)) throw new Error('formato');
    } catch {
      return toast('Arquivo de backup inválido.');
    }
    if (!confirm(`Importar ${dados.pacientes.length} paciente(s)? Pacientes com o mesmo identificador serão atualizados.`)) return;
    try {
      const r = await Api.post('/api/pacientes/importar', { pacientes: dados.pacientes });
      await Store.carregar();
      toast(`${r.importados} paciente(s) importados.`);
      rotear();
    } catch (e) {
      toast('Erro ao importar: ' + e.message);
    }
  };
  leitor.readAsText(arquivo);
}

/* ============================================================
 * Login e solicitação de acesso
 * ============================================================ */
/** Layout de duas colunas: painel da marca à esquerda e formulário à direita. */
const layoutAuth = (titulo, subtitulo, conteudo) => `
  <section class="auth-marca">
    <div class="marca">${LOGO_SVG}<div><strong>Nutris</strong></div></div>
    <div style="position:relative;z-index:1">
      <h2>Gestão nutricional completa para a sua clínica.</h2>
      <p>Avaliação, prescrição e acompanhamento dos pacientes em um só lugar, com cálculos validados e acesso seguro para toda a equipe.</p>
      <ul class="auth-recursos">
        <li>${icone('check')}Antropometria, dobras cutâneas e gasto energético</li>
        <li>${icone('check')}Planos alimentares com cálculo automático de macros</li>
        <li>${icone('check')}Modelos de dieta, receitas e tabela de alimentos</li>
        <li>${icone('check')}Prontuário compartilhado e controle de acesso</li>
      </ul>
    </div>
    <div class="auth-rodape">© ${new Date().getFullYear()} Nutris · Dados protegidos conforme a LGPD</div>
  </section>
  <section class="auth-form">
    <div class="auth-card">
      <div class="marca">${LOGO_SVG}<div><strong>Nutris</strong><small>Clínica de Nutrição</small></div></div>
      <h1>${titulo}</h1>
      <p class="subtitulo">${subtitulo}</p>
      ${conteudo}
    </div>
  </section>`;

function viewLogin(raiz) {
  raiz.innerHTML = layoutAuth('Entrar', 'Acesse com o e-mail e a senha da sua conta.', `
    <form id="form" novalidate>
      <div id="erro" class="erro-form" hidden></div>
      <div class="campo"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="username" required autofocus></div>
      <div class="campo"><label for="senha">Senha</label><input id="senha" name="senha" type="password" autocomplete="current-password" required></div>
      <button class="btn" type="submit">Entrar</button>
    </form>
    <p class="alternar">Ainda não tem acesso? <a href="#/cadastro">Solicitar cadastro</a></p>`);

  $('#form', raiz).addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', raiz);
    const erro = $('#erro', raiz);
    btn.disabled = true;
    erro.hidden = true;
    try {
      const me = await Api.post('/api/auth/login', Object.fromEntries(new FormData(e.target)));
      await entrar(me);
      if (location.hash === '#/' || location.hash === '') rotear(); else ir('#/');
    } catch (err) {
      erro.textContent = err.message;
      erro.hidden = false;
      btn.disabled = false;
    }
  });
}

function viewCadastro(raiz) {
  raiz.innerHTML = layoutAuth('Solicitar acesso', 'Preencha seus dados. O administrador da clínica vai analisar e liberar o seu acesso.', `
    <div id="conteudo">
      <form id="form" novalidate>
        <div id="erro" class="erro-form" hidden></div>
        <div class="campo"><label for="nome">Nome completo</label><input id="nome" name="nome" autocomplete="name" required autofocus></div>
        <div class="campo"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="email" required></div>
        <div class="campo"><label for="crn">CRN (opcional)</label><input id="crn" name="crn" placeholder="Ex.: CRN-3 12345"></div>
        <div class="campo"><label for="senha">Senha (mín. 8 caracteres)</label><input id="senha" name="senha" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="campo"><label for="senha2">Confirmar senha</label><input id="senha2" name="senha2" type="password" autocomplete="new-password" required></div>
        <button class="btn" type="submit">Enviar solicitação</button>
      </form>
    </div>
    <p class="alternar">Já tem acesso? <a href="#/login">Entrar</a></p>`);

  $('#form', raiz).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const erro = $('#erro', raiz);
    const mostrar = (msg) => { erro.textContent = msg; erro.hidden = false; };
    erro.hidden = true;
    if (d.senha !== d.senha2) return mostrar('As senhas não conferem.');
    if (d.senha.length < 8) return mostrar('A senha deve ter pelo menos 8 caracteres.');
    const btn = $('button[type=submit]', raiz);
    btn.disabled = true;
    try {
      const { senha2, ...corpo } = d;
      const r = await Api.post('/api/auth/cadastro', corpo);
      $('#conteudo', raiz).innerHTML = `<div class="info sucesso">${esc(r.mensagem)}</div>`;
    } catch (err) {
      mostrar(err.message);
      btn.disabled = false;
    }
  });
}

/* ============================================================
 * Usuários (administrador)
 * ============================================================ */
const STATUS_USUARIO = {
  pendente: { texto: 'Pendente', nivel: 'alerta' },
  aprovado: { texto: 'Aprovado', nivel: 'ok' },
  rejeitado: { texto: 'Rejeitado', nivel: 'neutro' },
  bloqueado: { texto: 'Bloqueado', nivel: 'risco' },
};
const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

async function viewUsuarios(raiz) {
  raiz.innerHTML = '<h1>Usuários</h1><p class="subtitulo">Carregando…</p>';
  let usuarios;
  try {
    usuarios = await Api.get('/api/usuarios');
  } catch (e) {
    raiz.innerHTML = `<h1>Usuários</h1><div class="aviso">${esc(e.message)}</div>`;
    return;
  }
  const pendentes = usuarios.filter((u) => u.status === 'pendente');
  const demais = usuarios.filter((u) => u.status !== 'pendente');
  Store.pendentes = pendentes.length;
  atualizarSidebar();

  const acoes = (u) => {
    if (u.id === Store.usuario.id) return '<span class="medida">você</span>';
    const b = (acao, rotulo, cls = 'btn-sec') => `<button class="btn ${cls} btn-sm" data-acao="${acao}" data-id="${u.id}">${rotulo}</button>`;
    const lista = [];
    if (u.status === 'aprovado') {
      lista.push(u.papel === 'admin' ? b('nutricionista', 'Remover admin') : b('admin', 'Tornar admin'));
      lista.push(b('senha', `${icone('chave')}Redefinir senha`));
      lista.push(b('bloqueado', `${icone('bloquear')}Bloquear`, 'btn-perigo'));
    } else {
      lista.push(b('aprovado', u.status === 'bloqueado' ? 'Reativar' : 'Aprovar', u.status === 'bloqueado' ? 'btn-sec' : ''));
    }
    return `<div class="acoes" style="justify-content:flex-end">${lista.join('')}</div>`;
  };

  raiz.innerHTML = `
    <h1>Usuários</h1>
    <p class="subtitulo">Aprove as solicitações de acesso da equipe e gerencie quem pode entrar no sistema.</p>

    <div class="card">
      <h2>Solicitações pendentes ${pendentes.length ? `<span class="badge">${pendentes.length}</span>` : ''}</h2>
      ${pendentes.length ? `<div class="tabela-wrap"><table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>CRN</th><th>Solicitado em</th><th></th></tr></thead>
        <tbody>${pendentes.map((u) => `<tr>
          <td><strong>${esc(u.nome)}</strong></td><td>${esc(u.email)}</td><td>${esc(u.crn || '—')}</td><td>${dataHoraBR(u.criadoEm)}</td>
          <td class="num"><div class="acoes" style="justify-content:flex-end">
            <button class="btn btn-sm" data-acao="aprovado" data-id="${u.id}">${icone('check')}Aprovar</button>
            <button class="btn btn-perigo btn-sm" data-acao="rejeitado" data-id="${u.id}">${icone('fechar')}Rejeitar</button>
          </div></td></tr>`).join('')}</tbody></table></div>` : '<p class="vazio">Nenhuma solicitação aguardando aprovação.</p>'}
    </div>

    <div class="card">
      <h2>Equipe</h2>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>CRN</th><th>Perfil</th><th>Situação</th><th>Atualizado em</th><th></th></tr></thead>
        <tbody>${demais.map((u) => `<tr>
          <td><strong>${esc(u.nome)}</strong></td><td>${esc(u.email)}</td><td>${esc(u.crn || '—')}</td>
          <td>${u.papel === 'admin' ? 'Administrador' : 'Nutricionista'}</td>
          <td>${selo(STATUS_USUARIO[u.status])}</td>
          <td>${dataHoraBR(u.decididoEm || u.criadoEm)}</td>
          <td class="num">${acoes(u)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;

  raiz.addEventListener('click', async (e) => {
    const t = e.target.closest('button[data-acao]');
    if (!t) return;
    const u = usuarios.find((x) => x.id === +t.dataset.id);
    const acao = t.dataset.acao;
    const mensagens = {
      aprovado: `Liberar o acesso de ${u.nome}?`,
      rejeitado: `Rejeitar a solicitação de ${u.nome}?`,
      bloqueado: `Bloquear o acesso de ${u.nome}? As sessões abertas serão encerradas.`,
      admin: `Dar perfil de administrador a ${u.nome}? A pessoa poderá aprovar e bloquear usuários.`,
      nutricionista: `Remover o perfil de administrador de ${u.nome}?`,
    };
    try {
      if (acao === 'senha') {
        const senha = prompt(`Nova senha para ${u.nome} (mín. 8 caracteres):`);
        if (!senha) return;
        await Api.post(`/api/usuarios/${u.id}/senha`, { senha });
        toast('Senha redefinida. Informe a nova senha ao usuário.');
        return;
      }
      if (!confirm(mensagens[acao])) return;
      const corpo = ['admin', 'nutricionista'].includes(acao) ? { papel: acao } : { status: acao };
      await Api.patch(`/api/usuarios/${u.id}`, corpo);
      toast('Usuário atualizado.');
      rotear();
    } catch (err) {
      toast(err.message);
    }
  });
}

/* ============================================================
 * Minha conta
 * ============================================================ */
function viewConta(raiz) {
  const u = Store.usuario;
  raiz.innerHTML = `
    <h1>Minha conta</h1>
    <p class="subtitulo">${esc(u.nome)} · ${esc(u.email)} · ${u.papel === 'admin' ? 'Administrador' : 'Nutricionista'}${u.crn ? ' · ' + esc(u.crn) : ''}</p>
    <form class="card" id="form" style="max-width:460px">
      <h2>Alterar senha</h2>
      <div class="campos">
        <div class="campo largo"><label>Senha atual</label><input type="password" name="atual" autocomplete="current-password" required></div>
        <div class="campo largo"><label>Nova senha (mín. 8 caracteres)</label><input type="password" name="nova" autocomplete="new-password" minlength="8" required></div>
        <div class="campo largo"><label>Confirmar nova senha</label><input type="password" name="nova2" autocomplete="new-password" required></div>
      </div>
      <div class="acoes" style="margin-top:14px"><button class="btn" type="submit">Salvar nova senha</button></div>
    </form>`;
  $('#form', raiz).addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.nova !== d.nova2) return toast('As senhas não conferem.');
    try {
      await Api.post('/api/auth/senha', { atual: d.atual, nova: d.nova });
      e.target.reset();
      toast('Senha alterada. Outras sessões foram encerradas.');
    } catch (err) {
      toast(err.message);
    }
  });
}

/* ============================================================
 * Sessão e inicialização
 * ============================================================ */
function atualizarSidebar() {
  const u = Store.usuario;
  if (!u) return;
  $('#usuario-nome').textContent = u.nome;
  $('#usuario-avatar').textContent = iniciais(u.nome);
  $('#usuario-papel').textContent = u.papel === 'admin' ? 'Administrador' : 'Nutricionista';
  $('#menu-usuarios').hidden = u.papel !== 'admin';
  $('#backup-admin').hidden = u.papel !== 'admin';
  const badge = $('#badge-pendentes');
  badge.textContent = Store.pendentes;
  badge.hidden = !Store.pendentes;
}

async function entrar(me) {
  Store.usuario = me.usuario;
  Store.pendentes = me.pendentes || 0;
  await Store.carregar();
  atualizarSidebar();
}

function sessaoExpirada() {
  Store.limpar();
  toast('Sua sessão expirou. Entre novamente.');
  ir('#/login');
  rotear();
}

async function sair() {
  try { await Api.post('/api/auth/logout'); } catch { /* encerra localmente de qualquer forma */ }
  Store.limpar();
  ir('#/login');
  rotear();
}

// Ações globais (substituem handlers inline, bloqueados pela política de segurança)
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-imprimir]')) return window.print();
  const linha = e.target.closest('[data-href]');
  if (linha && !e.target.closest('a,button,input,select')) ir(linha.dataset.href);
});

async function iniciar() {
  $('#btn-exportar').onclick = exportar;
  $('#input-importar').onchange = (e) => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ''; };
  $('#btn-sair').onclick = sair;
  // Menu lateral deslizante no celular
  $('#btn-menu').onclick = () => document.body.classList.toggle('menu-aberto');
  $('#sidebar-fundo').onclick = () => document.body.classList.remove('menu-aberto');
  window.addEventListener('hashchange', () => document.body.classList.remove('menu-aberto'));
  try {
    await entrar(await Api.get('/api/auth/me'));
  } catch {
    Store.limpar();
  }
  window.addEventListener('hashchange', rotear);
  rotear();
}

iniciar();
