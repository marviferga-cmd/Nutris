'use strict';

/**
 * Cálculos nutricionais e antropométricos.
 * Unidades: peso em kg, altura em cm, dobras em mm, circunferências em cm.
 * Sexo: 'M' (masculino) | 'F' (feminino).
 */
const Calc = (() => {
  const NIVEIS_ATIVIDADE = [
    { id: 'sedentario', nome: 'Sedentário (pouco ou nenhum exercício)', fa: 1.2, iom: { M: 1.0, F: 1.0 } },
    { id: 'leve', nome: 'Levemente ativo (exercício 1–3x/semana)', fa: 1.375, iom: { M: 1.11, F: 1.12 } },
    { id: 'moderado', nome: 'Moderadamente ativo (3–5x/semana)', fa: 1.55, iom: { M: 1.25, F: 1.27 } },
    { id: 'intenso', nome: 'Muito ativo (6–7x/semana)', fa: 1.725, iom: { M: 1.48, F: 1.45 } },
    { id: 'atleta', nome: 'Extremamente ativo (atleta / trabalho braçal)', fa: 1.9, iom: { M: 1.48, F: 1.45 } },
  ];

  // Fatores de injúria/estresse (Long et al., 1979) — uso clínico/hospitalar
  const FATORES_INJURIA = [
    { id: 'nenhum', nome: 'Nenhum (paciente ambulatorial)', f: 1.0 },
    { id: 'cir_menor', nome: 'Cirurgia eletiva / pequeno porte', f: 1.1 },
    { id: 'cir_maior', nome: 'Cirurgia de grande porte', f: 1.2 },
    { id: 'infeccao', nome: 'Infecção moderada', f: 1.2 },
    { id: 'trauma', nome: 'Trauma / fraturas múltiplas', f: 1.35 },
    { id: 'sepse', nome: 'Sepse / infecção grave', f: 1.5 },
    { id: 'queimadura', nome: 'Grande queimado', f: 1.8 },
  ];

  const OBJETIVOS = [
    { id: 'manter', nome: 'Manutenção do peso', ajuste: 0 },
    { id: 'perda_leve', nome: 'Perda de peso leve (−300 kcal)', ajuste: -300 },
    { id: 'perda', nome: 'Perda de peso (−500 kcal ≈ 0,5 kg/sem)', ajuste: -500 },
    { id: 'ganho_leve', nome: 'Ganho de massa leve (+300 kcal)', ajuste: 300 },
    { id: 'ganho', nome: 'Ganho de massa (+500 kcal)', ajuste: 500 },
  ];

  const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
  const positivo = (v) => (num(v) != null && +v > 0 ? +v : null);

  function soma(...valores) {
    if (valores.some((v) => positivo(v) == null)) return null;
    return valores.reduce((a, b) => a + +b, 0);
  }

  function idade(nascimento, ref = new Date()) {
    if (!nascimento) return null;
    const n = new Date(nascimento + 'T00:00:00');
    if (isNaN(n)) return null;
    let a = ref.getFullYear() - n.getFullYear();
    const m = ref.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) a--;
    return a;
  }

  // ---------- IMC ----------
  function imc(peso, altura) {
    if (!positivo(peso) || !positivo(altura)) return null;
    const m = altura / 100;
    return peso / (m * m);
  }

  function classificaIMC(valor, idadeAnos) {
    if (valor == null) return null;
    if (idadeAnos != null && idadeAnos >= 60) {
      // Lipschitz (1994) — idosos
      if (valor < 22) return { texto: 'Baixo peso (idoso)', nivel: 'alerta' };
      if (valor <= 27) return { texto: 'Eutrofia (idoso)', nivel: 'ok' };
      return { texto: 'Sobrepeso (idoso)', nivel: 'alerta' };
    }
    // OMS (1995/2000) — adultos
    if (valor < 16) return { texto: 'Magreza grau III', nivel: 'risco' };
    if (valor < 17) return { texto: 'Magreza grau II', nivel: 'risco' };
    if (valor < 18.5) return { texto: 'Magreza grau I', nivel: 'alerta' };
    if (valor < 25) return { texto: 'Eutrofia', nivel: 'ok' };
    if (valor < 30) return { texto: 'Sobrepeso (pré-obesidade)', nivel: 'alerta' };
    if (valor < 35) return { texto: 'Obesidade grau I', nivel: 'risco' };
    if (valor < 40) return { texto: 'Obesidade grau II', nivel: 'risco' };
    return { texto: 'Obesidade grau III', nivel: 'risco' };
  }

  // ---------- Peso de referência ----------
  function pesoIdeal(sexo, altura) {
    if (!positivo(altura)) return null;
    const m2 = (altura / 100) ** 2;
    const imcMedio = sexo === 'M' ? 22 : 21;
    return { min: 18.5 * m2, max: 24.9 * m2, ideal: imcMedio * m2, imcMedio };
  }

  // Peso ajustado para obesos: (PA − PI) × 0,25 + PI
  function pesoAjustado(atual, ideal) {
    if (!positivo(atual) || !positivo(ideal)) return null;
    return (atual - ideal) * 0.25 + ideal;
  }

  // ---------- Taxa metabólica basal ----------
  function tmbFAO({ sexo, peso, idade: i }) {
    // FAO/OMS/ONU (1985) — Schofield
    const faixas = sexo === 'M'
      ? [[3, 60.9, -54], [10, 22.7, 495], [18, 17.5, 651], [30, 15.3, 679], [60, 11.6, 879], [Infinity, 13.5, 487]]
      : [[3, 61.0, -51], [10, 22.5, 499], [18, 12.2, 746], [30, 14.7, 496], [60, 8.7, 829], [Infinity, 10.5, 596]];
    const [, a, b] = faixas.find(([lim]) => i < lim);
    return a * peso + b;
  }

  const FORMULAS_TMB = {
    harris: {
      nome: 'Harris-Benedict (1919)',
      requer: ['peso', 'altura', 'idade'],
      calc: ({ sexo, peso, altura, idade: i }) => (sexo === 'M'
        ? 66.473 + 13.7516 * peso + 5.0033 * altura - 6.755 * i
        : 655.0955 + 9.5634 * peso + 1.8496 * altura - 4.6756 * i),
    },
    mifflin: {
      nome: 'Mifflin-St Jeor (1990)',
      requer: ['peso', 'altura', 'idade'],
      calc: ({ sexo, peso, altura, idade: i }) => 10 * peso + 6.25 * altura - 5 * i + (sexo === 'M' ? 5 : -161),
    },
    fao: {
      nome: 'FAO/OMS (1985)',
      requer: ['peso', 'idade'],
      calc: tmbFAO,
    },
    katch: {
      nome: 'Katch-McArdle (requer % gordura)',
      requer: ['mlg'],
      calc: ({ mlg }) => 370 + 21.6 * mlg,
    },
    cunningham: {
      nome: 'Cunningham (1980) (requer % gordura)',
      requer: ['mlg'],
      calc: ({ mlg }) => 500 + 22 * mlg,
    },
  };

  function tmb(formula, dados) {
    const f = FORMULAS_TMB[formula];
    if (!f || !dados.sexo) return null;
    if (f.requer.some((k) => dados[k] == null || (k !== 'idade' && !(dados[k] > 0)))) return null;
    return f.calc(dados);
  }

  // EER — Institute of Medicine (DRI, 2005) para adultos ≥ 19 anos. Retorna o GET diretamente.
  function eerIOM({ sexo, idade: i, peso, altura, nivel }) {
    if (!sexo || i == null || i < 19 || !positivo(peso) || !positivo(altura)) return null;
    const n = NIVEIS_ATIVIDADE.find((x) => x.id === nivel) || NIVEIS_ATIVIDADE[0];
    const pa = n.iom[sexo];
    const m = altura / 100;
    return sexo === 'M'
      ? 662 - 9.53 * i + pa * (15.91 * peso + 539.6 * m)
      : 354 - 6.91 * i + pa * (9.36 * peso + 726 * m);
  }

  // ---------- Composição corporal (dobras cutâneas) ----------
  const DURNIN = {
    M: [[20, 1.1620, 0.0630], [30, 1.1631, 0.0632], [40, 1.1422, 0.0544], [50, 1.1620, 0.0700], [Infinity, 1.1715, 0.0779]],
    F: [[20, 1.1549, 0.0678], [30, 1.1599, 0.0717], [40, 1.1423, 0.0632], [50, 1.1333, 0.0612], [Infinity, 1.1339, 0.0645]],
  };

  const PROTOCOLOS_DOBRAS = {
    pollock3: {
      nome: 'Jackson & Pollock — 3 dobras',
      dobras: (sexo) => (sexo === 'M' ? ['peitoral', 'abdominal', 'coxa'] : ['triceps', 'suprailiaca', 'coxa']),
      densidade: (sexo, i, s) => (sexo === 'M'
        ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * i
        : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * i),
    },
    pollock7: {
      nome: 'Jackson & Pollock — 7 dobras',
      dobras: () => ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
      densidade: (sexo, i, s) => (sexo === 'M'
        ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * i
        : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * i),
    },
    durnin: {
      nome: 'Durnin & Womersley — 4 dobras',
      dobras: () => ['biceps', 'triceps', 'subescapular', 'suprailiaca'],
      densidade: (sexo, i, s) => {
        const [, c, m] = DURNIN[sexo].find(([lim]) => i < lim);
        return c - m * Math.log10(s);
      },
    },
  };

  const NOMES_DOBRAS = {
    triceps: 'Tricipital', biceps: 'Bicipital', subescapular: 'Subescapular', suprailiaca: 'Supra-ilíaca',
    peitoral: 'Peitoral', axilar: 'Axilar média', abdominal: 'Abdominal', coxa: 'Coxa',
  };

  // Equação de Siri (1961)
  const siri = (densidade) => (4.95 / densidade - 4.5) * 100;

  function composicaoCorporal(protocolo, sexo, idadeAnos, dobras, peso) {
    const p = PROTOCOLOS_DOBRAS[protocolo];
    if (!p || !sexo || idadeAnos == null) return null;
    const s = soma(...p.dobras(sexo).map((d) => dobras[d]));
    if (s == null) return null;
    const densidade = p.densidade(sexo, idadeAnos, s);
    const pct = siri(densidade);
    const res = { protocolo: p.nome, somaDobras: s, densidade, pctGordura: pct };
    if (positivo(peso)) {
      res.massaGorda = peso * pct / 100;
      res.massaMagra = peso - res.massaGorda;
    }
    return res;
  }

  // Lohman (1992)
  function classificaGordura(sexo, pct) {
    if (pct == null) return null;
    const [risco, media, acima, obes] = sexo === 'M' ? [5, 15, 16, 25] : [8, 23, 24, 32];
    if (pct <= risco) return { texto: 'Risco (desnutrição)', nivel: 'risco' };
    if (pct < media) return { texto: 'Abaixo da média', nivel: 'ok' };
    if (pct < acima) return { texto: 'Média', nivel: 'ok' };
    if (pct < obes) return { texto: 'Acima da média', nivel: 'alerta' };
    return { texto: 'Risco (obesidade)', nivel: 'risco' };
  }

  // ---------- Circunferências ----------
  function riscoCintura(sexo, cc) {
    if (!positivo(cc) || !sexo) return null;
    const [aum, muito] = sexo === 'M' ? [94, 102] : [80, 88];
    if (cc >= muito) return { texto: 'Risco muito aumentado', nivel: 'risco' };
    if (cc >= aum) return { texto: 'Risco aumentado', nivel: 'alerta' };
    return { texto: 'Sem risco aumentado', nivel: 'ok' };
  }

  function rcq(sexo, cc, quadril) {
    if (!positivo(cc) || !positivo(quadril)) return null;
    const v = cc / quadril;
    const lim = sexo === 'M' ? 0.9 : 0.85;
    return { valor: v, class: v >= lim ? { texto: 'Risco cardiometabólico elevado', nivel: 'risco' } : { texto: 'Adequada', nivel: 'ok' } };
  }

  function rcest(cc, altura) {
    if (!positivo(cc) || !positivo(altura)) return null;
    const v = cc / altura;
    return { valor: v, class: v >= 0.5 ? { texto: 'Risco cardiometabólico elevado', nivel: 'risco' } : { texto: 'Adequada', nivel: 'ok' } };
  }

  // ---------- Macronutrientes, água e fibras ----------
  function macros(vet, pesoRef, protGkg, lipPct) {
    if (!positivo(vet) || !positivo(pesoRef)) return null;
    const pG = (protGkg || 0) * pesoRef;
    const pKcal = pG * 4;
    const lKcal = vet * (lipPct || 0) / 100;
    const lG = lKcal / 9;
    const cKcal = vet - pKcal - lKcal;
    const cG = cKcal / 4;
    return {
      proteina: { g: pG, kcal: pKcal, pct: pKcal / vet * 100, gkg: pG / pesoRef },
      lipidio: { g: lG, kcal: lKcal, pct: lKcal / vet * 100, gkg: lG / pesoRef },
      carboidrato: { g: cG, kcal: cKcal, pct: cKcal / vet * 100, gkg: cG / pesoRef },
    };
  }

  const agua = (peso, idadeAnos) => (positivo(peso) ? peso * (idadeAnos >= 65 ? 30 : 35) : null);
  const fibras = (vet) => (positivo(vet) ? Math.max(25, vet / 1000 * 14) : null);

  /**
   * Avaliação completa a partir dos dados do formulário.
   * Retorna todos os resultados calculáveis (o que faltar fica null).
   */
  function avaliar(d) {
    const sexo = d.sexo;
    const i = num(d.idade);
    const peso = positivo(d.peso);
    const altura = positivo(d.altura);
    const r = { sexo, idade: i, peso, altura };

    r.imc = imc(peso, altura);
    r.imcClass = classificaIMC(r.imc, i);
    r.pesoIdeal = pesoIdeal(sexo, altura);
    r.pesoAjustado = r.imc >= 30 && r.pesoIdeal ? pesoAjustado(peso, r.pesoIdeal.ideal) : null;

    r.cintura = riscoCintura(sexo, positivo(d.cintura));
    r.rcq = rcq(sexo, positivo(d.cintura), positivo(d.quadril));
    r.rcest = rcest(positivo(d.cintura), altura);

    const dobras = {};
    Object.keys(NOMES_DOBRAS).forEach((k) => { dobras[k] = positivo(d['dc_' + k]); });
    r.composicao = composicaoCorporal(d.protocolo || 'pollock3', sexo, i, dobras, peso);
    r.gorduraClass = r.composicao ? classificaGordura(sexo, r.composicao.pctGordura) : null;

    // Peso usado nos cálculos energéticos/proteicos
    const pesoCalc = d.pesoCalculo === 'ideal' && r.pesoIdeal ? r.pesoIdeal.ideal
      : d.pesoCalculo === 'ajustado' && r.pesoAjustado ? r.pesoAjustado
        : peso;
    r.pesoCalculo = pesoCalc;

    const base = { sexo, idade: i, peso: pesoCalc, altura, mlg: r.composicao?.massaMagra ?? null };
    const nivel = NIVEIS_ATIVIDADE.find((n) => n.id === d.atividade) || NIVEIS_ATIVIDADE[0];
    const injuria = FATORES_INJURIA.find((f) => f.id === d.injuria) || FATORES_INJURIA[0];
    r.fa = nivel.fa;
    r.fi = injuria.f;

    r.tmbs = Object.entries(FORMULAS_TMB).map(([id, f]) => {
      const v = tmb(id, base);
      return { id, nome: f.nome, tmb: v, get: v != null ? v * nivel.fa * injuria.f : null };
    });
    r.eer = eerIOM({ ...base, nivel: nivel.id });

    const escolhida = d.formula || 'mifflin';
    if (escolhida === 'iom') {
      r.formula = 'EER — IOM/DRI (2005)';
      r.get = r.eer != null ? r.eer * injuria.f : null;
      r.tmb = null;
    } else {
      const t = r.tmbs.find((x) => x.id === escolhida);
      r.formula = t?.nome;
      r.tmb = t?.tmb ?? null;
      r.get = t?.get ?? null;
    }

    const obj = OBJETIVOS.find((o) => o.id === d.objetivo) || OBJETIVOS[0];
    r.objetivo = obj.nome;
    r.vet = r.get != null ? r.get + obj.ajuste : null;
    r.alertaVet = r.vet != null && r.tmb != null && r.vet < r.tmb;

    r.regraBolso = pesoCalc ? { perda: [20 * pesoCalc, 25 * pesoCalc], manter: [25 * pesoCalc, 30 * pesoCalc], ganho: [30 * pesoCalc, 35 * pesoCalc] } : null;

    r.macros = macros(r.vet, pesoCalc, num(d.protGkg) ?? 1.2, num(d.lipPct) ?? 30);
    r.agua = agua(peso, i);
    r.fibras = fibras(r.vet);
    return r;
  }

  return {
    NIVEIS_ATIVIDADE, FATORES_INJURIA, OBJETIVOS, FORMULAS_TMB, PROTOCOLOS_DOBRAS, NOMES_DOBRAS,
    idade, imc, classificaIMC, pesoIdeal, pesoAjustado, tmb, eerIOM, siri, composicaoCorporal,
    classificaGordura, riscoCintura, rcq, rcest, macros, agua, fibras, avaliar,
  };
})();
