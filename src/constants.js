export const CONTACT_EMAIL = 'hamed.nalle@sautify.co.ke'

export function mailto(subject) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export const PILOT_MAILTO = mailto('Pilot Programme Application')
export const ARTIST_WAITLIST_MAILTO = mailto('Artist Waitlist')
