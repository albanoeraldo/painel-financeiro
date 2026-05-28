# Painel Financeiro

Aplicação web desenvolvida em **HTML, CSS e JavaScript puro** para controle financeiro pessoal, com foco em organização mensal, contas fixas, cartão de crédito, metas, fechamento de mês, dashboard anual e backup dos dados.

O projeto nasceu como um MVP para praticar desenvolvimento front-end, lógica de negócio e organização de dados financeiros, mas evoluiu para uma aplicação funcional com autenticação, sincronização em nuvem e recursos úteis para uso real.

---

## Visão geral

O **Painel Financeiro** permite controlar despesas fixas, gastos no cartão, entradas extras, metas financeiras e fechamento mensal em um único lugar.

A aplicação organiza os dados por mês e oferece uma visão clara do saldo planejado, saldo realizado, despesas pendentes, categorias de gasto e evolução anual.

---

## Funcionalidades

### Dashboard mensal

* Seleção de mês.
* Cadastro de renda base.
* Cadastro de renda extra.
* Indicadores de renda, despesas, cartão, metas e saldo.
* Resumo de categorias.
* Fechamento e reabertura do mês.
* Exportação de relatório CSV.

### Contas fixas

* Cadastro de despesas fixas mensais.
* Controle de vencimento.
* Marcação de contas pagas e pendentes.
* Categorias de despesas.
* Controle de parcelas/financiamentos.
* Importação de contas do mês anterior.
* Reordenação por arrastar e soltar.

### Cartão de crédito

* Cadastro de compras parceladas.
* Controle de valor mensal da parcela.
* Cadastro de assinaturas e gastos recorrentes.
* Ativação/desativação de recorrências.
* Categorias de gastos.
* Importação de dados do mês anterior.
* Resumo por categoria.

### Metas

* Cadastro de objetivos financeiros.
* Valor alvo da meta.
* Valor guardado no mês.
* Cálculo de progresso.
* Cálculo de valor restante.

### Resumo anual

* Indicadores consolidados do ano.
* Comparativo mensal de renda, despesas e saldo.
* Gráficos com Chart.js.
* Tabela anual com valores por mês.
* Identificação de melhor e pior mês.

### Perfil e segurança dos dados

* Perfil local com nome e foto.
* Exportação de backup em JSON.
* Importação de backup em JSON.
* Sincronização dos dados com Supabase.
* Proteção para evitar perda de dados entre navegadores/usuários.

---

## Tecnologias utilizadas

* HTML5
* CSS3
* JavaScript ES Modules
* Supabase
* LocalStorage
* Chart.js
* Git e GitHub
* GitHub Pages

---

## Estrutura do projeto

```txt
painel-financeiro/
├── assets/
│   ├── css/
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── login.css
│   │   ├── responsive.css
│   │   └── tema.css
│   ├── img/
│   └── js/
│       ├── ano.js
│       ├── cartao.js
│       ├── cat.js
│       ├── cloudState.js
│       ├── dashboard.js
│       ├── finance.js
│       ├── fixas.js
│       ├── login.js
│       ├── metas.js
│       ├── perfil.js
│       ├── storage.js
│       ├── supabaseClient.js
│       ├── ui.js
│       └── validate.js
├── ano.html
├── cartao.html
├── fixas.html
├── index.html
├── login.html
├── metas.html
├── perfil.html
├── LICENSE
└── README.md
```

---

## Principais decisões técnicas

### Organização por módulos

O JavaScript foi separado em módulos para deixar o projeto mais fácil de manter.

Alguns arquivos importantes:

* `storage.js`: controle de estado local, normalização dos dados e persistência.
* `cloudState.js`: sincronização com Supabase.
* `finance.js`: regras de cálculo financeiro.
* `validate.js`: validações reutilizáveis.
* `ui.js`: autenticação, header, seleção de mês e ações globais.
* Arquivos de páginas: `dashboard.js`, `fixas.js`, `cartao.js`, `metas.js`, `ano.js` e `perfil.js`.

### Estado financeiro centralizado

Os dados são organizados por mês:

```js
{
  months: {
    "2026-05": {
      incomeBase: 4500,
      incomeExtra: [],
      fixed: [],
      card: [],
      cardRecurring: [],
      goals: []
    }
  },
  closedMonths: {}
}
```

Essa estrutura permite separar as movimentações por período, gerar relatórios mensais e montar o resumo anual.

### Backup em JSON

O sistema permite exportar e importar um backup completo dos dados financeiros, incluindo meses, contas fixas, cartão, metas, fechamentos e dados locais do perfil.

Esse recurso foi implementado para aumentar a segurança e confiabilidade da aplicação.

---

## Screenshots

> Adicione aqui prints do projeto.

### Dashboard

```md
![Dashboard](assets/img/screenshots/dashboard.png)
```

### Contas fixas

```md
![Contas fixas](assets/img/screenshots/fixas.png)
```

### Cartão

```md
![Cartão](assets/img/screenshots/cartao.png)
```

### Resumo anual

```md
![Resumo anual](assets/img/screenshots/ano.png)
```

---

## Como executar o projeto

Clone o repositório:

```bash
git clone https://github.com/albanoeraldo/painel-financeiro.git
```

Acesse a pasta:

```bash
cd painel-financeiro
```

Abra o projeto em um servidor local.

Exemplo usando a extensão **Live Server** no VS Code:

```txt
Botão direito no index.html > Open with Live Server
```

---

## Configuração do Supabase

O projeto utiliza Supabase para autenticação e sincronização dos dados.

O arquivo responsável pela conexão é:

```txt
assets/js/supabaseClient.js
```

Exemplo de estrutura:

```js
const SUPABASE_URL = "SUA_URL_DO_SUPABASE";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLICA";
```

Atenção: nunca publique chaves privadas, `service_role`, senhas de banco ou tokens sensíveis.

---

## Status do projeto

Este projeto está na fase de **MVP funcional**.

Ele já possui as principais funcionalidades para controle financeiro pessoal, mas ainda pode evoluir em arquitetura, banco de dados relacional, interface, permissões e experiência de produto.

---

## Roadmap da Versão 2

A próxima etapa será uma versão mais profissional, pensada para portfólio avançado, SaaS e possível uso com clientes.

Stack planejada:

* Next.js
* TypeScript
* Tailwind CSS
* Supabase
* PostgreSQL
* Row Level Security
* React Hook Form
* Zod
* Recharts
* Deploy na Vercel

Funcionalidades planejadas:

* Multiusuário com isolamento real de dados.
* Banco relacional em vez de estado único em JSON.
* Dashboard mais analítico.
* Controle profissional de faturas.
* Histórico de fechamentos.
* Plano de contas/categorias configuráveis.
* Painel administrativo.
* Modo demonstração.
* Versão SaaS com planos e assinatura.
* Melhorias de acessibilidade e responsividade.

---

## Aprendizados

Durante o desenvolvimento deste projeto, foram praticados conceitos como:

* Manipulação de DOM com JavaScript puro.
* Organização de código em módulos.
* Persistência com LocalStorage.
* Sincronização com Supabase.
* Autenticação de usuários.
* Validação de formulários.
* Regras de negócio financeiras.
* Controle de estado.
* Backup e restauração de dados.
* Versionamento com Git e GitHub.
* Deploy com GitHub Pages.

---

## Licença

Este projeto está licenciado sob a licença MIT.

---

## Autor

Desenvolvido por **Eraldo Albano**.

GitHub: [@albanoeraldo](https://github.com/albanoeraldo)
