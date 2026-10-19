# Nutris — Sistema para Clínica de Nutrição

Sistema web para clínicas de nutrição: pacientes, avaliação nutricional com todos os cálculos, planos alimentares, modelos de dieta e receitas.

- **Frontend:** HTML, CSS e JavaScript puro (`public/`)
- **Backend:** Node.js + Express (`server/`)
- **Banco de dados:** PostgreSQL
- **Acesso:** login com aprovação. Novos usuários solicitam cadastro e o administrador aprova.

## Deploy no Railway

1. Envie o repositório para o GitHub.
2. No Railway, crie um projeto: **New Project → Deploy from GitHub repo** e escolha o repositório.
3. No mesmo projeto, adicione o banco: **+ New → Database → PostgreSQL**.
4. No serviço do app, abra **Variables** e cadastre:

   | Variável | Valor |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto) |
   | `ADMIN_EMAIL` | e-mail do administrador |
   | `ADMIN_PASSWORD` | senha do administrador (mín. 8 caracteres) |
   | `ADMIN_NOME` | nome exibido do administrador (opcional) |

5. Em **Settings → Networking**, clique em **Generate Domain**.

Na primeira inicialização o servidor cria as tabelas e o usuário administrador. O healthcheck fica em `/api/saude`.

> **Esqueceu a senha do admin?** Coloque a nova senha em `ADMIN_PASSWORD`, defina `ADMIN_REDEFINIR_SENHA=true`, faça um deploy e depois volte a variável para `false`.

## Rodar localmente

Requer Node.js 20+ e um PostgreSQL.

```bash
npm install
cp .env.example .env   # ajuste DATABASE_URL e os dados do admin
npm run dev
```

Acesse http://localhost:3000.

## Usuários e permissões

| Perfil | Pode |
|---|---|
| **Administrador** | Tudo, além de aprovar/rejeitar solicitações, bloquear/reativar usuários, promover outros a admin, redefinir senhas e importar/exportar backup |
| **Nutricionista** | Pacientes, avaliações, planos, dietas e receitas |

Fluxo de acesso: a pessoa clica em **Solicitar cadastro** → a solicitação fica **pendente** → o admin aprova em **Usuários** → a pessoa consegue entrar. Bloquear um usuário encerra as sessões dele na hora.

Todos os usuários aprovados enxergam todos os pacientes da clínica.

**Segurança:** senhas com bcrypt; sessão em cookie `httpOnly` com validade de 12 h; proteção contra CSRF; limite de tentativas de login; cabeçalhos de segurança (CSP etc.).

### Migração da versão anterior

A versão anterior salvava os pacientes no navegador. Quando o administrador entra pelo mesmo navegador, o sistema mostra um aviso para **enviar esses pacientes para o servidor**.

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Pacientes** | Cadastro, anamnese resumida, histórico de avaliações (evolução de peso, IMC, % gordura, cintura) e planos salvos |
| **Avaliação e cálculos** | Todos os cálculos abaixo em tempo real; salva a avaliação no paciente |
| **Plano alimentar** | Montagem de refeições com alimentos da tabela, medidas caseiras, totais vs. metas, impressão |
| **Modelos de dieta** | 7 dietas com princípios, alimentos a preferir/evitar e cardápio-base ajustável para qualquer meta de kcal |
| **Receitas** | 13 receitas básicas com ingredientes, preparo e informação nutricional por porção |
| **Tabela de alimentos** | ~70 alimentos (valores por 100 g, base TACO/USDA) com medidas caseiras |

### Cálculos disponíveis

- **IMC** com classificação OMS (adultos) e Lipschitz (idosos ≥ 60 anos)
- **Peso ideal** (faixa IMC 18,5–24,9 e IMC médio), **peso ajustado** para obesos
- **Circunferência da cintura** (risco OMS), **relação cintura/quadril**, **relação cintura/estatura**
- **% de gordura** por dobras cutâneas: Jackson & Pollock 3 e 7 dobras, Durnin & Womersley 4 dobras, com equação de Siri; classificação de Lohman; massa gorda e massa magra
- **TMB**: Harris-Benedict, Mifflin-St Jeor, FAO/OMS (Schofield), Katch-McArdle e Cunningham
- **GET** = TMB × fator de atividade × fator injúria; **EER IOM/DRI 2005**; regra de bolso (kcal/kg)
- **VET** conforme objetivo (manutenção, déficit ou superávit) com alerta se ficar abaixo da TMB
- **Macronutrientes**: proteína em g/kg, lipídios em % do VET, carboidratos pela diferença
- **Água** (35 ml/kg; 30 ml/kg ≥ 65 anos) e **fibras** (14 g/1000 kcal)

## Estrutura

```
server/index.js      inicialização (migração do banco, admin, servidor HTTP)
server/app.js        rotas da API: autenticação, usuários, pacientes
server/db.js         conexão PostgreSQL, tabelas e criação do admin
public/index.html    página principal
public/css/style.css estilos (inclui layout de impressão)
public/js/calculos.js fórmulas nutricionais e antropométricas
public/js/dados.js   alimentos, receitas, modelos de dieta
public/js/app.js     telas, rotas, login e comunicação com a API
railway.json         configuração de deploy no Railway
```

## Aviso

Os valores nutricionais são aproximados. O sistema é uma ferramenta de apoio e não substitui o julgamento clínico do(a) nutricionista. Dados de pacientes são dados pessoais sensíveis (LGPD): restrinja o acesso apenas à equipe da clínica.
