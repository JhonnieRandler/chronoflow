# **Documentação do Projeto de Acompanhamento Primavera P6 (Versão Final)**

Este documento detalha a finalidade, a arquitetura, o fluxo de uso e as lógicas implementadas no sistema de acompanhamento de projetos do Primavera P6.

## **1\. Finalidade do Projeto**

O objetivo principal deste sistema é simplificar e otimizar a análise de cronogramas e recursos de projetos gerenciados no Primavera P6. A ferramenta transforma dados brutos de arquivos .xer em dashboards e visualizações interativas e intuitivas. Ela permite não apenas visualizar os dados do cronograma, mas também sobrepô-los com valores personalizados (topográficos) para uma análise mais fiel à realidade do campo, facilitando uma gestão de projeto ágil e informada.

## **2\. Arquitetura e Fluxo de Dados**

O sistema é uma aplicação web que roda 100% no navegador do usuário (client-side), sem a necessidade de um servidor back-end. Todos os dados, tanto do projeto quanto das configurações, são persistidos no localStorage do navegador.

O fluxo de trabalho recomendado é:

1. **Upload e Processamento (index.html):** O usuário inicia enviando um arquivo .xer atualizado. Este passo é crucial, pois é aqui que todos os dados brutos são lidos, processados e estruturados.  
2. **Configuração (configuracao.html):** O usuário acessa o painel de configurações para parametrizar como os dados serão analisados. Isso inclui definir o calendário, agrupar atividades, inserir valores personalizados, etc.  
3. **Análise e Visualização:** Com os dados processados e configurados, o usuário pode explorar as páginas de análise (proximas\_semanas.html, analise\_atividade.html) para extrair insights.  
4. **Backup (configuracao.html):** Periodicamente, o usuário pode exportar todos os dados e configurações para um arquivo de backup, garantindo a segurança e a portabilidade das suas análises.

## **3\. Detalhamento dos Arquivos (Páginas)**

### **3.1. index.html (Painel de Controle e Processador de Dados)**

Esta é a porta de entrada do sistema.

* **Interface de Upload:** Permite o envio de arquivos .xer através de um seletor ou da funcionalidade de arrastar e soltar (drag-and-drop).  
* **Painel de Navegação:** Após o processamento, a página exibe um resumo dos projetos carregados e botões de navegação claros para as outras seções da ferramenta.  
* **Lógica Essencial \- transformData():** Esta é a função mais importante do sistema. Ao receber os dados do .xer, ela realiza um profundo trabalho de transformação e enriquecimento:  
  * **Criação da Hierarquia WBS (WBS\_HIERARCHY):**  
    1. Para cada item da WBS (EAP), a função percorre a árvore hierárquica até a raiz para construir um **ID estável e único (stable\_wbs\_id)**. Este ID é o caminho completo do item (ex: PROJETO \> ÁREA 1 \> EDIFÍCIO A). Isso é vital para que os relacionamentos não se quebrem, mesmo que os IDs internos do P6 mudem.  
    2. O item raiz da WBS é corretamente identificado, e seus filhos diretos são marcados como sendo de nível 1, sem um "pai" visível na hierarquia da aplicação.  
  * **Enriquecimento de Dados:**  
    1. **Relacionamentos (Predecessoras/Sucessoras):** A função traduz os IDs técnicos da tabela TASKPRED (ex: task\_id) para os códigos de atividade legíveis (task\_code), permitindo que a página de análise mostre os relacionamentos corretamente.  
    2. **Atribuição de WBS:** Cada atividade na tabela TASK recebe uma referência (wbs\_stable\_id\_ref) ao stable\_wbs\_id de seu WBS correspondente.  
    3. Demais tabelas como TASKRSRC e TASKACTV também são enriquecidas com códigos e nomes legíveis.

### **3.2. configuracao.html (Painel de Configurações)**

Esta página centraliza todas as configurações do projeto através de uma interface de modais com cabeçalho e rodapé fixos, proporcionando uma excelente experiência de usuário.

* **Mapeamento de Semanas:** Permite ao usuário fazer o upload (ou arrastar) de uma planilha Excel (.xlsx) com as colunas "Semana" e "Data" para definir os períodos de análise.  
* **Recurso Principal:** Permite selecionar qual recurso (ex: "Hh") será a unidade principal para medir o avanço físico.  
* **Agrupamento e Ocultação:** Oferece controle granular sobre como as atividades serão exibidas no dashboard semanal.  
* **Mapeamento de Atividades:**  
  * **Interface em Tabela:** Os grupos de atividades são gerenciados em uma tabela clara e ordenada alfabeticamente.  
  * **Validação de Exclusividade:** A lógica impede que uma mesma atividade seja adicionada a mais de um grupo, garantindo a integridade dos dados. As atividades já alocadas não aparecem na lista de seleção.  
* **Valores Personalizados:**  
  * Permite ao usuário inserir valores "Previsto" e "Realizado" que se sobrepõem aos do cronograma (ex: valores de topografia).  
  * A interface também é em formato de tabela, e a lógica impede que um mesmo item (atividade ou grupo) tenha mais de uma entrada de valor personalizado.  
* **Importar & Exportar:**  
  * **Exportar:** Cria um arquivo .json contendo um backup completo de **todos os dados de projetos e configurações** armazenados no localStorage.  
  * **Importar:** Permite carregar um arquivo de backup .json, substituindo todos os dados atuais e restaurando o estado do sistema.

### **3.3. proximas\_semanas.html (Dashboard de Próximas Semanas)**

Página interativa para visualização do planejamento de curto prazo.

* **Visão Futura:** A análise sempre começa a partir da **semana seguinte** à semana atual, focando estritamente no planejamento futuro.  
* **Navegação em Carrossel:** Exibe uma semana por vez, com navegação intuitiva através de botões laterais fixos e indicadores visuais.  
* **Filtros de Atividades:** Permite filtrar a visualização para mostrar apenas atividades que **iniciam**, **finalizam** ou estão **em andamento** na semana.  
* **Tooltip de Saldo:** Ao passar o mouse sobre uma atividade ou grupo que possui valores personalizados, um tooltip exibe o "Saldo Topográfico" restante, fornecendo um insight rápido sem sair da tela.  
* **Hierarquia Retrátil Inteligente:** Os grupos de WBS podem ser expandidos ou colapsados. A lógica foi aprimorada para que, ao expandir um item, todos os seus contêineres "pai" se ajustem dinamicamente em altura, garantindo que nenhum conteúdo fique oculto.

### **3.4. analise\_atividade.html (Análise Detalhada)**

Oferece uma visão profunda e comparativa de uma atividade ou grupo.

* **Busca Híbrida:** O campo de seleção permite buscar tanto por atividades individuais quanto por grupos de atividades mapeados.  
* **Análise Comparativa:**  
  * Exibe os dados padrão vindos do cronograma (datas, durações, progresso de recursos).  
  * Se um item possui valores personalizados, um card destacado de "Análise de Valores Topográficos" é exibido, mostrando o previsto, o realizado, o saldo e o percentual de avanço genuínos, permitindo uma comparação direta com os dados do cronograma.

### **3.5. visualizador.html (Visualizador de Tabelas)**

Uma ferramenta de utilidade para desenvolvedores e usuários avançados que precisam inspecionar os dados brutos ou transformados que estão armazenados no sistema. É ideal para depuração e verificação da integridade dos dados.
