# **Documentação do Projeto de Acompanhamento Primavera P6**

Este documento detalha a finalidade, o funcionamento, a execução e as lógicas implementadas no sistema de acompanhamento de projetos Primavera P6.

## **1\. Finalidade do Projeto**

O objetivo principal deste projeto é simplificar e otimizar o acompanhamento e a análise de cronogramas e recursos de projetos gerenciados no Primavera P6. Através da importação de ficheiros .xer, ele transforma dados brutos e complexos em dashboards e visualizações interativas e intuitivas, permitindo uma gestão de projeto mais ágil e informada.

## **2\. Arquitetura e Páginas**

O sistema é composto por várias páginas interligadas que funcionam inteiramente no navegador do utilizador, utilizando o localStorage para persistir dados e configurações.

### **2.1. index.html (Página de Upload e Processamento)**

Esta é a porta de entrada dos dados.

- **Interface de Upload**: Permite o envio de ficheiros .xer.
- **Parsing e Transformação**: Lê o ficheiro .xer, converte-o para um formato de tabelas JavaScript e enriquece os dados.
- **Lógica Obrigatória \- Criação da WBS_HIERARCHY**: O coração do sistema. Esta lógica cria uma tabela relacional para a EAP (WBS).
  1. Para cada item da WBS, é gerado um **ID estável e único** (stable_wbs_id), que é o caminho hierárquico completo do item (ex: NÍVEL 1 \> NÍVEL 2 \> NOME). Isto é crucial para que os relacionamentos não se quebrem.
  2. Um campo **wbs_group_id** é criado, contendo apenas o nome do WBS. Isso permite agrupar WBS com o mesmo nome que estão em locais diferentes da hierarquia.
  3. O **nível hierárquico** e a referência ao **pai** (parent_stable_wbs_id) são calculados e armazenados.
  4. Cada atividade na tabela TASK recebe uma referência (wbs_stable_id_ref) ao stable_wbs_id do seu WBS correspondente.

### **2.2. configuracao.html (Painel de Configurações)**

Esta página centraliza todas as configurações do projeto através de uma interface baseada em modais, onde o utilizador fornece metadados e preferências de visualização.

- **Mapeamento de Semanas**: O utilizador faz o upload de uma planilha Excel (.xlsx) com as colunas Semana e Data. O sistema calcula o intervalo (data de início e fim) para cada semana e guarda essa informação.
- **Recurso Principal de Avanço**: Permite selecionar qual recurso (ex: "Hh") será a unidade principal para medir o avanço físico do projeto.
- **Agrupamento da Visão Semanal**: O utilizador pode definir exatamente como as atividades serão agrupadas na página "Próximas Semanas". Pode-se escolher quantos níveis da WBS serão usados e quais são eles (ex: agrupar por Nível 2 e, dentro de cada Nível 2, agrupar por Nível 5).
- **Ocultar Atividades da Visão Semanal**: Oferece um campo de seleção múltipla para escolher atividades (como marcos ou atividades de resumo) que não devem aparecer no dashboard das próximas semanas.
- **Mapeamento de Atividades**: Funcionalidade chave que permite consolidar várias atividades que representam o mesmo trabalho, mas que estão separadas no cronograma. O utilizador pode criar um "grupo" (ex: "Escavação Total C2+C3") e associar a ele múltiplas atividades individuais (ex: "Escavação... 2024" e "Escavação... 2025").

### **2.3. analise_atividade.html (Análise Detalhada)**

Esta página oferece uma análise profunda de uma atividade ou de um grupo de atividades.

- **Seleção Híbrida**: O campo de busca agora lista tanto as atividades individuais quanto os **Grupos de Atividades** criados na configuração.
- **Análise de Atividade Individual**: Mostra o caminho WBS completo (breadcrumb), datas (real ou tendência), predecessoras, sucessoras e um histórico semanal de avanço de recursos com gráfico.
- **Análise de Grupo de Atividades**: Ao selecionar um grupo, a página exibe dados consolidados:
  - **Datas Agregadas**: Apresenta o início planejado mais cedo e o término planejado mais tarde de todas as atividades do grupo. A data de término real é inteligente: se todas as atividades do grupo estão concluídas, mostra a última data real; senão, mostra a data de **tendência** (reend_date) mais tardia entre as atividades não concluídas.
  - **Quantidades Consolidadas por Recurso**: Exibe uma tabela com a soma de quantidades (planejada, realizada, restante) e o progresso percentual para **cada tipo de recurso** alocado às atividades do grupo, considerando apenas os dados do último .xer carregado.
  - **Detalhes das Atividades do Grupo**: Uma tabela lista todas as atividades individuais que compõem o grupo, ordenadas por data de início planejada, com suas respectivas quantidades e status.

### **2.4. proximas_semanas.html (Dashboard de Próximas Semanas)**

Esta página foi redesenhada para uma experiência de navegação focada e interativa.

- **Visualização em Carrossel**: Em vez de uma longa lista, a página exibe uma semana por vez num card grande e centralizado.
- **Navegação Flutuante**: Botões de "Anterior" e "Próxima" ficam fixos nas laterais da tela, permitindo uma navegação fácil mesmo com a rolagem da página. Um indicador de "bolinhas" mostra a posição na sequência de 6 semanas.
- **Agrupamento Personalizado**: A exibição segue rigorosamente a configuração de **Agrupamento da Visão Semanal**.
  - **Lógica de Fallback**: Se uma atividade não se encaixa perfeitamente na hierarquia de agrupamento definida (ex: foi definido agrupar por Nível 2 e 5, mas a atividade está no Nível 3), o algoritmo a posiciona sob seu WBS pai mais próximo dentro da estrutura exibida, garantindo que nenhuma atividade seja perdida.
- **Exibição de Etapas de Grupo**:
  - **Lógica Obrigatória \- Pré-processamento de Etapas**: Ao carregar, a página cria um mapa de consulta (activityStageMap) que, para cada atividade mapeada, armazena o nome do seu grupo, a sua etapa (posição na sequência ordenada por data) e o total de etapas.
  - **Renderização Inteligente**: Ao desenhar a semana, se uma atividade pertence a um grupo, o sistema exibe o nome do grupo e a etapa correspondente (ex: "Bota Fora \- Etapa 2 de 3"). Atividades normais são exibidas com seu código e nome.
- **Grupos WBS Retráteis**: Cada título de WBS na visualização é clicável, permitindo ao utilizador minimizar ou expandir o conteúdo daquele grupo. Um botão "Minimizar/Expandir Tudo" oferece controle global sobre a visualização da semana.
