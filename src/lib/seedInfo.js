import { doc, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

export const SECTIONS = [
  { id: 'schedule',      icon: '📅', labelFR: 'Programme',   labelEN: 'Schedule' },
  { id: 'dresscode',     icon: '👗', labelFR: 'Tenue',       labelEN: 'Dress code' },
  { id: 'accommodation', icon: '🏨', labelFR: 'Hébergement', labelEN: 'Accommodation' },
  { id: 'faq',           icon: '❓', labelFR: 'FAQ',          labelEN: 'FAQ' },
  { id: 'contact',       icon: '📞', labelFR: 'Contact',     labelEN: 'Contact' },
]

// Edit all wedding content here — no redeployment needed after first seed.
const INFO_SEEDS = {
  schedule: {
    FR: {
      days: [
        {
          label: 'Samedi',
          items: [
            { time: '11h00', title: 'Cérémonie', desc: 'Lieu à confirmer' },
            { time: '13h00', title: 'Cocktail',  desc: '' },
            { time: '19h00', title: 'Dîner',     desc: 'Tenue de soirée' },
            { time: '22h00', title: 'Soirée',    desc: 'Ouverture du bal' },
          ],
        },
        {
          label: 'Dimanche',
          items: [
            { time: '11h00', title: 'Brunch', desc: 'Lieu à confirmer' },
          ],
        },
      ],
    },
    EN: {
      days: [
        {
          label: 'Saturday',
          items: [
            { time: '11:00', title: 'Ceremony', desc: 'Venue TBC' },
            { time: '1:00 pm', title: 'Cocktail', desc: '' },
            { time: '7:00 pm', title: 'Dinner',   desc: 'Evening wear' },
            { time: '10:00 pm', title: 'Party',   desc: 'First dance' },
          ],
        },
        {
          label: 'Sunday',
          items: [
            { time: '11:00', title: 'Brunch', desc: 'Venue TBC' },
          ],
        },
      ],
    },
  },

  dresscode: {
    FR: {
      title: 'Tenue de soirée',
      body: "Nous vous demandons une tenue habillée pour la cérémonie et le dîner.\n\nPensez au confort pour la soirée dansante. Évitez le blanc et l'écru.\n\nTalons déconseillés si la cérémonie se déroule en extérieur.",
    },
    EN: {
      title: 'Evening wear',
      body: "We kindly ask for smart dress for the ceremony and dinner.\n\nComfort is key for the evening party. Please avoid white and ivory.\n\nHigh heels are not recommended if the ceremony takes place outdoors.",
    },
  },

  accommodation: {
    FR: {
      intro: "Plusieurs options d'hébergement sont disponibles à proximité du lieu de réception.",
      options: [
        { name: 'Hôtel (à compléter)', desc: 'Adresse et tarifs à renseigner.', url: '', phone: '' },
        { name: 'Locations Airbnb',    desc: 'Plusieurs logements disponibles dans le secteur.', url: '', phone: '' },
      ],
    },
    EN: {
      intro: 'Several accommodation options are available near the venue.',
      options: [
        { name: 'Hotel (TBC)',    desc: 'Address and rates to be added.', url: '', phone: '' },
        { name: 'Airbnb rentals', desc: 'Several options available in the area.', url: '', phone: '' },
      ],
    },
  },

  faq: {
    FR: {
      items: [
        { q: 'Puis-je venir avec mes enfants ?',          a: "Les enfants sont les bienvenus au dîner et au brunch. Pour la soirée, nous recommandons de prévoir une garde d'enfants." },
        { q: 'Y a-t-il un parking sur place ?',           a: 'Oui, un parking gratuit est disponible sur le lieu de réception.' },
        { q: 'Comment se rendre sur place ?',             a: 'Les informations de trajet seront communiquées prochainement.' },
        { q: 'À quelle adresse envoyer un cadeau ?',      a: "Nous préférons les participations à notre liste ou une enveloppe. Merci pour votre générosité !" },
      ],
    },
    EN: {
      items: [
        { q: 'Can I bring my children?',     a: 'Children are welcome at the dinner and brunch. For the evening party, we recommend arranging childcare.' },
        { q: 'Is there parking on site?',    a: 'Yes, free parking is available at the venue.' },
        { q: 'How do I get there?',          a: 'Travel details will be shared soon.' },
        { q: 'Where can I send a gift?',     a: 'We prefer contributions to our wedding list or a card. Thank you for your generosity!' },
      ],
    },
  },

  contact: {
    FR: {
      intro: "Pour toute question, n'hésitez pas à contacter les personnes ci-dessous.",
      contacts: [
        { name: 'Prénom Nom', role: 'Témoin de la mariée', phone: '+33 6 XX XX XX XX', email: '' },
        { name: 'Prénom Nom', role: 'Témoin du marié',     phone: '+33 6 XX XX XX XX', email: '' },
      ],
    },
    EN: {
      intro: 'For any questions, please reach out to the contacts below.',
      contacts: [
        { name: 'First Last', role: "Bride's witness",  phone: '+33 6 XX XX XX XX', email: '' },
        { name: 'First Last', role: "Groom's witness",  phone: '+33 6 XX XX XX XX', email: '' },
      ],
    },
  },
}

export async function seedInfo() {
  await Promise.all(
    Object.entries(INFO_SEEDS).map(([id, data]) =>
      setDoc(doc(firestore, 'info', id), data)
    )
  )
}
