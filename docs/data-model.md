# Modèle de données — App mariage (réorganisation Firestore)

> Document de référence pour la refonte du schéma Firestore.
> Objectif : passer d'une base « invités » plate à un modèle relationnel léger
> supportant l'identité stable, les liens de foyer et la co-gestion.

## 1. Contexte

App mobile pour invités de mariage (auth par SMS). Chaque invité peut consulter
son hébergement (bâtiment / chambre / co-occupants) et saisir ses préférences de
repas et sa présence aux différentes étapes de l'événement.

### État actuel (à migrer)

- Une collection d'invités où chaque doc = `{ phone, nom (texte libre) }`.
- Problèmes : le téléphone sert de clé (les enfants n'en ont pas), les prénoms
  seuls sont ambigus (17 homonymes), et il n'existe aucun lien entre personnes
  (couple, parent-enfant).

### État cible

Trois collections : `persons`, `households`, `rooms`.

## 2. Invariants (règles à ne jamais violer)

1. **Le téléphone est la clé d'authentification, pas la clé primaire.**
   Identité stable = `personId` (généré, immuable). Un numéro de téléphone est
   **unique** (un numéro = une personne = un login) et **obligatoire** pour toute
   personne qui se connecte.
2. **Les enfants n'ont pas de téléphone** (`phone = null`, `kind = "child"`).
   Ils ne se connectent jamais ; ils sont gérés via le foyer.
3. **`householdId` est l'unité de co-gestion.** Tous les adultes d'un même foyer
   qui possèdent un téléphone sont co-gestionnaires **symétriques** : chacun peut
   lire et écrire les infos de tous les membres du foyer (lui-même, son conjoint,
   leurs enfants). Aucun privilège hiérarchique entre conjoints.
4. **`household` ≠ chambre.** Des colocataires non-couple partageant une chambre
   sont des foyers distincts avec le même `roomId`. Un couple = un seul foyer.
5. **Préférences de repas et présence sont des attributs individuels** portés par
   le document `person`, jamais par le foyer.
6. **`roomId` est le pont** vers le plan de masse : ne pas le régénérer à la
   légère, c'est une clé stable partagée avec le rendu du plan.

## 3. Schémas

### persons/{personId}

| champ | type | notes |
|---|---|---|
| personId | string (PK) | clé stable, = id du document |
| prenom | string | |
| nom | string | obligatoire (désambiguïse les homonymes) |
| kind | "adult" \| "child" | |
| phone | string \| null | format international, unique ; null si child |
| householdId | string (FK) | → households |
| isPrimaryContact | bool | contact référent RSVP du foyer (n'affecte PAS les droits) |
| partnerId | string \| null (FK) | → persons, réciproque |
| roomId | string (FK) | → rooms |
| mealPreferences | map | `{ regime, allergies: [], notes }` — saisi via l'app |
| attendance | map | `{ <eventId>: "yes"\|"no"\|"maybe" }` — saisi via l'app |

### households/{householdId}

| champ | type | notes |
|---|---|---|
| householdId | string (PK) | = id du document |
| displayName | string | ex. « Louis & Lucy » |
| primaryContactId | string (FK) | → persons |
| managerPhones | string[] | **dérivé** : téléphones des adultes du foyer (droits de co-gestion) |

### rooms/{roomId}

| champ | type | notes |
|---|---|---|
| roomId | string (PK) | slug `batiment-niveau-chambre` |
| batiment | string | Escoubet / Escoubas / Yourtes |
| niveau | string | Rez de chaussée / Étage / Extérieur |
| chambre | string | nom de la chambre |
| type | "chambre" \| "dortoir" | |
| capacite | int | |

## 4. Source de données

Le classeur `mariage_hebergement.xlsx` est la source de vérité éditée à la main.
Un onglet par collection : `personnes` → persons, `foyers` → households,
`chambres` → rooms. À exporter en CSV/JSON par onglet pour l'import
(voir `seed-example.json` pour la structure attendue).

`managerPhones` n'est PAS saisi à la main : il se calcule à l'import, pour chaque
foyer, comme la liste des `phone` non nuls des personnes `kind == "adult"` de ce foyer.

## 5. Sécurité (Firestore Security Rules — cible)

Un utilisateur peut écrire une `person` seulement si le téléphone de son token
d'auth figure dans les `managerPhones` du foyer de cette personne :

```
match /persons/{personId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
    && request.auth.token.phone_number in
       get(/databases/$(database)/documents/households/$(resource.data.householdId)).data.managerPhones;
}
```

C'est ce qui implémente la co-gestion symétrique : deux conjoints, deux numéros,
même foyer → les deux passent la règle pour tous les membres.

## 5 bis. Invitation du vendredi soir (contenu restreint)

Certains foyers sont invités dès le vendredi soir (dîner du vendredi, petit-déjeuner
et déjeuner du samedi). Les autres invités ne doivent **jamais** voir ces contenus,
y compris en inspectant les requêtes : c'est imposé par les Security Rules.

- `access/friday` : `{ householdIds, phones }`. `householdIds` = source de vérité ;
  `phones` est **dérivé** des `managerPhones` de ces foyers (les règles ne peuvent
  comparer que le téléphone du token). Illisible par les invités.
- `events.audience` : `"all"` ou `"friday"` (obligatoire).
- `info/schedule-friday` : bloc du Programme réservé aux invités du vendredi.
- `fridayRsvps/{personId}` : réponses aux événements du vendredi (et non
  `persons.attendance`, lisible par tous les invités).

Gestion : `node scripts/firestore.js friday list | add <householdId> | remove <householdId> | sync`.

## 6. Migration — attendu de l'agent

1. Écrire un script d'import (idempotent, upsert) qui lit les exports du classeur
   et peuple `persons`, `households`, `rooms`. Ids de documents = personId /
   householdId / roomId. Calculer `managerPhones` à la volée.
2. Réconcilier avec la collection existante : matcher par téléphone quand
   possible ; produire un rapport des invités actuels non retrouvés (à traiter à
   la main) plutôt que de deviner.
3. Préserver toute donnée déjà saisie (RSVP / préférences existants) : ne pas
   écraser `mealPreferences` / `attendance` si déjà renseignés.
4. Générer les Security Rules ci-dessus et un jeu de tests (règles + un cas de
   co-gestion couple, un cas d'enfant non-connectable, un cas de coloc = foyers
   séparés).

Choisir le langage/SDK selon le stack déjà présent dans le repo
(Firebase Admin SDK en Node ou Python).
