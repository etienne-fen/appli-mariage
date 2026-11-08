const strings = {
  FR: {
    title: 'Mon profil',
    back: 'Retour',
    you: 'Vous',
    adult: 'Adulte',
    child: 'Enfant',
    loading: 'Chargement…',
    noPhone: 'Pas de numéro',
    roomTitle: 'Hébergement',
    seeOnMap: 'Voir sur le plan →',
    noRoom: 'Hébergement pas encore assigné.',
    capacity: (n) => `${n} place${n > 1 ? 's' : ''}`,
    sharedWith: (names) => `Chambre partagée avec ${names}`,
    pending: (n) => n === 0
      ? 'Toutes les réponses sont données ✓'
      : `${n} réponse${n > 1 ? 's' : ''} en attente`,
    answerNow: 'Répondre →',
    tribeTitle: 'Ma tribu',
    noHousehold: "Votre profil n'est pas encore configuré — contactez les mariés.",
  },
  EN: {
    title: 'My profile',
    back: 'Back',
    you: 'You',
    adult: 'Adult',
    child: 'Child',
    loading: 'Loading…',
    noPhone: 'No number',
    roomTitle: 'Accommodation',
    seeOnMap: 'See on the map →',
    noRoom: 'Accommodation not assigned yet.',
    capacity: (n) => `${n} spot${n > 1 ? 's' : ''}`,
    sharedWith: (names) => `Room shared with ${names}`,
    pending: (n) => n === 0
      ? 'All answers given ✓'
      : `${n} answer${n > 1 ? 's' : ''} missing`,
    answerNow: 'Answer →',
    tribeTitle: 'My tribe',
    noHousehold: "Your profile isn't set up yet — contact the couple.",
  },
}

export default strings
