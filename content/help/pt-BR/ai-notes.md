---
title: Notas de IA
summary: Um resumo, itens de ação e decisões a partir do que é dito, feitos no seu navegador.
category: hosting
order: 5
---

As notas de IA transformam o que é dito em uma reunião em um resumo curto, uma lista de itens de ação (com quem vai fazer cada um e até quando, quando isso fica claro) e as decisões tomadas. Elas ficam desativadas, a menos que o anfitrião da reunião permita e um anfitrião as inicie, todos podem ver quando estão ativadas, e nada é salvo a menos que quem faz as notas decida salvar.

## Permita as notas nas suas reuniões

As notas de IA começam desativadas em todas as contas. Para usá-las nas reuniões que você organiza, vá em **Configurações**, depois em **Notas de IA**, e ative **Notas de IA nas reuniões que você organiza**. Em uma reunião que você organiza, **Mais** e depois **Notas de IA** tem um botão que leva você até lá.

Essa escolha fica guardada na sua conta, então vale também para seus coanfitriões: enquanto estiver desativada, ninguém pode iniciar notas de IA nas suas reuniões. Desativar também para as notas que estiverem ativas em uma reunião que você está organizando agora.

## Ative as notas

Anfitriões e coanfitriões selecionam **Mais**, depois **Notas de IA** e depois **Iniciar notas de IA**. Toda reunião começa com elas desativadas. As notas de IA não estão disponíveis em reuniões de demonstração, nem em reuniões cujo anfitrião não as permitiu.

Quem inicia as notas é quem faz as notas: a transcrição se acumula no navegador dessa pessoa, e as notas são feitas ali. Selecione **Parar notas de IA** para encerrá-las para todos. Elas também param quando quem faz as notas sai.

## Inicie as notas automaticamente

Quando suas reuniões permitem notas de IA, uma reunião pode iniciá-las sozinha: ative **Iniciar notas de IA automaticamente** ao agendar, na página da reunião, na página **Sala pessoal** ou na própria reunião (**Participantes** e depois **⋯**). A partir daí, as notas de IA começam assim que você ou um coanfitrião entra, com a mesma mensagem para todos, e quem está prestes a entrar é avisado antes.

Elas começam no navegador de quem entra, desde que ele consiga fazer notas (veja Como as notas são feitas, abaixo). Se não conseguir, elas não começam, e o {appName} explica o motivo, com um atalho para as **Configurações**. Depois que alguém seleciona **Parar notas de IA**, elas ficam desativadas pelo resto da reunião, mesmo se alguém entrar de novo.

## O que todos veem

- **Notas de IA ativadas** no alto da reunião, e uma mensagem dizendo quem as ativou.
- Quem está prestes a entrar vê o mesmo aviso antes de entrar, ou, em uma reunião que inicia as notas de IA automaticamente, que elas vão começar.
- Para ficar fora das notas, selecione **Notas de IA ativadas** e ative **Não me transcrever**. A partir daí, o que você diz não é transcrito, e quem faz as notas vê que você escolheu isso.

## Como a fala vira texto

O navegador de cada pessoa transforma o que _ela_ diz em texto, no próprio dispositivo, e envia só o texto para quem faz as notas. O áudio nunca sai do dispositivo de ninguém para isso, e nada é transcrito enquanto seu áudio está desativado.

Isso funciona no Chrome no computador. Na primeira vez, o Chrome precisa de um download único para transformar o seu idioma em texto: algumas centenas de MB, que ele guarda. Você pode fazer isso antes de uma reunião, em **Configurações**, depois **Notas de IA** (**Transcrição neste dispositivo**), ou antes de entrar em uma reunião com notas de IA ativadas. Na reunião, selecione **Notas de IA ativadas** e depois **Baixar agora**. Até o download terminar, o que você diz não entra nas notas, e quem faz as notas vê que você está esperando.

Quando um navegador não consegue transcrever no dispositivo (Safari, Firefox e alguns celulares), as palavras dessa pessoa não entram nas notas, e quem faz as notas vê quem está faltando.

A transcrição agrupa as palavras de cada pessoa sob o nome dela e o horário, e começa um novo parágrafo quando ela faz uma pausa de meio minuto, e mais ou menos a cada minuto de fala.

## Como as notas são feitas

Quando quem faz as notas para as notas de IA, ou sai, as notas são feitas a partir da transcrição. Se as notas de IA recomeçarem depois, elas são feitas de novo com tudo. Se, em vez disso, o anfitrião da reunião desativar as notas de IA, elas só são feitas quando você seleciona **Fazer notas**. Em **Configurações**, em **Notas de IA**, uma frase diz qual vale no seu navegador:

- **Sem chave**, no Chrome em um computador: a IA integrada do Chrome faz as notas no próprio computador de quem faz as notas. É gratuito, e nada sai do computador. Na primeira vez, o Chrome baixa a IA dele, alguns gigabytes que podem demorar, e só quando você seleciona **Baixar e fazer notas**. Precisa de uma versão recente do Chrome em um computador com memória e espaço em disco suficientes, e escreve as notas nos idiomas que a IA do Chrome conhece: por enquanto, inglês, espanhol, japonês, alemão e francês. Em outros idiomas, como o português, as notas saem em inglês, e as configurações e o painel de Notas de IA avisam isso; para ter notas no seu idioma, use sua própria chave de IA.
- **Com uma chave de IA**, que é opcional: seu provedor de IA (OpenAI, Anthropic, Google, DeepSeek ou OpenRouter) faz as notas, com uma chave da sua conta nele. Seu navegador envia a transcrição direto para o provedor, e é ele que cobra você. O {appName} testa a chave quando você a digita e quando as notas de IA começam, então uma chave que seu provedor não aceita aparece antes de as notas serem feitas. Se o seu provedor não conseguir fazer as notas, no Chrome você pode fazê-las neste computador. Para voltar às notas grátis, remova a chave.

Em um navegador sem a IA integrada do Chrome e sem chave, **Iniciar notas de IA** aparece esmaecido, com um link para adicionar uma chave. Permitir notas de IA nas suas reuniões faz parte da sua conta, então vale em todos os navegadores; uma chave fica no navegador em que você a adiciona. Todos na reunião ficam sabendo quem faz as notas: o computador de quem está fazendo as notas ou o provedor da chave dessa pessoa.

> **Sua chave fica no seu navegador.** O {appName} nunca a recebe nem a guarda. Os planos gratuitos de alguns provedores podem usar o que você envia para melhorar os produtos deles, então confira os termos do seu provedor antes de usar uma chave gratuita em reuniões privadas.

## Depois da reunião

As notas aparecem no painel **Notas de IA**, e também depois que você sai da reunião. Selecione **Copiar** para copiá-las, ou **Baixar .md** para salvá-las, com a transcrição, como um arquivo Markdown. **Fazer de novo** refaz as notas, por exemplo de outro jeito.

Até você salvar, a transcrição e as notas ficam só naquela guia do navegador: fechar a guia apaga tudo. Selecione **Excluir notas e transcrição** para removê-las antes.

## Salve e compartilhe as notas

Se você fez login, pode guardar as notas com a reunião:

- **Salvar na reunião**: só você e o anfitrião da reunião podem vê-las.
- **Compartilhar com os participantes**: todos que estiveram na reunião com uma conta também podem vê-las.

Um anfitrião pode configurar uma reunião para **Compartilhar notas de IA com os participantes automaticamente**: no formulário de agendamento, na página da reunião, na página da sala pessoal ou na própria reunião, em **Participantes** › **⋯**. Assim, as notas são salvas e compartilhadas assim que ficam prontas, sem ninguém selecionar **Salvar**, e todos são avisados quando as notas de IA são ativadas, antes de falar. Quem salvou as notas, ou o anfitrião, ainda pode selecionar **Parar de compartilhar** ou excluí-las. As notas feitas por um coanfitrião sem conta não podem ser salvas, e elas avisam isso; copie ou baixe as notas para compartilhá-las.

As notas salvas ficam em **Anteriores**: selecione **Ver detalhes** na reunião e depois **Ver notas de IA**. Ali, use **Parar de compartilhar** ou **Excluir notas** se você as salvou ou organiza a reunião. A transcrição é salva com elas quando cabe (até uns 200 KB no total). As notas salvas são excluídas depois de 90 dias, ou junto com a reunião.
