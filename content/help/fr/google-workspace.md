---
title: "Ajouter {appName} à Google Agenda et Gmail"
summary: Choisissez « {appName} meeting » dans Ajouter une visioconférence de Google Agenda, et insérez une réunion dans un e-mail dans Gmail.
category: hosting
order: 4
---

Le module complémentaire {appName} pour Google Workspace place {appName} là où vous planifiez déjà vos réunions : Google Agenda et Gmail, dans votre navigateur sur ordinateur. Vous ajoutez votre propre copie à votre compte Google, depuis les Paramètres de {appName}.

## L’ajouter

1. Dans {appName}, ouvrez **Paramètres → Agenda** et sélectionnez **Ajouter {appName}** sous **{appName} dans Google Agenda et Gmail**.
2. Google vous demande d’autoriser {appName} à créer et mettre à jour des projets Apps Script dans votre compte. {appName} s’en sert uniquement pour y placer son module complémentaire et le tenir à jour.
3. Sélectionnez **Ouvrir dans Apps Script**, puis **Déployer → Tester les déploiements → Installer**. Google n’installe un module complémentaire absent de son Marketplace que de cette façon : cette étape vous revient donc, une seule fois.
4. Ouvrez Google Agenda. La première fois que vous y utilisez {appName}, Google vous demande de l’autoriser et vous avertit qu’il n’est pas validé. C’est parce qu’il s’agit de votre propre copie, et non d’une version publiée sur le Marketplace de Google : sélectionnez **Paramètres avancés**, puis **Accéder à {appName}**, puis **Autoriser**.

Si Google indique que l’API Apps Script est désactivée, ouvrez les [paramètres d’Apps Script](https://script.google.com/home/usersettings), activez **Google Apps Script API**, puis réessayez. Si votre compte Google appartient à une école ou une entreprise, son administrateur n’autorise peut-être pas Apps Script.

Votre copie ne fonctionne qu’avec votre compte Google : si vous la partagez, elle ne fonctionnera pas pour l’autre personne. Elle peut ajouter sa propre copie.

## Dans Google Agenda : ajouter une visioconférence

1. Créez ou ouvrez un événement.
2. Sélectionnez **Ajouter une visioconférence ▾** et choisissez **{appName} meeting**.

L’événement reçoit un lien **Rejoindre**, l’ID de réunion et le code secret : toutes les personnes invitées les ont donc, et Google Agenda envoie les invitations comme d’habitude.

Ensuite, {appName} suit l’événement : déplacez-le ou renommez-le et la réunion suit, supprimez-le pour annuler la réunion. Un événement périodique reçoit un seul ID de réunion pour toutes ses occurrences, et déplacer ou supprimer l’une d’elles fait de même dans {appName}. Les changements arrivent dans {appName} en quelques minutes.

La page {appName} d’une réunion créée de cette façon indique qu’elle vient de Google Agenda et ouvre l’événement. Modifiez son heure là-bas ; ses paramètres {appName}, comme le code secret, la salle d’attente et les notes IA, se modifient toujours sur la page de {appName}. Si vous avez aussi connecté Google Agenda dans **Paramètres → Agenda**, ces réunions ne reçoivent pas de second événement.

## Le panneau latéral dans Agenda et Gmail

Sélectionnez l’icône {appName} à droite de Google Agenda ou de Gmail pour :

- **Démarrer une réunion** avec son propre lien, à rejoindre maintenant ou à envoyer.
- **Rejoindre** une réunion avec son ID à 10 chiffres.
- Voir vos **prochaines réunions** de la semaine, chacune avec **Rejoindre**.
- Afficher l’invitation de votre **salle personnelle**, pour la copier et l’envoyer.
- Ouvrir les **Paramètres**.

## Dans Gmail : insérer une réunion dans un e-mail

Pendant que vous rédigez un e-mail, ouvrez le menu des modules complémentaires en bas de la fenêtre et choisissez **Insérer une réunion {appName}** : une nouvelle réunion, avec un titre si vous le souhaitez, ou votre salle personnelle. L’invitation s’insère à l’emplacement du curseur.

## Ce qu’il peut voir

- **Dans Google Agenda,** l’événement auquel vous ajoutez une réunion {appName}, pendant qu’il est ouvert. Pour garder les réunions synchronisées, il examine aussi les événements qui changent ensuite dans cet agenda, et ne signale à {appName} que ceux qui ont des réunions {appName}.
- **Dans Gmail,** uniquement le texte que vous choisissez d’insérer, dans l’e-mail que vous rédigez. Il ne lit jamais vos e-mails.

Les réunions créées avec le module complémentaire comptent dans vos limites de réunion comme les autres ([Limites des réunions](/help/meeting-limits)).

## Mises à jour et suppression

{appName} tient votre copie à jour tout seul. Si Google ne le permet plus, **Paramètres → Agenda** vous demande de sélectionner **Mettre à jour le module complémentaire** et de l’autoriser à nouveau.

Pour le supprimer, sélectionnez **Retirer** dans **Paramètres → Agenda**. Ensuite, pour le retirer aussi de Google, ouvrez-le dans Apps Script et sélectionnez **Déployer → Tester les déploiements → Désinstaller**. Vous pouvez aussi supprimer le projet de vos [projets Apps Script](https://script.google.com/home).

## Sur un téléphone

Les applications mobiles de Google n’exécutent pas les modules complémentaires, mais les informations pour rejoindre la réunion font partie de l’événement : ouvrez-le dans l’application Google Agenda et sélectionnez le lien pour rejoindre la réunion.
