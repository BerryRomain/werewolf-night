const PHASES = {
  LOBBY: 'lobby',
  READY: 'ready',
  NIGHT: 'night',
  DAY: 'day',
  VOTE: 'vote',
  REVEAL: 'reveal',
};

const ROLES = ['Loup Garou', 'Noiseuse', 'Voleur', 'Soûlard', 'Insomniaque', 'Villageois', 'Chasseur', 'Voyante', 'Sbire', 'Franc-Maçon', 'Tanneur', 'Doppelgänger'];
const NIGHT_ROLES = ['Doppelgänger', 'Loup Garou', 'Sbire', 'Franc-Maçon', 'Voyante', 'Noiseuse', 'Voleur', 'Soûlard', 'Insomniaque'];

const ROLE_PRIORITY = {
  'Doppelgänger': 0,
  'Loup Garou': 1,
  'Sbire': 2,
  'Franc-Maçon': 2.5,
  Voyante: 3,
  Voleur: 4,
  Noiseuse: 5,
  'Soûlard': 6,
  Insomniaque: 7,
  Villageois: 8,
  Chasseur: 9,
  Tanneur: 10,
};

// Roles the Doppelgänger executes immediately during her own turn
const DOPPELGANGER_IMMEDIATE_ROLES = ['Voyante', 'Voleur', 'Noiseuse', 'Soûlard'];
// Roles that make the Doppelgänger wake up with a group later
const DOPPELGANGER_GROUP_ROLES = ['Loup Garou', 'Franc-Maçon'];
// Roles that give the Doppelgänger a Sbire-like briefing during her turn
const DOPPELGANGER_PASSIVE_NIGHT_ROLES = ['Sbire'];

const ROLE_POWER_INFO = {
  'Loup Garou': {
    description: 'Le Loup Garou peut regarder une carte du centre pendant la nuit s’il est le seul loup, s’il y a plusieurs loups alors il ne peut pas voir les cartes du centre mais seulement les autres loups.',
    power: 'Clique sur une carte centrale pour la voir si tu es le seul loup. Si vous êtes plusieurs loups, vous ne pouvez pas voir les cartes du centre mais seulement les autres loups.',
  },
  Noiseuse: {
    description: 'La Noiseuse peut échanger les rôles de deux autres joueurs sans les regarder.',
    power: 'Sélectionne deux joueurs pour échanger leurs rôles.',
  },
  Voleur: {
    description: 'Le Voleur échange son rôle avec celui d’un autre joueur.',
    power: 'Clique sur un autre joueur pour échanger de rôle.',
  },
  'Soûlard': {
    description: 'Le Soûlard échange sa carte contre une carte du centre sans la regarder.',
    power: 'Clique sur une carte du centre pour l’échanger avec la tienne.',
  },
  Insomniaque: {
    description: 'L’Insomniaque peut regarder sa propre carte à la fin de la nuit.',
    power: 'Regarde ta propre carte pour voir ton rôle actuel.',
  },
  Villageois: {
    description: 'Le Villageois n’a pas d’action spéciale la nuit.',
    power: 'Observe et vote en journée.',
  },
  Chasseur: {
    description: 'Si le Chasseur est éliminé par le vote, il peut désigner un joueur supplémentaire qui mourra avec lui. Si ce joueur est un Loup Garou, le village gagne. Sinon, les loups gagnent.',
    power: 'Si tu es éliminé par le vote, clique sur un joueur pour l’entraîner dans ta mort. Tu ne peux pas viser le centre.',
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

// Système de pool de rôles avec composition customizable
const ROLE_CATEGORIES = {
  WEREWOLVES: 'Loup Garou',
  VILLAGERS: 'Villageois',
};

// Mapping des rôles vers leur camp principal (lg / village / neutre)
const ROLE_CAMPS = {
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

const DEFAULT_COMPOSITION = {
  'Loup Garou': 0,
  'Noiseuse': 0,
  'Voleur': 0,
  'Soûlard': 0,
  'Insomniaque': 0,
  'Villageois': 0,
  'Chasseur': 0,
  'Voyante': 0,
  'Sbire': 0,
  'Franc-Maçon': 0,
  'Tanneur': 0,
  'Doppelgänger': 0,
};

function normalizeComposition(composition) {
  const normalized = Object.fromEntries(Object.keys(DEFAULT_COMPOSITION).map(k => [k, 0]));
  if (!composition || typeof composition !== 'object') return normalized;
  for (const [role, count] of Object.entries(composition)) {
    const parsedCount = Number(count);
    if (role in normalized) normalized[role] = Number.isFinite(parsedCount) ? parsedCount : 0;
  }
  return normalized;
}

/**
 * Valide une composition de partie
 * @param {Object} composition - Nombre de cartes par rôle
 * @param {number} playerCount - Nombre de joueurs
 * @returns {Object} { valid: boolean, error: string | null }
 */
function validateComposition(composition, playerCount) {
  const normalizedComposition = normalizeComposition(composition);
  const totalCards = Object.values(normalizedComposition).reduce((sum, count) => sum + (count || 0), 0);
  const requiredCards = playerCount + 3;

  if (totalCards !== requiredCards) {
    return {
      valid: false,
      error: `Le nombre total de cartes doit être égal à ${requiredCards} (joueurs + 3), vous en avez ${totalCards}`,
    };
  }

  // Vérifier que chaque rôle n'excède pas un nombre raisonnable
  const maxPerRole = Math.ceil((playerCount + 3) / 2);
  for (const [role, count] of Object.entries(normalizedComposition)) {
    if (count < 0) {
      return { valid: false, error: `Le nombre de ${role} ne peut pas être négatif` };
    }
    // Les Francs-Maçons doivent toujours être ajoutés par 2 (ou 0)
    if (role === 'Franc-Maçon' && count !== 0 && count !== 2) {
      return { valid: false, error: `Les Francs-Maçons doivent être ajoutés par 2 (actuellement : ${count})` };
    }
    if (count > maxPerRole) {
      return {
        valid: false,
        error: `Trop de ${role} (max: ${maxPerRole})`,
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Construit un deck de rôles basé sur une composition
 * @param {Object} composition - Nombre de cartes par rôle
 * @returns {Array} Deck mélangé de rôles
 */
function buildRoleDeckFromComposition(composition) {
  const normalizedComposition = normalizeComposition(composition);
  const roles = [];
  for (const [role, count] of Object.entries(normalizedComposition)) {
    for (let i = 0; i < count; i++) {
      roles.push(role);
    }
  }
  return shuffle(roles);
}

/**
 * Mélange un tableau
 * @param {Array} array
 * @returns {Array}
 */
function shuffle(array) {
  const arr = [...array];
  return arr.sort(() => Math.random() - 0.5);
}

/**
 * Crée une composition par défaut en fonction du nombre de joueurs
 * @param {number} playerCount
 * @returns {Object}
 */
function createDefaultComposition(playerCount) {
  // Composition vide par défaut — l'hôte configure lui-même
  return Object.fromEntries(Object.keys(DEFAULT_COMPOSITION).map(k => [k, 0]));
}

module.exports = {
  PHASES,
  ROLES,
  NIGHT_ROLES,
  ROLE_PRIORITY,
  ROLE_POWER_INFO,
  ROLE_CATEGORIES,
  ROLE_CAMPS,
  DEFAULT_COMPOSITION,
  DOPPELGANGER_IMMEDIATE_ROLES,
  DOPPELGANGER_GROUP_ROLES,
  DOPPELGANGER_PASSIVE_NIGHT_ROLES,
  normalizeComposition,
  validateComposition,
  buildRoleDeckFromComposition,
  shuffle,
  createDefaultComposition,
};
