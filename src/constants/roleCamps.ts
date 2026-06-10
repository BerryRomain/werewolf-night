export const ROLE_CAMPS: Record<string, 'lg' | 'village' | 'neutre'> = {
  'Loup Garou': 'lg',
  'Sbire': 'lg',
  'Tanneur': 'neutre',
  'Doppelgänger': 'neutre',
  Noiseuse: 'village',
  Voleur: 'village',
  'Soûlard': 'village',
  Insomniaque: 'village',
  Villageois: 'village',
  Chasseur: 'village',
  Voyante: 'village',
  'Franc-Maçon': 'village',
};

export const CAMP_LABELS: Record<'lg' | 'village' | 'neutre', string> = {
  lg: 'Loups',
  village: 'Village',
  neutre: 'Neutre',
};

export const CAMP_CLASSES: Record<'lg' | 'village' | 'neutre', string> = {
  lg: 'bg-rose-900/60 text-rose-300 border border-rose-700',
  village: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700',
  neutre: 'bg-amber-900/50 text-amber-300 border border-amber-700',
};
