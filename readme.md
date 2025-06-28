# 📊 **Projeto de Acompanhamento de Cronogramas P6**

Este documento detalha a finalidade, a arquitetura, o fluxo de uso e os algoritmos implementados no sistema de análise e visualização de projetos do Primavera P6.

## 🌟 1. Finalidade do Projeto

O objetivo deste sistema é transformar dados brutos de arquivos `.xer` em dashboards interativos e intuitivos, simplificando a análise de cronogramas e recursos. A ferramenta permite não apenas visualizar os dados do P6, mas também sobrepô-los com valores personalizados (ex: medições topográficas) para uma análise mais fiel à realidade do campo. O sistema foi projetado para facilitar uma gestão de projeto ágil, visual e informada, eliminando a necessidade de planilhas complexas e análises manuais.

## 💾 2. Arquitetura e Fluxo de Dados

O sistema é uma **aplicação 100% client-side**, o que significa que roda inteiramente no navegador do usuário sem depender de um servidor back-end.

> **Persistência de Dados:** Todos os dados, tanto do projeto quanto das configurações, são gerenciados pelo módulo `storage.js`, que abstrai o uso do `localStorage` do navegador. Isso garante privacidade total (os dados nunca saem da máquina do usuário) e o funcionamento offline da aplicação após o primeiro carregamento.

### Fluxo de Trabalho Recomendado

1.  **📤 Upload e Processamento (`index.html`):** O usuário envia um arquivo `.xer` atualizado. Este é o ponto de partida e o passo mais crítico.
2.  **⚙️ Configuração (`configuracao.html`):** O usuário parametriza como os dados serão analisados, adequando a ferramenta à realidade do projeto.
3.  **📈 Análise e Visualização:** Com os dados processados e configurados, o usuário explora as páginas de análise (`proximas_semanas.html`, `analise_atividade.html`).
4.  **📦 Backup (`configuracao.html`):** O usuário exporta todos os dados e configurações para um arquivo `.json`, garantindo a segurança e portabilidade de suas análises.

## 📄 3. Detalhamento das Páginas e Funcionalidades

Todas as páginas contam com uma **barra de navegação lateral**, fixa e responsiva, que é injetada dinamicamente pelo script `utils.js` para garantir uma experiência de usuário coesa.

### `index.html` (Painel Principal e Processador de Dados)

A porta de entrada do sistema. Sua função mais importante é processar os dados brutos.

-   **Interface de Upload:** Permite o envio de arquivos `.xer` via seletor ou drag-and-drop.
-   **Lógica Principal (`transformData()`):** Esta função é o coração do sistema, responsável por transformar dados crus em informação estruturada.
    -   **Criação da Hierarquia WBS:** Constrói um **ID estável (`stable_wbs_id`)** para cada item da WBS (EAP), que consiste no caminho completo do item (ex: `PROJETO > ÁREA 1 > EDIFÍCIO A`). Isso é vital para que os relacionamentos hierárquicos se mantenham íntegros.
    -   **Enriquecimento de Dados:** IDs técnicos (de predecessoras, recursos, etc.) são "traduzidos" para seus nomes e códigos legíveis.

### `configuracao.html` (Painel de Configurações)

Centraliza todas as parametrizações da aplicação através de uma interface de modais.

-   **Mapeamento de Atividades:** Permite criar **grupos lógicos de atividades**. Por exemplo, "Escavação Bloco A - Etapa 1" e "Escavação Bloco A - Etapa 2" podem ser agrupados como "Escavação Bloco A". A lógica impede que uma mesma atividade pertença a múltiplos grupos.
-   **Valores Personalizados:** Permite ao usuário inserir valores "Previsto" e "Realizado" que se **sobrepõem** aos do cronograma. Pode ser aplicado a atividades individuais ou a grupos. Ideal para registrar medições de campo (topografia, engenharia) que refletem o avanço real.
-   **Agrupamento e Ocultação:** Oferece controle granular sobre a exibição das atividades no dashboard de próximas semanas, permitindo focar em níveis hierárquicos específicos e ocultar itens de baixo impacto.
-   **Importar & Exportar:** Utiliza o módulo `storage.js` para criar um backup (`.json`) com um snapshot completo de **todos os dados de projetos e configurações** salvas. Essencial para segurança e portabilidade.

### `proximas_semanas.html` (Dashboard de Próximas Semanas)

Página interativa para visualização do planejamento de curto prazo (6 semanas futuras).

-   **Navegação em Carrossel:** Exibe uma semana por vez, com navegação intuitiva.
-   **Hierarquia Retrátil Inteligente e Robusta:** Os grupos de WBS são aninhados e podem ser expandidos/colapsados. A lógica de animação é complexa, utilizando o evento `transitionend` para criar uma "reação em cadeia", garantindo que os contêineres pai se redimensionem perfeitamente mesmo com múltiplos níveis de aninhamento, eliminando bugs visuais.
-   **Exibição Consolidada:** Atividades de um mesmo grupo mapeado são exibidas de forma unificada, mostrando o nome do grupo e a etapa (`Etapa 1 de 3`), simplificando a visualização.
-   **Tooltip de Saldo:** Ao passar o mouse sobre um item com valores personalizados, um tooltip exibe o **"Saldo Topográfico"**, fornecendo um insight rápido do avanço real.

### `analise_atividade.html` (Análise Detalhada)

Oferece uma visão profunda e comparativa de uma atividade ou grupo.

-   **Busca Híbrida:** Permite buscar e analisar tanto atividades individuais quanto grupos.
-   **Card de Análise Topográfica:** Se o item selecionado possui valores personalizados, um card especial e destacado exibe o previsto, realizado, saldo e o percentual de avanço com base nesses valores, permitindo uma **comparação direta e imediata** entre o avanço do cronograma e o avanço medido em campo.
-   **Gráfico de Evolução:** Mostra a evolução histórica de recursos para atividades individuais.

### `visualizador.html` (Visualizador de Tabelas)

Ferramenta de utilidade para desenvolvedores e usuários avançados que precisam inspecionar os dados brutos ou transformados armazenados no sistema, ideal para depuração e verificação de integridade.

## 🧠 4. Lógicas e Algoritmos Principais (Para Desenvolvedores)

Esta seção detalha as implementações-chave que sustentam as funcionalidades do sistema.

### 4.1. Camada de Abstração de Dados (`storage.js`)

-   **Objetivo:** Centralizar e abstrair toda a interação com o `localStorage`. Esta é a mudança arquitetural mais importante para a manutenibilidade do projeto.
-   **Benefícios:**
    -   **Ponto Único de Modificação:** Se quisermos migrar para `IndexedDB` ou uma API de nuvem no futuro, apenas `storage.js` precisa ser alterado.
    -   **Robustez:** A função `getData` lida com dados ausentes ou erros de parsing, retornando valores padrão seguros (`STORAGE_DEFAULTS`), o que previne erros no resto da aplicação.
    -   **Código Limpo:** As páginas da aplicação não se preocupam com `JSON.stringify` ou `JSON.parse`, apenas chamam métodos simples como `storage.getData()` e `storage.saveData()`.

    ```javascript
    // Exemplo de uso nas páginas
    // Antes: const data = JSON.parse(localStorage.getItem('allProjectsData') || '{}');
    // Agora:
    const allProjectsData = storage.getData(storage.APP_KEYS.PROJECTS_DATA_KEY);
    ```

### 4.2. Processamento do `.XER` e Criação da Hierarquia Estável

-   **Função Principal:** `transformData()` em `index.html`.
-   **Problema:** Os IDs de WBS (`wbs_id`) no Primavera P6 são numéricos e podem mudar entre as versões do cronograma. Usá-los como referência direta levaria a inconsistências.
-   **Solução:** Foi criado um **ID Estável (`stable_wbs_id`)**.
    1.  O algoritmo primeiro mapeia todos os itens da WBS (`PROJWBS`) em um `Map` para acesso rápido.
    2.  Ele percorre recursivamente a árvore hierárquica de cada item da WBS, concatenando os nomes de cada nível para formar um caminho legível e único (ex: `"Projeto X > Área Y > Disciplina Z"`).
    3.  Este caminho se torna o `stable_wbs_id`, que é então usado em toda a aplicação como a chave primária para a hierarquia, garantindo consistência entre diferentes arquivos `.xer`.

### 4.3. Geração da Visão Hierárquica no Dashboard Semanal

-   **Função Principal:** `buildGroupedTreeRecursive()` em `proximas_semanas.html`.
-   **Objetivo:** Montar a estrutura de árvore aninhada das atividades com base nos níveis de WBS que o usuário selecionou na configuração.
-   **Implementação:**
    1.  A função recebe um item (atividade ou grupo), um array dos níveis de WBS para agrupar (ex: `[1, 3]`) e a árvore de dados da semana atual.
    2.  De forma recursiva, ela "desce" pela árvore, usando o `stable_wbs_id` da atividade para encontrar o nó correspondente em cada nível de agrupamento definido.
    3.  Quando todos os níveis de agrupamento foram percorridos, a atividade é inserida na folha correta da árvore. Se um nível intermediário não existir, ele é criado dinamicamente.
    4.  O resultado é um objeto JavaScript aninhado que espelha a estrutura hierárquica desejada, pronto para ser renderizado em HTML.

### 4.4. Agregação de Dados para Grupos de Atividades

-   **Função Principal:** `displayGroupAnalysis()` em `analise_atividade.html`.
-   **Desafio:** Ao analisar um grupo, é preciso consolidar as informações de múltiplas atividades individuais em uma única visão coerente.
-   **Lógica de Agregação:**
    -   **Recursos:** As quantidades (planejada, real, restante) de um mesmo recurso são somadas (`reduce`) em todas as atividades do grupo.
    -   **Datas Agregadas:**
        -   `target_start_date`: Usa a data de início planejada **mais antiga** entre todas as atividades.
        -   `target_end_date`: Usa a data de término planejada **mais tardia**.
        -   `act_start_date`: Usa a data de início real **mais antiga**.
        -   `aggr_end_date`: Usa a data de término real **mais tardia** se todas as atividades tiverem terminado. Caso contrário, usa a data de término prevista (tendência) **mais tardia** para refletir a projeção atual.

### 4.5. Gerenciamento de Componentes de UI (`utils.js`)
-   **Função Principal:** `insertHeader()`
-   **Design:** Para evitar a repetição de código HTML e JavaScript, a barra de navegação é gerada e injetada dinamicamente em cada página.
-   **Implementação:**
    - A função `insertHeader()` constrói o HTML da barra de navegação lateral.
    - Ela detecta a página atual (`window.location.pathname`) para aplicar a classe `active` ao link correto.
    - Ela anexa os event listeners necessários para a funcionalidade de expansão/recolhimento e para o menu mobile.
    - Chamar esta única função no início de cada página garante uma UI consistente e centraliza a lógica de navegação.

### 4.6. Animação Robusta de Hierarquias Retráteis (`proximas_semanas.html`)

-   **O Problema:** A animação da altura (`max-height`) de elementos aninhados é um desafio clássico no desenvolvimento web. Uma abordagem ingênua de recalcular a altura do "pai" (`scrollHeight`) imediatamente após alterar o "filho" falha devido a **"condições de corrida" (race conditions)**. O navegador não atualiza o `scrollHeight` do pai a tempo, resultando em conteúdo cortado ou saltos na animação.

-   **A Solução: Reação em Cadeia com `transitionend`**
    - Para resolver isso, implementamos uma lógica assíncrona que se sincroniza com o ciclo de renderização do navegador, criando uma "reação em cadeia".
    1.  **Início da Animação:** No clique, a `max-height` do elemento alvo é alterada para `0px` (colapsar) ou para sua `scrollHeight` (expandir), iniciando a transição CSS.
    2.  **Fim da Animação:** Um listener de evento `transitionend` aguarda o término da animação do elemento.
    3.  **Notificação ao Pai:** Quando a animação de um "filho" termina, o código sobe na hierarquia do DOM e encontra o primeiro ancestral `.wbs-content` que está expandido.
    4.  **Animação do Pai:** A `scrollHeight` desse ancestral agora é diferente. O código atualiza a `max-height` do ancestral para sua nova `scrollHeight`, disparando sua própria animação de redimensionamento.
    5.  **Propagação em Cascata:** Esse processo se repete recursivamente para cima. Quando a animação do pai termina, ele notifica o avô, e assim por diante.
    6.  **Liberação da Altura (`max-height: none`):** Após um elemento concluir sua *expansão*, sua `max-height` é definida como `none`. Este passo crucial permite que ele se ajuste dinamicamente ao conteúdo de seus filhos sem precisar de uma nova animação, tornando a interação subsequente mais suave.

-   **Conclusão:** Essa arquitetura, embora mais complexa, é a única que garante uma experiência de usuário fluida e sem falhas visuais, independentemente da profundidade da hierarquia ou da sequência de interações do usuário.
