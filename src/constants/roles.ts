// Frontend TypeScript export of role constants
// Mirrored from constants/roles.js for ESM compatibility

export const NIGHT_ROLES = ['Doppelgänger', 'Loup Garou', 'Sbire', 'Franc-Maçon', 'Voyante', 'Noiseuse', 'Voleur', 'Soûlard', 'Insomniaque'];

export const ROLE_POWER_INFO: Record<string, { description: string; power: string }> = {
  'Loup Garou': {
    description: "Le Loup Garou peut regarder une carte du centre pendant la nuit s'il est le seul loup, s'il y a plusieurs loups alors il ne peut pas voir les cartes du centre mais seulement les autres loups.",
    power: "Clique sur une carte centrale pour la voir si tu es le seul loup. Si vous êtes plusieurs loups, vous ne pouvez pas voir les cartes du centre mais seulement les autres loups.",
  },
  Noiseuse: {
    description: 'La Noiseuse peut échanger les rôles de deux autres joueurs sans les regarder.',
    power: 'Sélectionne deux joueurs pour échanger leurs rôles.',
  },
  Voleur: {
    description: "Le Voleur échange son rôle avec celui d'un autre joueur.",
    power: "Clique sur un autre joueur pour échanger de rôle.",
  },
  'Soûlard': {
    description: 'Le Soûlard échange sa carte contre une carte du centre sans la regarder.',
    power: "Clique sur une carte du centre pour l'échanger avec la tienne.",
  },
  Insomniaque: {
    description: "L'Insomniaque peut regarder sa propre carte à la fin de la nuit.",
    power: 'Regarde ta propre carte pour voir ton rôle actuel.',
  },
  Villageois: {
    description: "Le Villageois n'a pas d'action spéciale la nuit.",
    power: 'Observe et vote en journée.',
  },
  Chasseur: {
    description: "Si le Chasseur est éliminé par le vote, il peut désigner un joueur supplémentaire qui mourra avec lui. Si ce joueur est un Loup Garou, le village gagne. Sinon, les loups gagnent.",
    power: "Si tu es éliminé par le vote, clique sur un joueur pour l'entraîner dans ta mort. Tu ne peux pas viser le centre.",
  },
  Sbire: {
    description: "Le Sbire fait partie de l'équipe des Loups-garous mais n'en est pas un. Pendant la nuit, il apprend l'identité des Loups-garous. Les loups ne savent pas qui est le Sbire. Si le Sbire meurt et qu'aucun loup ne meurt, les loups gagnent. S'il n'y a aucun loup, le Sbire gagne si un autre joueur (pas lui) meurt.",
    power: "Tu peux savoir qui sont les loups. Tu connais leurs identités, eux ne connaissent pas la tienne.",
  },
  Voyante: {
    description: "La Voyante peut regarder la carte d'un autre joueur, ou regarder deux cartes au centre. Elle ne déplace aucune carte. Elle fait partie de l'équipe du village.",
    power: "Clique sur la carte d'un joueur pour voir son rôle, ou clique sur deux cartes du centre pour les révéler.",
  },
  'Franc-Maçon': {
    description: "Les Francs-Maçons sont toujours deux dans la partie. Ils se réveillent la nuit pour se reconnaître. Si un Franc-Maçon ne voit pas l'autre, cela signifie que l'autre carte est au centre. Les Francs-Maçons font partie de l'équipe du village.",
    power: "Tu vas découvrir qui est l'autre Franc-Maçon. Si tu ne vois personne, l'autre carte est au centre.",
  },
  Tanneur: {
    description: "Le Tanneur déteste tellement son travail qu'il veut mourir. Il gagne uniquement s'il meurt lors du vote. Il ne fait partie ni de l'équipe du village ni de celle des Loups-garous. Si le Tanneur meurt et qu'aucun Loup-garou ne meurt, ni le village ni les loups ne gagnent — seul le Tanneur gagne. Si le Tanneur meurt en même temps qu'un Loup-garou, le village gagne aussi.",
    power: "Tu veux mourir. Convaincs les autres joueurs de voter contre toi… ou joue double jeu.",
  },
  'Doppelgänger': {
    description: "La Doppelgänger regarde la carte d'un autre joueur et devient ce rôle pour toute la partie. Si elle copie un rôle avec une action nocturne immédiate (Voyante, Voleur, Noiseuse, Soûlard), elle l'effectue directement. Si elle copie un Loup Garou ou un Franc-Maçon, elle se réveille avec eux. Si elle copie le Sbire, elle voit les loups pendant son propre tour. Si elle copie l'Insomniaque, elle se réveille en dernier pour vérifier sa carte.",
    power: "Clique sur la carte d'un joueur pour voir son rôle et le copier. Tu effectueras immédiatement l'action si nécessaire.",
  },
};
