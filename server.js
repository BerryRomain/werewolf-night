const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['websocket', 'polling']
});
app.use(express.static('dist'));
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const games = {};
const {
  PHASES,
  NIGHT_ROLES,
  ROLE_PRIORITY,
  ROLE_POWER_INFO,
  DEFAULT_COMPOSITION,
  validateComposition,
  buildRoleDeckFromComposition,
  shuffle,
  createDefaultComposition,
  normalizeComposition,
  DOPPELGANGER_IMMEDIATE_ROLES,
  DOPPELGANGER_GROUP_ROLES,
  DOPPELGANGER_PASSIVE_NIGHT_ROLES,
} = require('./constants/roles');

const ROLE_TIMER_MS = 30 * 1000;
const DOPPELGANGER_TIMER_MS = 45 * 1000;

function makeGameCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function buildRoleDeck(playerCount, composition) {
  const comp = composition || createDefaultComposition(playerCount);
  return buildRoleDeckFromComposition(comp);
}

function createGameState(players) {
  return {
    roles: [],
    positions: {
      players: players.map((player, index) => ({
        playerId: player.id,
        name: player.name,
        role: player.role,
        position: index,
      })),
      center: [],
    },
    currentTurn: {
      phase: PHASES.LOBBY,
      actorId: null,
      stepIndex: 0,
      nightOrder: [],
    },
  };
}

function syncGameState(game) {
  game.state.positions.players = game.players.map((player, index) => ({
    playerId: player.id,
    name: player.name,
    role: player.role,
    position: index,
  }));
  game.state.positions.center = game.centerCards.map((card, index) => ({
    position: index,
    role: card.role,
  }));
  game.state.currentTurn = {
    phase: game.phase,
    actorId: game.currentNightActorId,
    stepIndex: game.currentNightActorIndex,
    nightOrder: game.currentNightQueue.map((entry) => entry.roleName),
  };
}

function initializePersonalViews(game) {
  const views = {};
  game.players.forEach((player) => {
    views[player.id] = {
      centerCards: [false, false, false],
      centerRoles: [null, null, null],
      peekedPlayers: {},
      selfPeek: false,
    };
  });
  return views;
}

function sendPublicState(game) {
  const publicPlayers = game.players.map((p) => {
    const player = { id: p.id, name: p.name, alive: p.alive };
    if (game.phase === PHASES.REVEAL) {
      player.role = p.role;
    }
    return player;
  });
  const publicCenterCards = game.phase === PHASES.REVEAL
    ? game.centerCards.map((card, index) => ({ index, role: card.role }))
    : game.centerCards.map((_, index) => ({ index }));
  const currentActor = game.players.find((p) => p.id === game.currentNightActorId);
  io.to(game.code).emit('gameState', {
    code: game.code,
    phase: game.phase,
    players: publicPlayers,
    owner: game.owner,
    logs: game.logs,
    voteResults: game.voteResults || null,
    voteMapping: game.phase === PHASES.REVEAL ? Object.fromEntries(
      Object.entries(game.votes || {}).map(([playerId, target]) => {
        const player = game.players.find((p) => p.id === playerId);
        return [player ? player.name : playerId, target];
      })
    ) : null,
    centerCount: game.centerCards.length,
    centerCards: publicCenterCards,
    currentActorName: currentActor ? currentActor.name : game.currentNightActorRole,
    voteTimer: game.phase === PHASES.VOTE && game.voteTimerStartAt ? {
      duration: game.voteTimerDuration,
      startedAt: game.voteTimerStartAt,
    } : null,
    result: game.result || null,
    composition: game.composition || null,
    compositionError: game.compositionError || null,
    hunterShotPending: game.pendingReveal || false,
    state: game.state,
  });
}

function clearVoteTimer(game) {
  if (game.voteTimer) {
    clearTimeout(game.voteTimer);
    game.voteTimer = null;
  }
}

function finalizeVotes(game) {
  const voteCounts = {};
  Object.values(game.votes || {}).forEach((name) => {
    voteCounts[name] = (voteCounts[name] || 0) + 1;
  });

  let maxVotes = 0;
  Object.values(voteCounts).forEach((count) => {
    if (count > maxVotes) maxVotes = count;
  });

  const winners = Object.entries(voteCounts)
    .filter(([, count]) => count === maxVotes)
    .map(([name]) => name);

  const eliminatedPlayers = game.players.filter((p) => winners.includes(p.name));

  if (winners.length === 1) {
    const target = winners[0];
    if (target === 'centre' || target === 'center') {
      game.logs.push(`Vote final : le centre reçoit ${maxVotes} voix. Personne n'est éliminé.`);
    } else {
      const eliminatedPlayer = game.players.find((p) => p.name === target);
      const role = eliminatedPlayer ? (eliminatedPlayer.role || eliminatedPlayer.initialRole) : '???';
      game.logs.push(`Vote final : ${target} est mort du vote. Il/Elle était ${role}.`);
    }
  } else {
    const playerDeaths = winners.filter((n) => n !== 'centre' && n !== 'center');
    const centerVoted = winners.some((n) => n === 'centre' || n === 'center');
    const parts = [];
    if (playerDeaths.length > 0) {
      const deathDescs = playerDeaths.map((name) => {
        const p = game.players.find((pl) => pl.name === name);
        const role = p ? (p.role || p.initialRole) : '???';
        return `${name} (${role})`;
      });
      parts.push(deathDescs.join(' et '));
    }
    if (centerVoted) parts.push('le centre');
    game.logs.push(`Égalité ! ${parts.join(' et ')} meurent avec ${maxVotes} voix chacun.`);
  }

  // Helper: effective role for Doppelgänger victory checks
  const effectiveWolfRole = (p) =>
    p.initialRole === 'Loup Garou' ||
    (p.initialRole === 'Doppelgänger' && p.doppelgangerCopied === 'Loup Garou');
  const effectiveTannerRole = (p) =>
    p.initialRole === 'Tanneur' ||
    (p.initialRole === 'Doppelgänger' && p.doppelgangerCopied === 'Tanneur');
  const effectiveMinionRole = (p) =>
    p.initialRole === 'Sbire' ||
    (p.initialRole === 'Doppelgänger' && p.doppelgangerCopied === 'Sbire');
  const effectiveHunterRole = (p) =>
    p.initialRole === 'Chasseur' ||
    (p.initialRole === 'Doppelgänger' && p.doppelgangerCopied === 'Chasseur');

  const anyWerewolfInGame = game.players.some(effectiveWolfRole);
  const anyWerewolfEliminated = eliminatedPlayers.some(effectiveWolfRole);
  const minionInGame = game.players.find(effectiveMinionRole);
  const nonMinionEliminated = eliminatedPlayers.some((p) => !effectiveMinionRole(p));
  const tannerEliminated = eliminatedPlayers.some(effectiveTannerRole);

  let result = null;
  if (tannerEliminated) {
    if (anyWerewolfEliminated) {
      result = 'village';
      game.logs.push("Un Loup-garou est également mort. L'équipe du village gagne !");
    } else {
      result = 'tanner';
      game.logs.push('Le Tanneur est mort. Seul le Tanneur gagne !');
    }
  } else if (anyWerewolfEliminated) {
    result = 'village';
    game.logs.push("Un Loup-garou est mort. L'équipe du village gagne !");
  } else if (!anyWerewolfInGame && minionInGame) {
    result = nonMinionEliminated ? 'wolves' : 'village';
  } else if (!anyWerewolfInGame && !minionInGame) {
    result = eliminatedPlayers.length > 0 ? 'wolves' : 'village';
  } else {
    result = 'wolves';
    game.logs.push("Aucun Loup-garou n'est mort. Les Loups-garous gagnent !");
  }

  const hunterEliminated = eliminatedPlayers.find(effectiveHunterRole);
  if (hunterEliminated && !game.hunterShotDone) {
    game.result = result;
    game.pendingReveal = true;
    game.voteTimerStartAt = null;
    game.voteTimerDuration = null;
    clearVoteTimer(game);
    game.logs.push(`${hunterEliminated.name} est le Chasseur ! Il doit choisir sa cible avant la révélation.`);
    syncGameState(game);
    sendGameState(game);
    io.to(hunterEliminated.id).emit('hunterShot');
    const announcement = `Vous avez éliminé ${hunterEliminated.name} qui était Chasseur. Avant de mourir, il peut emporter un autre joueur avec lui...`;
    const hunterSocket = io.sockets.sockets.get(hunterEliminated.id);
    if (hunterSocket) {
      hunterSocket.broadcast.to(game.code).emit('systemMessage', announcement);
    } else {
      io.to(game.code).emit('systemMessage', announcement);
    }
    return;
  }

  game.result = result;
  game.phase = PHASES.REVEAL;
  game.voteTimerStartAt = null;
  game.voteTimerDuration = null;
  clearVoteTimer(game);
  syncGameState(game);
  sendGameState(game);
}

function scheduleVoteEnd(game) {
  clearVoteTimer(game);
  if (game.voteTimerStartAt && game.voteTimerDuration) {
    const remaining = Math.max(0, game.voteTimerStartAt + game.voteTimerDuration - Date.now());
    game.voteTimer = setTimeout(() => {
      console.log(`[voteTimer] ending votes for game=${game.code}`);
      finalizeVotes(game);
    }, remaining);
  }
}

function sendPrivateStates(game) {
  const currentActor = game.players.find((p) => p.id === game.currentNightActorId);
  if (game.phase === PHASES.NIGHT && game.currentNightActorId && !currentActor) {
    console.warn('[privateState-warning] currentNightActorId not found in game.players');
  }

  game.players.forEach((player) => {
    let view = game.personalViews[player.id];
    if (!view) {
      view = { centerCards: [false, false, false], centerRoles: [null, null, null], peekedPlayers: {}, selfPeek: false };
      game.personalViews[player.id] = view;
    }

    const centerCards = game.centerCards.map((card, index) => ({
      index,
      revealed: view.centerCards[index],
      role: view.centerCards[index] ? card.role : null,
    }));

    const privateState = {
      myId: player.id,
      role: player.role,
      initialRole: player.initialRole || player.role,
      doppelgangerCopied: player.doppelgangerCopied || null,
      rolePower: ROLE_POWER_INFO[player.role] || {},
      canAct: game.phase === PHASES.NIGHT && game.currentNightActorId === player.id,
      currentActorName: currentActor ? currentActor.name : game.currentNightActorRole,
      centerCards,
      peekedPlayers: view.peekedPlayers,
      selfPeek: view.selfPeek,
    };

    // ── Sbire: wolf names ──
    if (
      game.phase === PHASES.NIGHT &&
      (player.initialRole === 'Sbire' || player.role === 'Sbire') &&
      game.currentNightActorRole === 'Sbire'
    ) {
      privateState.minionWolves = game.players
        .filter((p) => p.initialRole === 'Loup Garou')
        .map((p) => p.name);
    }

    // ── Franc-Maçon: ally ──
    if (
      game.phase === PHASES.NIGHT &&
      (player.initialRole === 'Franc-Maçon' || player.role === 'Franc-Maçon') &&
      game.currentNightActorRole === 'Franc-Maçon'
    ) {
      const allMasons = game.players.filter(
        (p) => (p.initialRole === 'Franc-Maçon' || p.role === 'Franc-Maçon') && p.id !== player.id
      );
      privateState.masonAlly = allMasons.length > 0 ? allMasons[0].name : null;
    }

    // ── Doppelgänger own turn info ──
    if (
      game.phase === PHASES.NIGHT &&
      player.initialRole === 'Doppelgänger' &&
      (game.currentNightActorRole === 'Doppelgänger' || game.currentNightActorRole === 'Doppelgänger-Insomniaque')
    ) {
      privateState.doppelgangerTurn = true;
      privateState.doppelgangerSubPhase = game.currentNightActorRole === 'Doppelgänger-Insomniaque'
        ? 'insomniaque-check'
        : (game.doppelgangerSubPhase || 'pick');

      // Sbire subphase: send wolf IDs as red aura (no names)
      if (player.doppelgangerCopied === 'Sbire' && game.doppelgangerSubPhase === 'sbire') {
        privateState.doppelgangerWolfIds = game.players
          .filter((p) => p.initialRole === 'Loup Garou')
          .map((p) => p.id);
      }
    }

    // ── Wolf turn: real wolves + doppelganger-wolf all get wolfPackIds for red aura ──
    if (game.phase === PHASES.NIGHT && game.currentNightActorRole === 'Loup Garou') {
      const isDoppelWolf = player.initialRole === 'Doppelgänger' && player.doppelgangerCopied === 'Loup Garou';
      const isRealWolf = player.initialRole === 'Loup Garou';
      if (isRealWolf || isDoppelWolf) {
        const wolfIds = game.players
          .filter(
            (p) =>
              p.initialRole === 'Loup Garou' ||
              (p.initialRole === 'Doppelgänger' && p.doppelgangerCopied === 'Loup Garou')
          )
          .map((p) => p.id);
        privateState.wolfPackIds = wolfIds;
        privateState.wolfPackSize = wolfIds.length;
        // Lone wolf (only 1 wolf total) can peek center
        privateState.canPeekCenter = wolfIds.length === 1;
      }
    }

    // ── Mason turn: real masons + doppelganger-mason all get ally info ──
    if (game.phase === PHASES.NIGHT && game.currentNightActorRole === 'Franc-Maçon') {
      const isDoppelMason = player.initialRole === 'Doppelgänger' && player.doppelgangerCopied === 'Franc-Maçon';
      const isRealMason = player.initialRole === 'Franc-Maçon';
      if (isDoppelMason || isRealMason) {
        const allies = game.players.filter(
          (p) =>
            (p.initialRole === 'Franc-Maçon' ||
              (p.initialRole === 'Doppelgänger' && p.doppelgangerCopied === 'Franc-Maçon')) &&
            p.id !== player.id
        );
        privateState.masonAlly = allies.length > 0 ? allies[0].name : null;
      }
    }

    io.to(player.id).emit('privateState', privateState);
  });
}

function sendGameState(game) {
  sendPublicState(game);
  sendPrivateStates(game);
}

function clearNightTimer(game) {
  if (game.nightTimer) {
    clearTimeout(game.nightTimer);
    game.nightTimer = null;
  }
}

function advanceNight(game) {
  clearNightTimer(game);

  // Handle Doppelgänger Sbire subphase: was showing wolves, now truly advance
  if (
    game.currentNightActorRole === 'Doppelgänger' &&
    game.doppelgangerSubPhase === 'sbire'
  ) {
    game.doppelgangerSubPhase = null;
    game.doppelgangerCopiedRole = null;
    // Fall through to normal index advance
  }

  game.currentNightActorIndex += 1;
  game.currentNightActorHasActed = false;

  if (game.currentNightActorIndex >= game.currentNightQueue.length) {
    game.phase = PHASES.VOTE;
    game.currentNightActorId = null;
    game.currentNightActorRole = null;
    game.voteTimerStartAt = Date.now();
    game.voteTimerDuration = 5 * 60 * 1000;
    game.votes = {};
    game.voteResults = null;
    game.logs.push('La nuit est terminée. Le vote commence.');
    syncGameState(game);
    sendGameState(game);
    scheduleVoteEnd(game);
    return;
  }

  const next = game.currentNightQueue[game.currentNightActorIndex];
  game.currentNightActorId = next.actorId;
  game.currentNightActorRole = next.roleName;
  game.currentNightActorHasActed = false;
  syncGameState(game);
  sendGameState(game);
  sendNightTurn(game);
  scheduleNextNightTurn(game);
}

function sendNightTurn(game) {
  const actorId = game.currentNightActorId;
  const roleName = game.currentNightActorRole;
  const actor = actorId ? game.players.find((p) => p.id === actorId) : null;
  const duration = (roleName === 'Doppelgänger' || roleName === 'Doppelgänger-Insomniaque')
    ? DOPPELGANGER_TIMER_MS
    : ROLE_TIMER_MS;
  const payload = { actorId, roleName, duration, startedAt: Date.now() };
  console.log(`[nightTurn] game=${game.code} actor=${actor ? actor.name : 'none'} role=${roleName} duration=${duration}`);
  io.to(game.code).emit('nightTurn', payload);
}

function scheduleNextNightTurn(game) {
  clearNightTimer(game);
  if (game.currentNightActorIndex < game.currentNightQueue.length) {
    const roleName = game.currentNightActorRole;
    const duration = (roleName === 'Doppelgänger' || roleName === 'Doppelgänger-Insomniaque')
      ? DOPPELGANGER_TIMER_MS
      : ROLE_TIMER_MS;
    game.nightTimer = setTimeout(() => {
      console.log(`[nightTimer] timeout fired for game=${game.code} actorIndex=${game.currentNightActorIndex}`);
      advanceNight(game);
    }, duration);
  }
}

function createNightQueue(game) {
  const items = [];
  const seenRoles = new Set();
  // Consider Doppelgänger present either as a player or in the center
  const hasDoppelganger = game.players.some((p) => p.initialRole === 'Doppelgänger') ||
    game.centerCards.some((c) => c.role === 'Doppelgänger');

  // Doppelgänger is always first (priority 0)
  if (hasDoppelganger) {
    const doppel = game.players.find((p) => p.initialRole === 'Doppelgänger');
    // If Doppelgänger is only in the center, actorId should be null
    items.push({ actorId: doppel ? doppel.id : null, roleName: 'Doppelgänger' });
    seenRoles.add('Doppelgänger');
  }

  // Regular night roles
  game.players.forEach((player) => {
    if (NIGHT_ROLES.includes(player.role) && !seenRoles.has(player.role) && player.role !== 'Doppelgänger') {
      if (player.role === 'Franc-Maçon') {
        items.push({ actorId: null, roleName: 'Franc-Maçon' });
        seenRoles.add('Franc-Maçon');
      } else {
        items.push({ actorId: player.id, roleName: player.role });
        seenRoles.add(player.role);
      }
    }
  });

  game.centerCards.forEach((card) => {
    if (NIGHT_ROLES.includes(card.role) && !seenRoles.has(card.role) && card.role !== 'Doppelgänger') {
      items.push({ actorId: null, roleName: card.role });
      seenRoles.add(card.role);
    }
  });

  const sorted = items.sort((a, b) => (ROLE_PRIORITY[a.roleName] || 99) - (ROLE_PRIORITY[b.roleName] || 99));

  // Ensure Doppelgänger entry (if present) is always at the front
  if (hasDoppelganger) {
    const idx = sorted.findIndex((e) => e.roleName === 'Doppelgänger');
    if (idx > 0) {
      const [entry] = sorted.splice(idx, 1);
      sorted.unshift(entry);
    }

    // Always add Doppelgänger-Insomniaque at the very end (bluff even if not copied)
    const doppel = game.players.find((p) => p.initialRole === 'Doppelgänger');
    sorted.push({ actorId: doppel ? doppel.id : null, roleName: 'Doppelgänger-Insomniaque' });
  }

  return sorted;
}

// ── Doppelgänger immediate sub-action handler ──
function handleDoppelgangerSubAction(game, socket, player, type, targetName, targetName2, index) {
  const view = game.personalViews[socket.id];
  const copied = player.doppelgangerCopied;
  if (!copied) return false;

  if (copied === 'Voyante') {
    if (type === 'peekPlayer') {
      const target = game.players.find((p) => p.name === targetName);
      if (!target || target.id === socket.id || !target.alive) return false;
      view.peekedPlayers[target.name] = target.role;
      io.to(socket.id).emit('privateMessage', `[Doppelgänger-Voyante] ${target.name} est : ${target.role}`);
      game.currentNightActorHasActed = true;
      return true;
    }
    if (type === 'peekCenter') {
      if (typeof index !== 'number' || index < 0 || index >= game.centerCards.length) return false;
      if (view.centerCards[index] || Object.keys(view.peekedPlayers).length > 0) return false;
      view.centerCards[index] = true;
      view.centerRoles[index] = game.centerCards[index].role;
      const peekedIndices = view.centerCards.map((v, i) => (v ? i : -1)).filter((i) => i !== -1);
      if (peekedIndices.length >= 2) {
        const rolesSeen = peekedIndices.slice(0, 2).map((i) => view.centerRoles[i] || 'Mystère');
        io.to(socket.id).emit('privateMessage', `[Doppelgänger-Voyante] Cartes centrales : ${rolesSeen[0]} et ${rolesSeen[1]}.`);
        game.currentNightActorHasActed = true;
      } else {
        io.to(socket.id).emit('privateMessage', `[Doppelgänger-Voyante] Carte centrale ${index + 1} : ${game.centerCards[index].role}`);
      }
      return true;
    }
  }

  if (copied === 'Voleur' && type === 'swapPlayer') {
    const target = game.players.find((p) => p.name === targetName);
    if (!target || !target.alive || target.id === player.id) return false;
    [player.role, target.role] = [target.role, player.role];
    io.to(socket.id).emit('privateMessage', `[Doppelgänger-Voleur] Vous avez échangé votre rôle avec ${target.name}. Vous êtes maintenant : ${player.role}.`);
    game.logs.push(`${player.name} (Doppelgänger-Voleur) a échangé de rôle avec ${target.name}.`);
    game.currentNightActorHasActed = true;
    return true;
  }

  if (copied === 'Noiseuse' && type === 'swapPlayers') {
    const first = game.players.find((p) => p.name === targetName);
    const second = game.players.find((p) => p.name === targetName2);
    if (!first || !second || !first.alive || !second.alive) return false;
    if (first.id === player.id || second.id === player.id || first.id === second.id) return false;
    const tmp = first.role; first.role = second.role; second.role = tmp;
    io.to(socket.id).emit('privateMessage', `[Doppelgänger-Noiseuse] Vous avez échangé les rôles de ${first.name} et ${second.name}.`);
    game.logs.push(`${player.name} (Doppelgänger-Noiseuse) a échangé les rôles de ${first.name} et ${second.name}.`);
    game.currentNightActorHasActed = true;
    return true;
  }

  if (copied === 'Soûlard' && type === 'swapWithCenter') {
    if (typeof index !== 'number' || index < 0 || index >= game.centerCards.length) return false;
    const centerCard = game.centerCards[index];
    const originalRole = player.role;
    player.role = centerCard.role;
    centerCard.role = originalRole;
    io.to(socket.id).emit('privateMessage', '[Doppelgänger-Soûlard] Vous avez échangé votre rôle avec une carte du centre.');
    game.logs.push(`${player.name} (Doppelgänger-Soûlard) a échangé son rôle avec une carte du centre.`);
    game.currentNightActorHasActed = true;
    return true;
  }

  return false;
}

io.on('connection', (socket) => {
  socket.on('createGame', ({ name }) => {
    const code = makeGameCode();
    const defaultComposition = createDefaultComposition(1);
    const game = {
      code, owner: name, phase: PHASES.LOBBY,
      players: [{ id: socket.id, name, alive: true, role: null }],
      logs: [], voteResults: null, votes: {}, centerCards: [],
      personalViews: {}, composition: defaultComposition, compositionError: null,
      currentNightQueue: [], currentNightActorId: null, currentNightActorRole: null,
      currentNightActorIndex: 0, voteTimerStartAt: null, voteTimerDuration: null,
      voteTimer: null, result: null, hunterShotDone: false, pendingReveal: false,
      doppelgangerSubPhase: null, doppelgangerCopiedRole: null,
      state: createGameState([{ id: socket.id, name }]),
    };
    games[code] = game;
    socket.join(code);
    socket.emit('gameCreated', { code });
    sendGameState(game);
  });

  socket.on('joinGame', ({ code, name }) => {
    const game = games[code];
    if (!game) { socket.emit('errorMessage', 'Partie introuvable.'); return; }
    if (game.phase !== 'lobby') { socket.emit('errorMessage', 'La partie a déjà commencé.'); return; }
    if (game.players.find((p) => p.name === name)) { socket.emit('errorMessage', 'Ce nom est déjà utilisé dans la partie.'); return; }
    game.players.push({ id: socket.id, name, alive: true, role: null });
    syncGameState(game);
    socket.join(code);
    socket.emit('joinedGame', { code });
    game.logs.push(`${name} a rejoint la partie.`);
    sendGameState(game);
  });

  socket.on('startGame', ({ code, composition }) => {
    const game = games[code];
    if (!game || game.phase !== 'lobby') return;
    if (game.players.length < 4) { socket.emit('errorMessage', 'Il faut au moins 4 joueurs pour démarrer.'); return; }

    const compositionToUse = composition || game.composition || createDefaultComposition(game.players.length);
    const validation = validateComposition(compositionToUse, game.players.length);
    if (!validation.valid) {
      game.compositionError = validation.error;
      socket.emit('errorMessage', validation.error);
      sendGameState(game);
      return;
    }

    game.composition = compositionToUse;
    game.compositionError = null;
    const deck = buildRoleDeck(game.players.length, compositionToUse);
    game.players.forEach((player, index) => {
      player.role = deck[index];
      player.initialRole = deck[index];
      player.alive = true;
      player.doppelgangerCopied = null;
      io.to(player.id).emit('roleAssigned', { role: player.role });
    });
    game.centerCards = deck.slice(game.players.length, game.players.length + 3).map((role) => ({ role }));
    game.personalViews = initializePersonalViews(game);
    game.currentNightQueue = createNightQueue(game);
    game.currentNightActorIndex = 0;
    game.currentNightActorId = game.currentNightQueue[0]?.actorId || null;
    game.currentNightActorRole = game.currentNightQueue[0]?.roleName || null;
    game.phase = PHASES.READY;
    game.logs = ["La partie est prête. Chaque joueur découvre son rôle, puis l'hôte lance la nuit."];
    game.votes = {}; game.voteResults = null; game.voteTimerStartAt = null; game.voteTimerDuration = null;
    game.doppelgangerSubPhase = null; game.doppelgangerCopiedRole = null;
    game.state.roles = deck.slice();
    syncGameState(game);
    game.state.currentTurn = {
      phase: game.phase, actorId: game.currentNightActorId,
      stepIndex: game.currentNightActorIndex,
      nightOrder: game.currentNightQueue.map((e) => e.roleName),
    };

    const wolves = game.players.filter((p) => p.role === 'Loup Garou' && p.alive);
    wolves.forEach((wolf) => {
      const otherWolves = wolves.filter((p) => p.id !== wolf.id).map((p) => p.name);
      const wolfStatus = otherWolves.length === 0 ? 'alone' : 'team';
      const message = wolfStatus === 'alone'
        ? 'Vous êtes le seul loup autour du plateau, vous pouvez regarder une carte au centre.'
        : `Vous êtes plusieurs loups autour du plateau, voici vos coéquipiers : ${otherWolves.join(', ')}. De ce fait vous ne pouvez pas regarder de carte au centre`;
      io.to(wolf.id).emit('privateMessage', message);
      io.to(wolf.id).emit('wolfStatus', { status: wolfStatus, otherWolves });
    });

    sendGameState(game);
  });

  socket.on('nightAction', ({ code, type, index, targetName, targetName2 }) => {
    const game = games[code];
    if (!game || game.phase !== 'night') return;
    if (socket.id !== game.currentNightActorId) return;
    if (game.currentNightActorHasActed) return;
    const player = game.players.find((p) => p.id === socket.id);
    if (!player || !player.alive) return;
    const view = game.personalViews[socket.id];
    if (!view) return;

    const actingRole = player.initialRole || player.role;

    // ── Doppelgänger own turn ──
    if (actingRole === 'Doppelgänger' && game.currentNightActorRole === 'Doppelgänger') {

      // Sub-phase: waiting for immediate action (Voyante / Voleur / Noiseuse / Soûlard)
      if (game.doppelgangerSubPhase === 'action') {
        const handled = handleDoppelgangerSubAction(game, socket, player, type, targetName, targetName2, index);
        if (handled) {
          game.doppelgangerSubPhase = null;
          syncGameState(game);
          sendGameState(game);
        }
        return;
      }

      // Step 1: pick a player to copy
      if (type === 'doppelPick' && !player.doppelgangerCopied) {
        const target = game.players.find((p) => p.name === targetName);
        if (!target || target.id === socket.id || !target.alive) return;
        const copiedRole = target.initialRole || target.role;
        player.doppelgangerCopied = copiedRole;
        game.doppelgangerCopiedRole = copiedRole;

        io.to(socket.id).emit('privateMessage',
          `Vous avez regardé la carte de ${target.name} : ${copiedRole}. Vous êtes maintenant Doppelgänger-${copiedRole}.`
        );
        io.to(socket.id).emit('doppelgangerCopied', { copiedRole, targetName: target.name });

        if (DOPPELGANGER_IMMEDIATE_ROLES.includes(copiedRole)) {
          // Stay on this turn, wait for sub-action
          game.doppelgangerSubPhase = 'action';
          syncGameState(game);
          sendGameState(game);
          return;
        }

        if (copiedRole === 'Sbire') {
          // Show wolf auras, mark acted so timer auto-advances
          game.doppelgangerSubPhase = 'sbire';
          game.currentNightActorHasActed = true;
          syncGameState(game);
          sendGameState(game);
          return;
        }

        // Passive roles (Loup Garou, Franc-Maçon, Insomniaque, Villageois, Chasseur, Tanneur)
        game.doppelgangerSubPhase = null;
        game.currentNightActorHasActed = true;
        syncGameState(game);
        sendGameState(game);
        return;
      }
      return;
    }

    // ── Doppelgänger-Insomniaque late check ──
    if (actingRole === 'Doppelgänger' && game.currentNightActorRole === 'Doppelgänger-Insomniaque') {
      if (type === 'lookSelf') {
        view.selfPeek = true;
        io.to(socket.id).emit('privateMessage', `[Doppelgänger-Insomniaque] Ton rôle actuel est : ${player.role}.`);
        game.currentNightActorHasActed = true;
        syncGameState(game);
        sendGameState(game);
      }
      return;
    }

    // ── Regular role actions ──
    if ((player.initialRole || player.role) === 'Loup Garou' && type === 'peekCenter') {
      if (typeof index !== 'number' || index < 0 || index >= game.centerCards.length) return;
      view.centerCards[index] = true;
      view.centerRoles[index] = game.centerCards[index].role;
      io.to(socket.id).emit('privateMessage', `Carte centrale ${index + 1} : ${game.centerCards[index].role}`);
      syncGameState(game); sendGameState(game);
    } else if ((player.initialRole || player.role) === 'Noiseuse' && type === 'swapPlayers') {
      const firstTarget = game.players.find((p) => p.name === targetName);
      const secondTarget = game.players.find((p) => p.name === targetName2);
      if (!firstTarget || !secondTarget || !firstTarget.alive || !secondTarget.alive) return;
      if (firstTarget.id === player.id || secondTarget.id === player.id || firstTarget.id === secondTarget.id) return;
      const tmp = firstTarget.role; firstTarget.role = secondTarget.role; secondTarget.role = tmp;
      io.to(socket.id).emit('privateMessage', `Vous avez échangé les rôles de ${firstTarget.name} et ${secondTarget.name}.`);
      game.logs.push(`${player.name} a échangé les rôles de ${firstTarget.name} et ${secondTarget.name}.`);
      syncGameState(game); sendGameState(game);
    } else if ((player.initialRole || player.role) === 'Voleur' && type === 'swapPlayer') {
      const target = game.players.find((p) => p.name === targetName);
      if (!target || !target.alive || target.id === player.id) return;
      [player.role, target.role] = [target.role, player.role];
      io.to(socket.id).emit('privateMessage', `Vous avez volé ${target.name}. Vous êtes maintenant devenu ${player.role}`);
      game.logs.push(`${player.name} a échangé de rôle avec ${target.name}.`);
      syncGameState(game); sendGameState(game);
    } else if ((player.initialRole || player.role) === 'Soûlard' && type === 'swapWithCenter') {
      if (typeof index !== 'number' || index < 0 || index >= game.centerCards.length) return;
      const centerCard = game.centerCards[index];
      const originalRole = player.role; player.role = centerCard.role; centerCard.role = originalRole;
      io.to(socket.id).emit('privateMessage', 'Vous avez décidé de prendre la carte du centre et incarner ce nouveau rôle à présent');
      game.logs.push(`${player.name} a échangé son rôle avec une carte du centre.`);
      syncGameState(game); sendGameState(game);
    } else if ((player.initialRole || player.role) === 'Insomniaque' && type === 'lookSelf') {
      view.selfPeek = true;
      io.to(socket.id).emit('privateMessage', `Ton rôle est ${player.role}.`);
      syncGameState(game); sendGameState(game);
    } else if ((player.initialRole || player.role) === 'Voyante' && type === 'peekPlayer') {
      const target = game.players.find((p) => p.name === targetName);
      if (!target || target.id === socket.id || !target.alive) return;
      view.peekedPlayers[target.name] = target.role;
      io.to(socket.id).emit('privateMessage', `${target.name} est : ${target.role}`);
      game.currentNightActorHasActed = true;
      syncGameState(game); sendGameState(game); return;
    } else if ((player.initialRole || player.role) === 'Voyante' && type === 'peekCenter') {
      if (typeof index !== 'number' || index < 0 || index >= game.centerCards.length) return;
      if (Object.keys(view.peekedPlayers).length > 0 || view.centerCards[index]) return;
      view.centerCards[index] = true;
      view.centerRoles[index] = game.centerCards[index].role;
      const peekedIndices = view.centerCards.map((v, i) => (v ? i : -1)).filter((i) => i !== -1);
      if (peekedIndices.length >= 2) {
        const rolesSeen = peekedIndices.slice(0, 2).map((i) => view.centerRoles[i] || 'Mystère');
        io.to(socket.id).emit('privateMessage', `Vous avez vu les rôles ${rolesSeen[0]} et ${rolesSeen[1]} au centre.`);
        game.currentNightActorHasActed = true;
      } else {
        io.to(socket.id).emit('privateMessage', `Carte centrale ${index + 1} : ${game.centerCards[index].role}`);
      }
      syncGameState(game); sendGameState(game); return;
    } else {
      io.to(socket.id).emit('privateMessage', 'Action invalide.'); return;
    }
    game.currentNightActorHasActed = true;
  });

  socket.on('beginNight', ({ code }) => {
    const game = games[code];
    if (!game || game.phase !== PHASES.READY) return;
    if (socket.id !== game.players.find((p) => p.name === game.owner)?.id) return;
    game.phase = PHASES.NIGHT;
    game.logs.push('La nuit commence...');
    game.currentNightQueue = game.currentNightQueue.length ? game.currentNightQueue : createNightQueue(game);
    game.currentNightActorIndex = 0;
    game.currentNightActorId = game.currentNightQueue[0]?.actorId || null;
    game.currentNightActorRole = game.currentNightQueue[0]?.roleName || null;
    syncGameState(game);
    sendGameState(game);
    sendNightTurn(game);
    scheduleNextNightTurn(game);
  });

  socket.on('updateComposition', ({ code, composition }) => {
    const game = games[code];
    if (!game || game.phase !== 'lobby') return;
    const owner = game.players.find((p) => p.name === game.owner);
    if (socket.id !== owner?.id) return;
    const normalizedComposition = normalizeComposition(composition);
    const validation = validateComposition(normalizedComposition, game.players.length);
    game.composition = normalizedComposition;
    game.compositionError = validation.valid ? null : validation.error;
    sendGameState(game);
  });

  socket.on('castVote', ({ code, target }) => {
    const game = games[code];
    if (!game || (game.phase !== PHASES.DAY && game.phase !== PHASES.VOTE)) return;
    if (game.pendingReveal) return; // Chasseur en train de choisir sa cible
    const player = game.players.find((p) => p.id === socket.id);
    if (!player) return;
    if (target !== 'center' && target !== 'centre') {
      if (!game.players.find((p) => p.name === target)) return;
    }
    game.votes[player.id] = target;
    const voteCounts = {};
    Object.values(game.votes).forEach((name) => { voteCounts[name] = (voteCounts[name] || 0) + 1; });
    game.voteResults = voteCounts;
    if (game.phase === PHASES.DAY) {
      game.phase = PHASES.VOTE;
      game.voteTimerStartAt = Date.now();
      game.voteTimerDuration = 5 * 60 * 1000;
      game.logs.push('Le vote commence. Choisis un joueur.');
      scheduleVoteEnd(game);
    }
    syncGameState(game); sendGameState(game);
  });

  // ── Ajustement du timer de vote par l'hôte ──
  socket.on('adjustVoteTimer', ({ code, deltaSec }) => {
    const game = games[code];
    if (!game || game.phase !== PHASES.VOTE) return;
    const owner = game.players.find((p) => p.name === game.owner);
    if (socket.id !== owner?.id) return;
    const now = Date.now();
    const currentEnd = game.voteTimerStartAt + game.voteTimerDuration;
    // Minimum 5 secondes restantes
    const newEnd = Math.max(now + 5000, currentEnd + deltaSec * 1000);
    game.voteTimerDuration = newEnd - game.voteTimerStartAt;
    scheduleVoteEnd(game);
    sendGameState(game);
  });

  socket.on('hunterShot', ({ code, target }) => {
    const game = games[code];
    if (!game || !game.pendingReveal) return;
    const player = game.players.find((p) => p.id === socket.id);
    if (!player) return;
    const isHunter = player.initialRole === 'Chasseur' ||
      (player.initialRole === 'Doppelgänger' && player.doppelgangerCopied === 'Chasseur');
    if (!isHunter) return;
    const targetPlayer = game.players.find((p) => p.name === target);
    if (!targetPlayer || targetPlayer.id === socket.id) {
      socket.emit('errorMessage', 'Cible invalide. Tu ne peux pas viser le centre ni toi-même.'); return;
    }
    game.hunterShotDone = true; game.pendingReveal = false;
    game.logs.push(`${player.name} (Chasseur) tire sur ${targetPlayer.name} !`);
    const shotIsWolf = targetPlayer.initialRole === 'Loup Garou' ||
      (targetPlayer.initialRole === 'Doppelgänger' && targetPlayer.doppelgangerCopied === 'Loup Garou');
    const shotIsTanner = targetPlayer.initialRole === 'Tanneur' ||
      (targetPlayer.initialRole === 'Doppelgänger' && targetPlayer.doppelgangerCopied === 'Tanneur');
    if (shotIsTanner) {
      game.result = game.result === 'village' ? 'village' : 'tanner';
      game.logs.push(game.result === 'village'
        ? `${targetPlayer.name} était le Tanneur. Il gagne aussi ! L'équipe du village gagne !`
        : `${targetPlayer.name} était le Tanneur. Seul le Tanneur gagne !`);
    } else if (shotIsWolf) {
      game.result = 'village';
      game.logs.push(`${targetPlayer.name} était un Loup-garou. Le village gagne !`);
    } else {
      game.result = 'wolves';
      game.logs.push(`${targetPlayer.name} n'était pas un Loup-garou. Les loups gagnent !`);
    }
    io.to(socket.id).emit('hunterShotResolved');
    game.phase = PHASES.REVEAL;
    syncGameState(game); sendGameState(game);
  });

  socket.on('restartGame', ({ code }) => {
    const game = games[code];
    if (!game || game.phase !== PHASES.REVEAL) return;
    const owner = game.players.find((p) => p.name === game.owner);
    if (socket.id !== owner?.id) return;

    // Réinitialiser les rôles avec la composition existante
    const compositionToUse = game.composition || createDefaultComposition(game.players.length);
    const validation = validateComposition(compositionToUse, game.players.length);
    if (!validation.valid) {
      socket.emit('errorMessage', 'Composition invalide : ' + validation.error);
      return;
    }
    const deck = buildRoleDeckFromComposition(compositionToUse);
    
    // Réassigner les rôles aux joueurs
    game.players.forEach((player, index) => {
      player.role = deck[index];
      player.initialRole = deck[index];
      player.alive = true;
      player.doppelgangerCopied = null;
      io.to(player.id).emit('roleAssigned', { role: player.role });
    });
    
    // Réinitialiser les cartes du centre
    game.centerCards = deck.slice(game.players.length, game.players.length + 3).map((role) => ({ role }));
    game.personalViews = initializePersonalViews(game);
    
    // Réinitialiser la queue de nuit
    game.currentNightQueue = createNightQueue(game);
    game.currentNightActorIndex = 0;
    game.currentNightActorId = game.currentNightQueue[0]?.actorId || null;
    game.currentNightActorRole = game.currentNightQueue[0]?.roleName || null;
    
    // Réinitialiser la phase et les logs
    game.phase = PHASES.READY;
    game.logs = ["Nouvelle partie ! Chaque joueur découvre son rôle, puis l'hôte lance la nuit."];
    
    // Réinitialiser les votes et les timers
    clearVoteTimer(game);
    clearNightTimer(game);
    game.votes = {};
    game.voteResults = null;
    game.voteTimerStartAt = null;
    game.voteTimerDuration = null;
    
    // Réinitialiser le Doppelgänger
    game.doppelgangerSubPhase = null; 
    game.doppelgangerCopiedRole = null;
    
    // Réinitialiser le résultat et le chasseur
    game.result = null;
    game.hunterShotDone = false;
    game.pendingReveal = false;
    
    // CRÉER UN NOUVEL OBJET STATE COMPLÈTEMENT NOUVEAU
    game.state = {
      roles: deck.slice(),
      positions: {
        players: game.players.map((player, index) => ({
          playerId: player.id,
          name: player.name,
          role: player.role,
          position: index,
        })),
        center: game.centerCards.map((card, index) => ({
          position: index,
          role: card.role,
        })),
      },
      currentTurn: {
        phase: game.phase,
        actorId: game.currentNightActorId,
        stepIndex: game.currentNightActorIndex,
        nightOrder: game.currentNightQueue.map((e) => e.roleName),
      },
    };

    const wolves = game.players.filter((p) => p.role === 'Loup Garou' && p.alive);
    wolves.forEach((wolf) => {
      const otherWolves = wolves.filter((p) => p.id !== wolf.id).map((p) => p.name);
      const wolfStatus = otherWolves.length === 0 ? 'alone' : 'team';
      const message = wolfStatus === 'alone'
        ? 'Vous êtes le seul loup autour du plateau, vous pouvez regarder une carte au centre.'
        : `Vous êtes plusieurs loups autour du plateau, voici vos coéquipiers : ${otherWolves.join(', ')}. De ce fait vous ne pouvez pas regarder de carte au centre`;
      io.to(wolf.id).emit('privateMessage', message);
      io.to(wolf.id).emit('wolfStatus', { status: wolfStatus, otherWolves });
    });

    sendGameState(game);
  });

  socket.on('disconnect', () => {
    Object.values(games).forEach((game) => {
      const index = game.players.findIndex((p) => p.id === socket.id);
      if (index === -1) return;
      const left = game.players.splice(index, 1)[0];
      delete game.personalViews[left.id];
      if ((game.phase === PHASES.NIGHT || game.phase === PHASES.READY) && Array.isArray(game.currentNightQueue)) {
        const queueIndex = game.currentNightQueue.findIndex((e) => e.actorId === left.id);
        if (queueIndex !== -1) {
          const wasActive = queueIndex === game.currentNightActorIndex;
          game.currentNightQueue = game.currentNightQueue.filter((e) => e.actorId !== left.id);
          if (queueIndex < game.currentNightActorIndex) game.currentNightActorIndex -= 1;
          if (wasActive && game.phase === PHASES.NIGHT) {
            clearNightTimer(game);
            if (game.currentNightActorIndex >= game.currentNightQueue.length) {
              game.phase = PHASES.VOTE; game.currentNightActorId = null; game.currentNightActorRole = null;
              game.voteTimerStartAt = Date.now(); game.voteTimerDuration = 5 * 60 * 1000;
              game.votes = {}; game.voteResults = null;
              game.logs.push('La nuit est terminée. Le vote commence.');
              syncGameState(game); sendGameState(game); scheduleVoteEnd(game);
            } else {
              const next = game.currentNightQueue[game.currentNightActorIndex];
              game.currentNightActorId = next.actorId; game.currentNightActorRole = next.roleName;
              game.currentNightActorHasActed = false;
              syncGameState(game); sendGameState(game); sendNightTurn(game); scheduleNextNightTurn(game);
            }
            io.to(game.code).emit('systemMessage', `${left.name} a quitté pendant la nuit, son tour est passé.`);
            return;
          }
        }
      }
      io.to(game.code).emit('systemMessage', `${left.name} a quitté la partie.`);
      if (game.players.length === 0) { clearNightTimer(game); delete games[game.code]; }
      else { if (game.owner === left.name) game.owner = game.players[0].name; sendGameState(game); }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Werewolf Night server running on http://localhost:${PORT}`);
});
