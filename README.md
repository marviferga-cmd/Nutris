# Nutris — Sistema para Clínica de Nutrição

Aplicação web local (HTML + CSS + JavaScript puro, sem dependências). Para usar, basta abrir o `index.html` no navegador.

Os dados ficam salvos no próprio navegador (`localStorage`). Use **Exportar backup** / **Importar backup** na barra lateral para salvar uma cópia ou levar os dados para outro computador.

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Pacientes** | Cadastro, anamnese resumida, histórico de avaliações (evolução de peso, IMC, % gordura, cintura) e planos salvos |
| **Avaliação e cálculos** | Todos os cálculos abaixo em tempo real; salva a avaliação no paciente |
| **Plano alimentar** | Montagem de refeições com alimentos da tabela, medidas caseiras, totais vs. metas, impressão |
| **Modelos de dieta** | 7 dietas com princípios, alimentos a preferir/evitar e cardápio-base ajustável para qualquer meta de kcal |
| **Receitas** | 13 receitas básicas com ingredientes, preparo e informação nutricional por porção |
| **Tabela de alimentos** | ~70 alimentos (valores por 100 g, base TACO/USDA) com medidas caseiras |

## Cálculos disponíveis

- **IMC** com classificação OMS (adultos) e Lipschitz (idosos ≥ 60 anos)
- **Peso ideal** (faixa IMC 18,5–24,9 e IMC médio), **peso ajustado** para obesos
- **Circunferência da cintura** (risco OMS), **relação cintura/quadril**, **relação cintura/estatura**
- **% de gordura** por dobras cutâneas: Jackson & Pollock 3 e 7 dobras, Durnin & Womersley 4 dobras, com equação de Siri; classificação de Lohman; massa gorda e massa magra
- **TMB**: Harris-Benedict, Mifflin-St Jeor, FAO/OMS (Schofield), Katch-McArdle e Cunningham
- **GET** = TMB × fator de atividade × fator injúria; **EER IOM/DRI 2005**; regra de bolso (kcal/kg)
- **VET** conforme objetivo (manutenção, déficit ou superávit) com alerta se ficar abaixo da TMB
- **Macronutrientes**: proteína em g/kg, lipídios em % do VET, carboidratos pela diferença
- **Água** (35 ml/kg; 30 ml/kg ≥ 65 anos) e **fibras** (14 g/1000 kcal)

## Modelos de dieta

Hipocalórica equilibrada · Mediterrânea · DASH · Low carb · Hiperproteica (hipertrofia) · Vegetariana · Para diabetes (baixo índice glicêmico)

## Estrutura

```
index.html        página principal
css/style.css     estilos (inclui layout de impressão)
js/calculos.js    fórmulas nutricionais e antropométricas (módulo Calc)
js/dados.js       alimentos, receitas, modelos de dieta e utilitários de composição (Nutri)
js/app.js         telas, rotas e armazenamento
```

## Aviso

Os valores nutricionais são aproximados. O sistema é uma ferramenta de apoio e não substitui o julgamento clínico do(a) nutricionista.
