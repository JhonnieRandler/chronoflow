# 📊 **ChronoFlow: Acompanhamento de Cronogramas P6**

Este documento detalha a finalidade, a arquitetura, o fluxo de uso e os algoritmos implementados no sistema de análise e visualização de projetos do Primavera P6, ChronoFlow.

## 🌟 1. Finalidade do Projeto

O objetivo do ChronoFlow é transformar dados brutos de arquivos `.xer` em dashboards interativos e intuitivos, simplificando a análise de cronogramas e recursos. A ferramenta permite não apenas visualizar os dados do P6, mas também sobrepô-los com valores personalizados (ex: medições topográficas), gerenciar proativamente as restrições do projeto e registrar evidências visuais através de fotos. O sistema foi projetado para facilitar uma gestão de projeto ágil, visual e informada, eliminando a necessidade de planilhas complexas e análises manuais.

## 💾 2. Arquitetura e Fluxo de Dados

O sistema é uma aplicação web moderna que roda inteiramente no navegador, utilizando **Firebase Cloud Firestore** para persistência de dados de configuração e **Firebase Storage** para armazenamento de arquivos de mídia. A arquitetura foi projetada para máxima eficiência e escalabilidade.

### Estrutura de Dados Otimizada no Firestore

Para evitar redundância e garantir performance, os dados são organizados em cinco coleções principais:

1.  **`p6-app-data` (Configurações Globais):** Armazena todas as configurações da aplicação que são independentes do projeto, como mapeamento de semanas, recurso principal, agrupamentos e a lista centralizada de restrições.
2.  **`project_base` (Dados Estáticos do Projeto):** Contém os dados fundamentais do projeto que raramente mudam. Esta coleção terá **apenas um documento**, representando o esqueleto do cronograma (`TASK`, `RSRC`, `WBS_HIERARCHY`, etc.).
3.  **`project_versions` (Avanço Semanal):** Cada documento nesta coleção é um "snapshot" do projeto, correspondente a um arquivo `.xer` carregado. Contém apenas os dados que mudam a cada semana (`TASKRSRC`, `TASKPRED`).
4.  **`activity_media` (Metadados de Mídia):** Armazena os metadados das fotos enviadas, como a URL de download e o caminho no Firebase Storage, vinculando cada foto a uma atividade ou grupo específico.
5.  **`activity_details` (Plano de Execução):** Contém as etapas construtivas detalhadas de uma atividade ou grupo, permitindo um planejamento de curto prazo (Pull Planning).

> **Vantagem Principal:** Em vez de salvar o cronograma inteiro (megabytes) toda semana, salvamos apenas alguns kilobytes de dados de avanço. Isso torna o sistema mais rápido, mais barato e imensamente mais escalável.

### Fluxo de Trabalho Recomendado

1.  **📤 Upload e Processamento (`index.html`):** O usuário envia um arquivo `.xer` atualizado.
    - **Primeiro Upload:** O sistema salva as tabelas estáticas (`TASK`, `RSRC`) na coleção `project_base`.
    - **Uploads Subsequentes:** O sistema salva apenas as tabelas de avanço (`TASKRSRC`, `TASKPRED`) como uma nova versão em `project_versions`.
2.  **⚙️ Configuração (`configuracao.html`):** O usuário parametriza como os dados serão analisados.
3.  **📋 Gestão de Atividades (`proximas_semanas.html`):** O usuário pode **adicionar um plano de execução detalhado** a uma atividade ou grupo. Essas etapas são salvas na coleção `activity_details`. Adicionalmente, ele pode adicionar uma foto à atividade, que é enviada para o **Firebase Storage**, e sua URL é salva no **Firestore** (`activity_media`).
4.  **📈 Análise e Visualização:** As páginas de análise carregam os dados base e as versões relevantes, combinando-os em tempo real com as configurações, restrições, fotos e planos de execução para apresentar uma visão completa.
5.  **📦 Backup (`configuracao.html`):** O usuário exporta todos os dados (configurações, base, versões, metadados de mídia e planos de execução) para um arquivo `.json`.

## 📄 3. Detalhamento das Páginas e Funcionalidades

### `index.html` (Painel Principal)

A porta de entrada do sistema. Sua função mais importante é processar os dados brutos de forma inteligente.

- **Interface de Upload:** Permite o envio de arquivos `.xer` via seletor ou drag-and-drop.
- **Lógica Principal (`transformData()`):** Transforma dados crus em informação estruturada, criando uma hierarquia WBS estável e enriquecendo os dados.

### `configuracao.html` (Painel de Configurações)

Centraliza todas as parametrizações da aplicação.

- **Mapeamento de Atividades:** Permite criar **grupos lógicos de atividades**.
  - **Herança e Consolidação de Grupos:** Ao salvar um grupo, o sistema **automaticamente agrega os dados** das atividades-membro. Valores (como de topografia) são somados, restrições são unificadas e a primeira foto encontrada é herdada. Os dados originais são removidos das atividades individuais para evitar duplicidade.
  - **Interface Simplificada:** Uma vez que uma atividade faz parte de um grupo, ela **desaparece de todas as caixas de seleção da aplicação**. O gerenciamento é feito diretamente no grupo, tornando a interface mais limpa e focada.
  - **IDs Estáveis:** Cada grupo recebe um **ID único e imutável (UUID)**. Isso garante que, ao **renomear um grupo**, todos os seus vínculos com restrições, fotos e valores personalizados permaneçam intactos.
  - **Migração Automática:** Um script de migração único e automático atualiza os dados antigos (que usavam o nome como ID) para o novo formato de ID estável, garantindo a integridade dos dados existentes.
- **Gerenciar Detalhamento:** Um ponto centralizado para gerenciar os Planos de Execução (Pull Planning). Permite **criar novos planos** para atividades/grupos, **editar planos existentes** adicionando ou removendo etapas, e **excluir planos** que não são mais necessários, tudo a partir de uma única interface.
- **Gerenciar Marcos (Milestones):** Cria uma área de trabalho dedicada para a criação de marcos do projeto, cada um com um nome e uma data-limite. Permite vincular esses marcos a atividades específicas ou a ramos inteiros da WBS através de uma interface de árvore hierárquica, facilitando o controle de prazos-chave.
- **Valores Personalizados:** Permite ao usuário inserir valores "Previsto" e "Realizado" (ex: de topografia) que se sobrepõem aos do cronograma.
- **Importar & Exportar:** Utiliza o módulo `storage.js` para criar um backup (`.json`) com a estrutura completa de todas as coleções, **incluindo os metadados das fotos e planos de execução**, garantindo a segurança e portabilidade.

### `proximas_semanas.html` (6-Week Look Ahead)

Ferramenta interativa de planejamento proativo, ideal para reuniões de 6WLA.

- **Plano de Execução (Pull Planning):** Permite detalhar uma atividade macro em etapas construtivas menores.
  - **Visualização Inteligente:** Se uma atividade possui um plano, o 6WLA exibe **quais etapas específicas estão programadas para ocorrer naquela semana**, em vez da informação genérica de "Andamento".
  - **Gerenciamento no Modal:** Um novo painel no modal permite adicionar, editar e remover etapas, cada uma com sua própria descrição e datas.
- **Gerenciamento de Atividades no Modal:** Clicar em qualquer atividade abre um modal redesenhado e mais amplo.
  - **Foto em Destaque:** O modal exibe uma **foto da atividade** em destaque no topo, permitindo análise visual imediata.
  - **Upload de Múltiplas Formas:** O usuário pode adicionar ou atualizar a foto de três maneiras ágeis:
    1.  Clicando para **selecionar o arquivo**.
    2.  **Arrastando e soltando** a imagem na área da foto.
    3.  **Colando** uma imagem da área de transferência (`Ctrl+V`).
  - **Visualizador em Tela Cheia:** Clicar na foto a abre em um visualizador de tela cheia para análise detalhada.
- **Indicadores Visuais:**
  - **🚩 Restrições Pendentes:** Atividades com impedimentos são marcadas com uma bandeira.
  - **📸 Foto Anexada:** Atividades com fotos são marcadas com um ícone de câmera.
  - **📋 Plano Detalhado:** Atividades com um Plano de Execução são marcadas com um ícone de prancheta.
  - **🏁 Alerta de Marco em Risco:** Exibe um ícone de bandeira de corrida pulsante em atividades cuja data de término prevista (`reend_date`) ultrapassa a data-limite de um marco vinculado, alertando a equipe sobre possíveis atrasos em entregas importantes.

### `analise_atividade.html` (Análise Detalhada)

Oferece uma visão profunda e comparativa de uma atividade ou grupo, incluindo um card especial para valores topográficos e um gráfico de evolução de recursos.

### `analise_restricoes.html` (Análise de Restrições) - **NOVO**

Uma página de BI dedicada a transformar dados de restrições em inteligência acionável.

- **KPIs (Indicadores-Chave):** Exibe o total de restrições pendentes e resolvidas, oferecendo um panorama instantâneo da saúde do projeto.
- **Gráfico de Pareto (Análise 80/20):** Mostra quais categorias de causa raiz (os 6M) são responsáveis pela maioria das restrições pendentes. Isso ajuda a gestão a focar nos problemas que causam maior impacto.
- **Análise de Tendência:** Apresenta um gráfico da evolução das restrições (pendentes vs. resolvidas) ao longo das semanas, permitindo avaliar a eficácia da equipe na resolução de problemas.
- **Lista Detalhada:** Fornece uma tabela de todas as restrições pendentes, ordenadas por prazo, para facilitar a priorização e ação.

## ✨ 4. Comunicação e Apresentação

Para facilitar a comunicação e o uso da ferramenta em reuniões de equipe, foram adicionadas funcionalidades que transformam o ChronoFlow em uma plataforma de apresentação.

### Modo Apresentação

Um novo item "Modo Apresentação" foi adicionado ao menu de navegação. Ao ativá-lo, todos os elementos da interface (como o menu lateral) são ocultados, e o conteúdo principal é expandido para preencher toda a tela. Isso cria uma visão limpa e focada, ideal para projetar durante reuniões de planejamento, garantindo que a atenção de todos esteja nos dados. O modo pode ser facilmente desativado pressionando a tecla `Escape` ou clicando no botão flutuante que aparece no canto da tela.

## 🖼️ 5. Gerenciamento de Fotos de Atividades

- **Armazenamento Seguro:** As imagens são salvas no **Firebase Storage**, uma solução robusta e escalável do Google.
- **Vínculo com Dados:** As informações das fotos (URL, caminho de armazenamento) são salvas no **Firestore**, garantindo o vínculo com a atividade ou grupo correto.
- **Interface Intuitiva:** O upload é facilitado com suporte a **arrastar e soltar (drag-and-drop)** e a capacidade de **colar imagens da área de transferência**.
- **Visualização Aprimorada:** As fotos são exibidas em destaque nos detalhes da atividade e podem ser abertas em um **visualizador de tela cheia**.

## 🛠️ 6. Arquitetura Robusta com IDs Estáveis

- **O Problema Resolvido:** Anteriormente, a identidade de um grupo de atividades estava atrelada ao seu nome. Renomear um grupo quebrava todos os vínculos de dados (restrições, valores, fotos).
- **A Solução:** Cada grupo agora possui um **ID único e imutável (UUID)**, que é usado para todas as referências internas. Isso permite que os nomes dos grupos sejam alterados livremente sem risco de perda de dados. Uma **migração automática** garante a atualização dos dados existentes sem intervenção manual.

## 🚀 7. Experiência do Usuário (UX) Aprimorada

- **Design Refinado e Consistente:** Com base no feedback contínuo, a interface foi aprimorada para ser mais limpa e intuitiva. Modais foram padronizados para uma apresentação consistente em todas as telas, e elementos como botões de filtro foram redesenhados para uma aparência mais moderna e funcional, incluindo estados visuais claros para itens selecionados.
- **Sem "Flash" de Conteúdo (FOUC):** Foi implementado um script de bloqueio de renderização no `<head>` de todas as páginas. Ele aplica o tema (claro ou escuro) salvo no `localStorage` instantaneamente, antes da página ser desenhada, eliminando o piscar da interface.
- **Feedback Visual Imediato:** Ações assíncronas, como salvar ou importar dados, desabilitam os botões e exibem um estado de "Salvando...".
- **Notificações "Toast":** Mensagens de sucesso ou erro aparecem como notificações discretas que desaparecem sozinhas.
- **"Skeleton Loaders":** Animações de "esqueleto" substituem as mensagens de "Carregando...", melhorando a percepção de velocidade.

## 🎨 8. Design System e Estilização

### 8.1. Tema Claro e Escuro (Light/Dark Mode)

- **Funcionalidade:** Um tema escuro completo foi implementado para melhorar o conforto visual. A escolha do tema é salva no `localStorage`.
- **Implementação:** A tematização é controlada por variáveis CSS. A classe `.dark` no `<html>` ativa um conjunto diferente de valores para essas variáveis, alterando a aparência de toda a aplicação. Para evitar o "flash" de conteúdo sem estilo (FOUC), um script no `<head>` aplica a classe `.dark` antes da renderização da página.

### 8.2. Arquitetura de CSS Semântico

- **O Problema:** O Tailwind CSS, por ser injetado no cliente, sobrescrevia as customizações para o modo escuro.
- **A Solução:** Foram criadas **classes semânticas** (ex: `.text-primary`, `.bg-secondary`) que utilizam as variáveis de cor do tema. Essas classes substituem as classes de cor do Tailwind nos arquivos HTML e templates JavaScript, garantindo que o sistema de temas funcione de forma robusta e previsível.

## ♿️ 9. Acessibilidade (A11y)

Um grande esforço foi dedicado para tornar o ChronoFlow uma ferramenta acessível.

- **Navegação Completa por Teclado:** Toda a aplicação é 100% operável utilizando apenas o teclado.
- **Gerenciamento de Foco Inteligente:**
  - **"Focus Trap" em Modais:** Quando um modal é aberto, o foco do teclado fica "preso" dentro dele. Ao fechar, o foco retorna para o elemento que o abriu.
  - **Indicador de Foco Visível:** Um anel de foco claro e consistente (`outline`) aparece em todos os elementos interativos.
- **Suporte a Leitores de Tela (ARIA):** Atributos ARIA (`aria-label`, `role`, etc.) são usados para dar contexto e significado à interface. "Live regions" (`aria-live`) anunciam vocalmente as notificações e mudanças de estado.

## 🔒 10. Segurança

É crucial entender como a segurança funciona em uma aplicação que roda inteiramente no navegador do cliente (client-side).

### 10.1. As Chaves em `firebase-config.js` são Públicas por Design

As chaves no arquivo `firebase-config.js` **não são segredos**. Elas são identificadores públicos que o Google utiliza para direcionar as requisições para o projeto Firebase correto. Qualquer pessoa que visitar o seu site poderá ver essas chaves.

### 10.2. A Segurança Real está nas **Firebase Security Rules**

A verdadeira proteção dos seus dados é feita através das **Regras de Segurança do Firebase**, configuradas no painel do seu projeto. Elas definem quem pode ler e escrever no seu banco de dados e no seu armazenamento de arquivos.

**Exemplo:** Para permitir acesso apenas a usuários autenticados:

```json
// No painel do Firebase -> Firestore Database -> Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> **Recomendação Forte:** Sempre configure suas Regras de Segurança para serem o mais restritivas possível, garantindo a proteção e a integridade dos seus dados.

## 🧠 11. Lógicas e Algoritmos Principais

Esta seção detalha as implementações-chave que sustentam as funcionalidades do sistema.

### 11.1. Camada de Abstração de Dados (`storage.js`)

- **Objetivo:** Centralizar e abstrair toda a interação com o **Firebase Cloud Firestore**. Isso desacopla a lógica da aplicação da implementação do banco de dados, tornando o código mais limpo e fácil de manter. Se a tecnologia de banco de dados mudar no futuro, apenas `storage.js` precisará ser reescrito.

### 11.2. Processamento de Arquivos XER (`xer-parser.js`)

- **Objetivo:** Isolar a lógica complexa de análise e transformação de arquivos `.xer` em um módulo dedicado.
- **Implementação:** O arquivo `xer-parser.js` exporta uma função principal que recebe o conteúdo de um arquivo `.xer` e executa duas etapas:
  1.  **`parseXER()`:** Lê o texto bruto e o converte em um objeto JavaScript estruturado, com tabelas, cabeçalhos e linhas.
  2.  **`transformData()`:** Pega os dados brutos analisados e os enriquece, criando IDs de WBS estáveis, resolvendo chaves estrangeiras (como IDs de recursos e predecessoras) e adicionando campos calculados necessários para a aplicação.
- **Benefício:** Esta separação limpa o arquivo `index.js`, que agora apenas orquestra o upload e chama este módulo, seguindo o princípio da responsabilidade única.

### 11.3. Migração para IDs de Grupo Estáveis (UUIDs)

- **Objetivo:** Garantir a integridade dos dados ao renomear grupos.
- **Problema:** Usar o nome de um grupo como seu ID é frágil. Se o nome muda, todos os dados vinculados (restrições, fotos, valores) se perdem.
- **Solução:**
  1.  **Geração de UUID:** Ao criar um grupo, a função `utils.uuidv4()` gera um ID único e imutável.
  2.  **Vinculação por ID:** Todas as outras partes do sistema usam este UUID para se referir ao grupo.
  3.  **Script de Migração:** Em `configuracao.js`, a função `migrateToGroupIds()` verifica se existem grupos no formato antigo. Se sim, ela gera UUIDs para eles, atualiza todos os dados vinculados nas coleções `restrictionLinks`, `customActivityValues` e `activity_media`, e recarrega a página. Essa verificação é rápida e a migração completa só ocorre uma vez.

### 11.4. Gerenciamento de Mídia com Firebase Storage

- **Objetivo:** Permitir o upload, armazenamento e exclusão seguros de fotos de atividades.
- **Implementação (`proximas_semanas.js`):**
  1.  **Upload:** A função `uploadPhoto` recebe um arquivo. Ela primeiro exclui a foto antiga (se existir) do Firebase Storage. Em seguida, ela faz o upload do novo arquivo para um caminho único (ex: `activity_photos/ITEM_ID_TIMESTAMP.jpg`).
  2.  **Obtenção da URL:** Após o upload, `getDownloadURL` retorna uma URL pública e permanente para a imagem.
  3.  **Salvamento no Firestore:** Esta URL e o caminho do arquivo são salvos na coleção `activity_media` usando `storage.saveActivityMedia`, vinculando a foto ao `itemId`.
  4.  **Exclusão:** `handleRemovePhoto` exclui o arquivo do Firebase Storage e o documento de metadados do Firestore.

### 11.5. Plano de Execução (Pull Planning)

- **Objetivo:** Permitir o detalhamento de uma atividade macro do cronograma em um plano de trabalho de curto prazo, conectando o planejamento de alto nível com a execução no campo.
- **Implementação:**
  1.  **Nova Coleção (`activity_details`):** Uma coleção no Firestore armazena as etapas construtivas, cada uma com seu nome, datas e um `parentId` que a vincula à atividade ou grupo principal.
  2.  **Gerenciamento Centralizado (`configuracao.js`):** Um novo painel de configuração permite criar, editar e excluir os Planos de Execução de forma centralizada.
  3.  **Visualização Inteligente no 6WLA:** A lógica de renderização foi aprimorada para verificar se um item possui um plano de execução. Se sim, ele exibe as etapas específicas agendadas para a semana atual, em vez de uma informação genérica, oferecendo uma visão clara e acionável.

### 11.6. Geração da Visão Hierárquica no Dashboard Semanal

- **Função Principal:** Lógica de agrupamento dentro de `processAndCacheWeekData()` em `proximas_semanas.js`.
- **Objetivo:** Montar a estrutura de árvore aninhada das atividades com base nos níveis de WBS que o usuário selecionou, tratando de forma inteligente as hierarquias que não se alinham perfeitamente com a seleção.
- **Lógica Robusta:**
  - O algoritmo itera sobre os níveis de agrupamento selecionados pelo usuário (ex: Nível 2, depois Nível 5).
  - Se uma atividade não possui um WBS para um nível específico (ex: não tem Nível 5), o algoritmo para de seguir a seleção do usuário e, em vez disso, encontra o **WBS pai mais profundo que a atividade realmente possui** (ex: Nível 3).
  - Isso garante que cada atividade seja sempre colocada sob seu pai correto, eliminando tanto a duplicação de nós WBS (`Pai > Pai > Filho`) quanto atividades que ficavam sem um pai visível.
- **Otimização:** Os dados de cada semana são processados e cacheados sob demanda ("lazy loading"), apenas na primeira vez que o usuário navega para ela.

### 11.7. Gerenciamento de Marcos (Milestones)

- **Objetivo:** Implementar um sistema para monitorar datas-chave e alertar sobre possíveis desvios, de forma integrada ao cronograma.
- **Implementação:**
  1.  **Estrutura de Dados:** Foram adicionadas duas novas configurações no Firestore, gerenciadas pelo `storage.js`: `milestonesList` e `milestoneLinks`.
      - `milestonesList`: Armazena a definição de cada marco (ID único, nome, data-limite).
      - `milestoneLinks`: Armazena a relação muitos-para-muitos entre os IDs dos marcos e os IDs dos itens do projeto (atividades ou grupos).
  2.  **Área de Trabalho (`configuracao.js`):** Uma interface unificada permite a criação/edição de múltiplos marcos e seus vínculos em uma única tela. Os vínculos são gerenciados através de uma árvore WBS interativa com checkboxes, que persistem as alterações no `milestoneLinks`.
  3.  **Lógica de Conflito (`proximas_semanas.js`):** Ao renderizar o painel de 6 semanas, para cada atividade, o sistema:
      - Verifica se a própria atividade ou algum de seus pais na hierarquia WBS possui um marco vinculado.
      - Se um marco é encontrado, compara a data de término prevista da atividade (`reend_date`) com a data do marco.
      - Se a data da atividade for posterior à do marco, um alerta visual de conflito é exibido.

## 🚀 12. Melhorias Futuras

- **🤖 Análise Inteligente com IA:** Integrar a API do Google Gemini para oferecer análises proativas, como sugerir planos de ação para mitigar restrições.
- **🔗 Integração com APIs:** Conectar-se diretamente a sistemas de planejamento para automatizar o upload de dados.
- **🔧 Dashboards Personalizáveis:** Permitir que os usuários criem seus próprios dashboards.
- **📈 Análise de PPC (Percentual do Plano Concluído):** Implementar métricas LEAN para medir a confiabilidade do planejamento semanal.
- **⚡ Visualização do Caminho Crítico:** Destacar atividades críticas e quase-críticas para focar a atenção da equipe.
