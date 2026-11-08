const strings = {
  FR: {
    title: 'Mon groupe',
    back: 'Retour',
    you: 'Vous',
    adult: 'Adulte',
    child: 'Enfant',
    loading: 'Chargement…',
    memberCount: (n) => `${n} personne${n > 1 ? 's' : ''}`,
    withPartner: (name) => `avec ${name}`,
    roomTitle: 'Votre hébergement',
    capacity: (n) => `${n} place${n > 1 ? 's' : ''}`,
    roommatesTitle: 'Vous partagez cette chambre avec',
    noRoom: "Hébergement pas encore assigné.",
    noHousehold: "Votre groupe n'est pas encore configuré — contactez les mariés.",
  },
  EN: {
    title: 'My group',
    back: 'Back',
    you: 'You',
    adult: 'Adult',
    child: 'Child',
    loading: 'Loading…',
    memberCount: (n) => `${n} person${n > 1 ? 's' : ''}`,
    withPartner: (name) => `with ${name}`,
    roomTitle: 'Your accommodation',
    capacity: (n) => `${n} spot${n > 1 ? 's' : ''}`,
    roommatesTitle: 'You share this room with',
    noRoom: 'Accommodation not assigned yet.',
    noHousehold: "Your group isn't set up yet — contact the couple.",
  },
}

export default strings
