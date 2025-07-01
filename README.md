# 📊 **ChronoFlow: Acompanhamento de Cronogramas P6**

Este documento detalha a finalidade, a arquitetura, o fluxo de uso e os algoritmos implementados no sistema de análise e visualização de projetos do Primavera P6, ChronoFlow.

## 🌟 1. Finalidade do Projeto

O objetivo do ChronoFlow é transformar dados brutos de arquivos `.xer` em dashboards interativos e intuitivos, simplificando a análise de cronogramas e recursos. A ferramenta permite não apenas visualizar os dados do P6, mas também sobrepô-los com valores personalizados (ex: medições topográficas) e gerenciar proativamente as restrições do projeto. O sistema foi projetado para facilitar uma gestão de projeto ágil, visual e informada, eliminando a necessidade de planilhas complexas e análises manuais.

## 💾 2. Arquitetura e Fluxo de Dados

O sistema é uma aplicação web moderna que roda inteiramente no navegador, utilizando **Firebase Cloud Firestore** para persistência de dados. A arquitetura foi projetada para máxima eficiência e escalabilidade, refletindo o fluxo de trabalho de um projeto contínuo que recebe atualizações semanais.

### Estrutura de Dados Otimizada no Firestore

Para evitar redundância e garantir performance, os dados são organizados em três coleções principais:

1.  **`p6-app-data` (Configurações Globais):** Armazena todas as configurações da aplicação que são independentes do projeto, como mapeamento de semanas, recurso principal, agrupamentos, etc. As configurações de restrições também ficam aqui, de forma normalizada.

2.  **`project_base` (Dados Estáticos do Projeto):** Contém os dados fundamentais do projeto que raramente ou nunca mudam. Esta coleção terá **apenas um documento**, representando o esqueleto do cronograma. As tabelas salvas aqui são `TASK`, `RSRC`, `WBS_HIERARCHY`, etc.

3.  **`project_versions` (Avanço Semanal):** Cada documento nesta coleção é um "snapshot" ou uma "versão" do projeto, correspondente a um arquivo `.xer` carregado. Contém apenas os dados que mudam a cada semana, como `TASKRSRC` (o avanço dos recursos) e `TASKPRED`.

> **Vantagem Principal:** Em vez de salvar o cronograma inteiro (muitos megabytes) toda semana, salvamos apenas alguns kilobytes de dados de avanço. Isso torna o sistema mais rápido, mais barato e imensamente mais escalável.

### Fluxo de Trabalho Recomendado

1.  **📤 Upload e Processamento (`index.html`):** O usuário envia um arquivo `.xer` atualizado.
    - **Primeiro Upload:** O sistema detecta que não há dados base e salva as tabelas estáticas (`TASK`, `RSRC`, etc.) na coleção `project_base`.
    - **Uploads Subsequentes:** O sistema reconhece que os dados base já existem e salva apenas as tabelas de avanço (`TASKRSRC`, `TASKPRED`) como uma nova versão em `project_versions`.
2.  **⚙️ Configuração (`configuracao.html`):** O usuário parametriza como os dados serão analisados. As configurações são aplicadas sobre os dados base e as versões.
3.  **📈 Análise e Visualização:** As páginas de análise (`proximas_semanas.html`, `analise_atividade.html`) carregam os dados base e as versões relevantes, combinando-os em tempo real para apresentar uma visão completa e atualizada.
4.  **📦 Backup (`configuracao.html`):** O usuário exporta todos os dados (configurações, base e versões) para um arquivo `.json`, garantindo a segurança e portabilidade.

## 📄 3. Detalhamento das Páginas e Funcionalidades

Todas as páginas contam com uma **barra de navegação lateral**, fixa e responsiva, que é injetada dinamicamente pelo script `utils.js` para garantir uma experiência de usuário coesa.

### `index.html` (Painel Principal e Processador de Dados)

A porta de entrada do sistema. Sua função mais importante é processar os dados brutos de forma inteligente.

- **Interface de Upload:** Permite o envio de arquivos `.xer` via seletor ou drag-and-drop.
- **Lógica Principal (`transformData()`):** Esta função é o coração do sistema, responsável por transformar dados crus em informação estruturada.
  - **Criação da Hierarquia WBS:** Constrói um **ID estável (`stable_wbs_id`)** para cada item da WBS (EAP), que consiste no caminho completo do item (ex: `PROJETO > ÁREA 1 > EDIFÍCIO A`). Isso é vital para que os relacionamentos hierárquicos se mantenham íntegros.
  - **Enriquecimento de Dados:** IDs técnicos (de predecessoras, recursos, etc.) são "traduzidos" para seus nomes e códigos legíveis.

### `configuracao.html` (Painel de Configurações)

Centraliza todas as parametrizações da aplicação através de uma interface de modais.

- **Gerenciamento de Restrições:**
  - **Centralizado:** Permite criar, editar e excluir todas as restrições do projeto em um único local.
  - **Muitos-para-Muitos:** Uma mesma restrição (ex: "Atraso na liberação de engenharia") pode ser vinculada a múltiplas atividades ou grupos, refletindo a realidade de projetos complexos.
- **Mapeamento de Atividades:** Permite criar **grupos lógicos de atividades**. Por exemplo, "Escavação Bloco A - Etapa 1" e "Escavação Bloco A - Etapa 2" podem ser agrupados como "Escavação Bloco A". A lógica impede que uma mesma atividade pertença a múltiplos grupos.
- **Valores Personalizados:** Permite ao usuário inserir valores "Previsto" e "Realizado" que se **sobrepõem** aos do cronograma. Pode ser aplicado a atividades individuais ou a grupos. Ideal para registrar medições de campo (topografia, engenharia) que refletem o avanço real.
- **Importar & Exportar:** Utiliza o módulo `storage.js` para criar um backup (`.json`) com a estrutura completa das coleções `p6-app-data`, `project_base` e `project_versions`, garantindo a segurança e portabilidade.

### `proximas_semanas.html` (6-Week Look Ahead)

Esta página é uma ferramenta interativa de planejamento proativo, projetada para ser o centro das reuniões de **6WLA (Six Week Look Ahead)**.

- **Navegação em Carrossel:** Exibe uma semana por vez, permitindo focar no horizonte de tempo relevante.
- **Gerenciamento de Restrições:** Clicar em qualquer atividade abre um modal dedicado onde a equipe pode:
  - **Adicionar** uma nova restrição e vinculá-la imediatamente.
  - **Vincular** uma restrição já existente no sistema à atividade em análise.
  - **Desvincular** um impedimento de uma atividade sem excluí-lo.
- **Indicadores Visuais:** Atividades com restrições pendentes são marcadas com um emblema de bandeira (🚩), chamando atenção imediata para os pontos que necessitam de ação.

### `analise_atividade.html` (Análise Detalhada)

Oferece uma visão profunda e comparativa de uma atividade ou grupo.

- **Busca Híbrida:** Permite buscar e analisar tanto atividades individuais quanto grupos.
- **Card de Análise Topográfica:** Se o item selecionado possui valores personalizados, um card especial e destacado exibe o previsto, realizado, saldo e o percentual de avanço com base nesses valores, permitindo uma **comparação direta e imediata** entre o avanço do cronograma e o avanço medido em campo.
- **Gráfico de Evolução:** Mostra a evolução histórica de recursos para atividades individuais, consolidando dados de todas as `project_versions` salvas.

### `visualizador.html` (Visualizador de Tabelas)

Ferramenta de utilidade para desenvolvedores e usuários avançados que precisam inspecionar os dados brutos ou transformados armazenados no sistema, ideal para depuração e verificação de integridade.

## ✨ 4. Novas Funcionalidades e Melhorias

O ChronoFlow evoluiu para oferecer uma experiência de usuário mais moderna, performática e agradável.

### 🚀 Experiência do Usuário (UX) Aprimorada

- **Feedback Visual Imediato:** Ações assíncronas, como salvar ou importar dados, agora desabilitam os botões de ação e exibem um estado de "Salvando...", prevenindo cliques duplicados e informando claramente ao usuário que o sistema está trabalhando.
- **Notificações "Toast":** Mensagens de sucesso ou erro agora aparecem como notificações "toast" discretas no canto da tela, que desaparecem sozinhas, proporcionando um feedback não-intrusivo.
- **"Skeleton Loaders":** As mensagens de texto "Carregando..." foram substituídas por animações "skeleton" (esqueleto da interface), que melhoram a percepção de velocidade e tornam o carregamento de dados mais agradável.

### ⚡ Performance Otimizada

- **Carregamento Sob Demanda no 6WLA:** A página "6-Week Look Ahead" agora utiliza uma estratégia de "lazy loading". Em vez de processar os dados de todas as 6 semanas de uma vez, os dados são processados e renderizados sob demanda, apenas quando o usuário navega para uma semana específica. Isso resulta em um carregamento inicial da página drasticamente mais rápido, especialmente em projetos grandes.

## 🎨 5. Design System e Estilização

Para garantir uma interface coesa, moderna e de fácil manutenção, o ChronoFlow adota uma arquitetura de estilização bem definida.

### 5.1. Tema Noturno e Variáveis CSS

- **Funcionalidade:** Um tema escuro completo e esteticamente agradável foi implementado em toda a aplicação para melhorar o conforto visual em ambientes com pouca luz e reduzir o cansaço ocular.
- **Persistência:** A escolha do tema (claro ou escuro) é salva no `localStorage` do navegador, mantendo a preferência do usuário entre as visitas.
- **Implementação:** A tematização é controlada por variáveis CSS definidas no `:root`. A classe `.dark` no `<html>` ativa um conjunto diferente de valores para essas variáveis, alterando instantaneamente a aparência de toda a aplicação.

### 5.2. Arquitetura de CSS Semântico (Convivência com Tailwind)

- **O Problema:** Durante a implementação, foi identificado um conflito de especificidade com o script do Tailwind CSS. O Tailwind, ao ser executado no cliente, injetava suas classes de utilitário (`text-gray-600`, etc.) no HTML após o nosso `styles.css`, fazendo com que as regras do Tailwind sobrescrevessem as customizações para o modo escuro.
- **A Solução:** Em vez de lutar contra a especificidade do Tailwind, a arquitetura foi refatorada para trabalhar em harmonia com ele. Foram criadas **classes semânticas** (ex: `.text-primary`, `.bg-secondary`) em `styles.css`. Essas classes utilizam as variáveis de cor do tema (`--color-text-primary`, `--color-bg-secondary`). Nos arquivos HTML e templates JavaScript, as classes de cor do Tailwind foram substituídas por essas novas classes semânticas.
- **Benefícios:** Esta abordagem elimina o conflito de ordem de carregamento, torna o HTML mais legível e garante que o sistema de temas funcione de forma robusta e previsível. A manutenção das cores é centralizada nas variáveis CSS, facilitando futuros ajustes de design.

## ♿️ 6. Acessibilidade (A11y)

Um grande esforço foi dedicado para tornar o ChronoFlow uma ferramenta acessível e utilizável por todos.

- **Navegação Completa por Teclado:** Toda a aplicação é 100% operável utilizando apenas o teclado. Elementos interativos como botões, links e campos de formulário são alcançáveis via `Tab`, e podem ser ativados com `Enter` ou `Espaço`.
- **Gerenciamento de Foco Inteligente:**
  - **"Focus Trap" em Modais:** Quando um modal é aberto, o foco do teclado fica "preso" dentro dele, impedindo a navegação acidental para elementos da página ao fundo. Ao fechar, o foco retorna para o elemento que o abriu.
  - **Indicador de Foco Visível:** Um anel de foco claro e consistente (`outline`) aparece em todos os elementos interativos durante a navegação por teclado, garantindo que o usuário sempre saiba onde está.
  - **Navegação Consciente de Contexto:** Na página "6WLA", a navegação por `Tab` agora ignora de forma inteligente os itens que estão dentro de um grupo WBS recolhido, proporcionando uma experiência mais limpa e lógica.
- **Suporte a Leitores de Tela (ARIA):**
  - **Rótulos e Papéis:** Atributos ARIA (Accessible Rich Internet Applications) como `aria-label`, `role` e `aria-current` são utilizados para dar contexto e significado a ícones, botões e menus, descrevendo a interface para tecnologias assistivas.
  - **Anúncios Dinâmicos:** "Live regions" (`aria-live`) são usadas para anunciar vocalmente as notificações "toast" e as mudanças de estado de carregamento de dados, mantendo os usuários de leitores de tela informados sobre o que está acontecendo na aplicação.

## 🔒 7. Segurança

É crucial entender como a segurança funciona em uma aplicação como o ChronoFlow, que roda inteiramente no navegador do cliente (client-side).

### 7.1. As Chaves em `firebase-config.js` são Públicas por Design

Você notará que o arquivo `firebase-config.js` contém chaves de configuração do seu projeto Firebase. É importante saber que **essas chaves não são segredos**. Elas são identificadores públicos que o Google utiliza para direcionar as requisições do seu aplicativo para o projeto Firebase correto. Qualquer pessoa que visitar o seu site poderá ver essas chaves.

Tentar "esconder" essas chaves usando variáveis de ambiente ou segredos do GitHub **não é aplicável nem eficaz** para uma aplicação client-side.

### 7.2. A Segurança Real está nas **Firebase Security Rules**

A verdadeira proteção dos seus dados não está em ocultar as chaves de configuração, mas sim em definir quem pode ler e escrever no seu banco de dados. Isso é feito através das **Regras de Segurança do Firebase (Firebase Security Rules)**, que são configuradas diretamente no painel do seu projeto Firebase.

**Exemplo:** Se você quiser que apenas usuários autenticados possam ler e escrever dados, você usaria uma regra como esta:

```json
// No painel do Firebase -> Firestore Database -> Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permite leitura e escrita apenas se o usuário estiver logado.
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Com esta regra, mesmo que alguém copie suas chaves do `firebase-config.js`, não conseguirá acessar ou modificar seus dados, pois não estará autenticado na sua aplicação.

> **Recomendação Forte:** Sempre configure suas Regras de Segurança para serem o mais restritivas possível, garantindo a proteção e a integridade dos seus dados.

## 🧠 8. Lógicas e Algoritmos Principais (Para Desenvolvedores)

Esta seção detalha as implementações-chave que sustentam as funcionalidades do sistema.

### 8.1. Camada de Abstração de Dados (`storage.js`)

- **Objetivo:** Centralizar e abstrair toda a interação com o **Firebase Cloud Firestore**. Esta é a mudança arquitetural mais importante, pois desacopla a lógica da aplicação da implementação do banco de dados.
- **Novas Funções:**
  - `getProjectBase()`: Busca o único documento da coleção `project_base`.
  - `saveProjectBase()`: Salva os dados estáticos do projeto.
  - `getProjectVersions()`: Busca todos os documentos da coleção `project_versions`.
  - `saveProjectVersion()`: Salva um novo documento de avanço semanal.
- **Benefícios:**

  - **Ponto Único de Modificação:** Toda a lógica do Firestore reside aqui. Se no futuro a aplicação precisar usar outra tecnologia de banco de dados, apenas `storage.js` precisará ser reescrito.
  - **Gerenciamento da Assincronicidade:** O módulo lida com a natureza assíncrona das chamadas de rede para o Firestore, retornando `Promises`.
  - **Robustez:** A função `getData` retorna valores padrão seguros, prevenindo erros de `null` ou `undefined`.
  - **API Simplificada:** As páginas da aplicação consomem uma API semântica e de alto nível, sem se preocupar com a complexidade do Firestore.

  ```javascript
  // Exemplo de uso nas páginas da aplicação
  const projectBase = await storage.getProjectBase();
  const allVersions = await storage.getProjectVersions();
  const latestVersionId = utils.getLatestProjectId(allVersions);
  const latestProjectData = { ...projectBase, ...allVersions[latestVersionId] };
  ```

### 8.2. Processamento do `.XER` e Criação da Hierarquia Estável

- **Função Principal:** `transformData()` em `index.js`.
- **Problema:** Os IDs de WBS (`wbs_id`) no Primavera P6 são numéricos e podem mudar. Usá-los como referência direta levaria a inconsistências.
- **Solução:** Foi criado um **ID Estável (`stable_wbs_id`)**. O algoritmo percorre recursivamente a árvore hierárquica de cada item da WBS, concatenando os nomes de cada nível para formar um caminho legível e único (ex: `"Projeto X > Área Y > Disciplina Z"`). Este caminho se torna a chave primária para a hierarquia.

### 8.3. Modelo de Dados de Restrições Normalizado

- **Objetivo:** Permitir que uma restrição seja vinculada a múltiplas atividades (relação muitos-para-muitos).
- **Implementação (`storage.js`):**
  - `RESTRICTIONS_LIST_KEY`: Armazena uma lista central de todos os objetos de restrição únicos `{id, desc, resp, due, status}`.
  - `RESTRICTION_LINKS_KEY`: Armazena os vínculos, com objetos do tipo `{restrictionId, itemId}`.
- **Vantagem:** Este modelo normalizado evita a duplicação de dados, é mais escalável e permite a gestão centralizada das restrições.

### 8.4. Geração da Visão Hierárquica no Dashboard Semanal

- **Função Principal:** `buildGroupedTreeRecursive()` em `proximas_semanas.js`.
- **Objetivo:** Montar a estrutura de árvore aninhada das atividades com base nos níveis de WBS que o usuário selecionou na configuração.
- **Implementação:** A função recebe uma atividade, um array dos níveis de WBS para agrupar (ex: `[1, 3]`) e a árvore de dados da semana. De forma recursiva, ela "desce" pela árvore, usando o `stable_wbs_id` da atividade para encontrar o nó correspondente em cada nível e inserir a atividade na folha correta.
- **Otimização:** Para melhorar a performance, os dados de cada semana são processados e cacheados sob demanda ("lazy loading"), apenas na primeira vez que o usuário navega para ela.

### 8.5. Animação Robusta de Hierarquias Retráteis

- **O Problema:** Animar a altura de elementos aninhados é um desafio. Uma abordagem ingênua falha devido a "condições de corrida" na renderização do navegador, resultando em conteúdo cortado ou saltos na animação.
- **A Solução: Reação em Cadeia com `transitionend`**
  - Implementamos uma lógica que se sincroniza com o ciclo de renderização do navegador.
  1.  A animação de um "filho" é iniciada.
  2.  Um listener de evento `transitionend` aguarda o término da animação.
  3.  Ao terminar, o código notifica o "pai", que recalcula sua própria altura e inicia sua própria animação de redimensionamento.
  4.  Esse processo se repete recursivamente para cima, garantindo uma experiência de usuário fluida e sem falhas visuais.

### 8.6. Gestão de Foco para Acessibilidade

- **"Focus Trap":** Uma função reutilizável monitora os eventos de teclado (`Tab`) quando um modal está ativo. Ela calcula a lista de elementos focáveis dentro do modal e "prende" a navegação a essa lista, redirecionando o foco do último para o primeiro elemento (e vice-versa), garantindo uma experiência de teclado contínua e acessível.
- **Foco Inteligente:** A lógica de expansão/recolhimento das seções WBS também gerencia o atributo `tabindex` dos elementos internos, removendo da ordem de navegação os itens que não estão visíveis.

## 🚀 9. Melhorias Futuras

O ChronoFlow foi projetado para ser uma plataforma robusta e evolutiva. Algumas melhorias planejadas para o futuro incluem:

- **📄 Geração de Relatórios em PDF:** Criar uma funcionalidade para exportar as visualizações principais (como o card de uma semana do 6WLA) para um arquivo PDF limpo e profissional, facilitando o compartilhamento e a impressão.
- **🤖 Análise Inteligente com IA:** Integrar a API do Google Gemini para oferecer análises proativas. Por exemplo, ao gerenciar restrições, a IA poderia sugerir um plano de ação concreto para mitigar os riscos identificados.
- **🔗 Integração com APIs:** Explorar a possibilidade de se conectar diretamente a APIs de sistemas de planejamento (como o próprio P6, se disponível) para automatizar o processo de upload de dados.
- **🔧 Dashboards Personalizáveis:** Permitir que os usuários criem seus próprios dashboards, selecionando os gráficos e indicadores mais relevantes para suas necessidades.
