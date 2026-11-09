// Demo data. Lives only in memory (MemoryStore) and is never written to the
// device database, so it can't mix with real data. All details are fictional;
// phone numbers use the reserved 555-01xx range and domains use example.com.
//
// To use photos on the demo cards, drop images into public/images/demo/ and set
// `staticPhoto: 'images/demo/<file>.jpg'` on a card below.

export function buildDemo() {
  const profile = {
    id: 'me',
    fullName: 'Maya Rao',
    preferredName: 'Maya',
    jobTitle: 'Product Designer',
    company: 'Lumen Studio',
    phones: [
      { id: 'dp1', label: 'Mobile', value: '+1 202 555 0143' },
      { id: 'dp2', label: 'Work', value: '+1 202 555 0177' },
    ],
    whatsapp: '+1 202 555 0143',
    emails: [
      { id: 'de1', label: 'Personal', value: 'maya@example.com' },
      { id: 'de2', label: 'Work', value: 'maya.rao@lumen.example.com' },
    ],
    website: 'maya.example.com',
    socials: [
      { id: 'ds1', network: 'linkedin', value: 'mayarao' },
      { id: 'ds2', network: 'instagram', value: 'mayamakes' },
      { id: 'ds3', network: 'github', value: 'mayarao' },
    ],
    address: { street: '12 Lake View Road', city: 'Springfield', region: '', postcode: '00000', country: 'Example Land' },
    birthday: '1994-04-18',
    bio: 'Designing calm, useful software.',
    custom: [{ id: 'dc1', label: 'Pronouns', value: 'she/her' }],
  };
  const cards = [
    { id: 'demo_pro', type: 'professional', title: 'Professional', displayName: 'Maya Rao', subtitle: 'Product Designer · Lumen Studio', scene: 'sky', preset: 'professional', order: 0 },
    { id: 'demo_personal', type: 'personal', title: 'Personal', displayName: 'Maya', subtitle: 'Friends & family', scene: 'dusk', preset: 'personal', order: 1 },
    { id: 'demo_social', type: 'social', title: 'Social', displayName: '@mayamakes', subtitle: 'Sketches, hikes and coffee', scene: 'lake', preset: 'social', order: 2 },
  ];
  return { profile, cards, photos: [] };
}
