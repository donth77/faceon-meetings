---
title: "Adicionar o {appName} ao Google Agenda e ao Gmail"
summary: Escolha “{appName} meeting” ao adicionar uma videoconferência no Google Agenda, e coloque uma reunião em um e-mail no Gmail.
category: hosting
order: 4
---

O complemento do {appName} para o Google Workspace coloca o {appName} onde você já planeja suas reuniões: no Google Agenda e no Gmail, no navegador do computador. Você adiciona sua própria cópia à sua Conta do Google pelas Configurações do {appName}.

## Adicione o complemento

1. No {appName}, abra **Configurações → Agenda** e selecione **Adicionar o {appName}** em **{appName} no Google Agenda e no Gmail**.
2. O Google pede que você permita que o {appName} crie e atualize projetos do Apps Script na sua conta. O {appName} usa isso só para colocar o complemento ali e mantê-lo atualizado.
3. Selecione **Abrir no Apps Script** e depois **Implantar → Testar implantações → Instalar**. O Google só instala desta forma um complemento que não está no Marketplace, então esta etapa é sua, uma vez só.
4. Abra o Google Agenda. Na primeira vez que você usar o {appName} lá, o Google vai pedir sua permissão e avisar que ele não foi verificado. Isso acontece porque é a sua própria cópia, e não uma listada no Marketplace do Google: selecione **Avançado**, depois **Acessar {appName}** e depois **Permitir**.

Se o Google disser que a API Apps Script está desativada, abra as [configurações do Apps Script](https://script.google.com/home/usersettings), ative a **Google Apps Script API** e tente de novo. Se sua Conta do Google for de uma escola ou empresa, talvez o administrador não permita o Apps Script.

Sua cópia só funciona com a sua Conta do Google: se você compartilhá-la com alguém, ela não vai funcionar para essa pessoa. Ela pode adicionar a própria cópia.

## No Google Agenda: adicionar videoconferência

1. Crie ou abra um evento.
2. Selecione **Adicionar videoconferência ▾** e escolha **{appName} meeting**.

O evento ganha um link **Participar**, o ID da reunião e o código de acesso, então todos os convidados recebem essas informações, e o Google Agenda envia os convites como sempre.

Depois disso, o {appName} acompanha o evento: mova ou renomeie o evento e a reunião acompanha, e exclua o evento para cancelar a reunião. Um evento que se repete ganha um único ID de reunião para todas as ocorrências, e mover ou remover uma delas faz o mesmo no {appName}. As mudanças chegam ao {appName} em poucos minutos.

A página do {appName} de uma reunião criada assim informa que ela veio do Google Agenda e abre o evento. Mude o horário lá; as configurações do {appName}, como o código de acesso, a sala de espera e as notas de IA, continuam sendo alteradas na página do {appName}. Se você também conectou o Google Agenda em **Configurações → Agenda**, essas reuniões não ganham um segundo evento.

## O painel lateral no Agenda e no Gmail

Selecione o ícone do {appName} à direita do Google Agenda ou do Gmail para:

- **Iniciar uma reunião** com link próprio, para participar agora ou enviar.
- **Participar** de uma reunião pelo ID de 10 dígitos.
- Ver suas **próximas reuniões** da semana, cada uma com **Participar**.
- Mostrar o convite da sua **sala pessoal**, para copiar e enviar.
- Abrir as **Configurações**.

## No Gmail: coloque uma reunião em um e-mail

Enquanto escreve um e-mail, abra o menu de complementos na parte de baixo da janela e escolha **Inserir uma reunião do {appName}**: uma nova reunião, com título se você quiser, ou sua sala pessoal. O convite entra onde está o cursor.

## O que ele pode ver

- **No Google Agenda,** o evento ao qual você adiciona uma reunião do {appName}, enquanto ele está aberto. Para manter as reuniões sincronizadas, ele também olha os eventos que mudam depois nessa agenda, e só informa ao {appName} os que têm reuniões do {appName}.
- **No Gmail,** só o texto que você escolhe inserir, no e-mail que está escrevendo. Ele nunca lê seus e-mails.

As reuniões criadas pelo complemento contam para os seus limites de reunião como qualquer outra ([Limites de reunião](/help/meeting-limits)).

## Atualizações e remoção

O {appName} mantém sua cópia atualizada sozinho. Se o Google deixar de permitir, **Configurações → Agenda** pede que você selecione **Atualizar o complemento** e dê permissão de novo.

Para remover, selecione **Remover** em **Configurações → Agenda**. Depois, para tirá-lo também do Google, abra-o no Apps Script e selecione **Implantar → Testar implantações → Desinstalar**. Você também pode excluir o projeto dos seus [projetos do Apps Script](https://script.google.com/home).

## No celular

Os apps do Google para celular não executam complementos, mas os dados da reunião fazem parte do evento: abra-o no app Google Agenda e selecione o link para participar.
