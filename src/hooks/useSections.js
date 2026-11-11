import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { firestore } from '../firebase/firebaseClient'

// Admin on/off switches, stored in settings/sections (public read, admin write):
//   { menu: bool, rooms: bool, info: { [sectionId]: bool } }
// A switched-off section stays listed for guests but greyed out as
// "Bientôt disponible"; admins can still open it.
// `rooms` = whether guests see their assigned room (profile + map highlight);
// off while the room plan may still change. Admins always see rooms.
// Defaults until an admin changes something: Menu closed (it opens ~2 months
// before the wedding, when the chef's menu is final), rooms hidden, every info
// page open.
export const MENU_TARGET_DATE = '3 mai 2027'
const DEFAULTS = { menu: false, rooms: false, info: {} }

export default function useSections() {
  const [sections, setSections] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => onSnapshot(
    doc(firestore, 'settings', 'sections'),
    snap => {
      const d = snap.exists() ? snap.data() : {}
      setSections({ menu: d.menu === true, rooms: d.rooms === true, info: d.info ?? {} })
      setLoading(false)
    },
    () => { setSections(DEFAULTS); setLoading(false) },
  ), [])

  return {
    loading,
    menuEnabled: sections.menu,
    roomsVisible: sections.rooms,
    infoEnabled: sectionId => sections.info[sectionId] !== false,
  }
}

// Admin only (security rules).
export function setMenuEnabled(enabled) {
  return setDoc(doc(firestore, 'settings', 'sections'), { menu: enabled }, { merge: true })
}
export function setRoomsVisible(visible) {
  return setDoc(doc(firestore, 'settings', 'sections'), { rooms: visible }, { merge: true })
}
export function setInfoEnabled(sectionId, enabled) {
  return setDoc(doc(firestore, 'settings', 'sections'), { info: { [sectionId]: enabled } }, { merge: true })
}
