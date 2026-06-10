const socket = io();

const nameInput = document.getElementById('nameInput');
const gameCodeInput = document.getElementById('gameCodeInput');
const createButton = document.getElementById('createButton');
const joinButton = document.getElementById('joinButton');
const lobbySection = document.getElementById('lobby-section');
const joinSection = document.getElementById('join-section');
const gameSection = document.getElementById('game-section');
const gameCodeLabel = document.getElementById('gameCodeLabel');
const playerList = document.getElementById('playerList');
const startButton = document.getElementById('startButton');
const roleLabel = document.getElementById('roleLabel');
const phaseLabel = document.getElementById('phaseLabel');
const actorLabel = document.getElementById('actorLabel');
const actionSection = document.getElementById('actionSection');
const voteSection = document.getElementById('voteSection');
const logList = document.getElementById('logList');
const statusMessage = document.getElementById('statusMessage');
const timerLabel = document.getElementById('timerLabel');
const timerBar = document.getElementById('timerBar');
const timerFill = document.getElementById('timerFill');
const roleRules = document.getElementById('roleRules');
const playerBoard = document.getElementById('playerBoard');
const centerCardsContainer = document.getElementById('centerCards');
const toggleCompositionButton = document.getElementById('toggleCompositionButton');
const compositionPanel = document.getElementById('compositionPanel');
const closeCompositionButton = document.getElementById('closeCompositionButton');

let currentGameCode = null;
let myRole = null;
let myId = null;
let publicGameState = null;
let privateState = null;
let currentPlayerName = null;
let canAct = false;
let selectedPlayerName = null;
let nightInterval = null;
let nightEndAt = null;

createButton.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return alert('Entre ton pseudo.');
  socket.emit('createGame', { name });
});

joinButton.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const code = gameCodeInput.value.trim().toUpperCase();
  if (!name || !code) return alert('Entre ton pseudo et le code de la partie.');
  socket.emit('joinGame', { name, code });
});

startButton.addEventListener('click', () => {
  if (!currentGameCode) return;
  socket.emit('startGame', { code: currentGameCode });
});

toggleCompositionButton.addEventListener('click', () => {
  compositionPanel.classList.toggle('hidden');
});

closeCompositionButton.addEventListener('click', () => {
  compositionPanel.classList.add('hidden');
});

function showLobby(game) {
  currentGameCode = game.code;
  gameCodeLabel.textContent = game.code;
  joinSection.classList.add('hidden');
  lobbySection.classList.remove('hidden');
  gameSection.classList.add('hidden');
  playerList.innerHTML = '';
  game.players.forEach((player) => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.textContent = `${player.name}`;
    playerList.appendChild(card);
  });
  // enable start button for the host (use persisted currentPlayerName when available)
  const localName = currentPlayerName || nameInput.value.trim();
  if (game.owner === localName) {
    startButton.disabled = false;
  } else {
    startButton.disabled = true;
  }
}

function renderGame(game) {
  publicGameState = game;
  if (!game) return;
  lobbySection.classList.add('hidden');
  joinSection.classList.add('hidden');
  gameSection.classList.remove('hidden');
  roleLabel.textContent = myRole || '...';
  phaseLabel.textContent = game.phase;
  actorLabel.textContent = game.currentActorName ? `Joueur actif : ${game.currentActorName}` : '';
  actionSection.innerHTML = '';
  voteSection.innerHTML = '';
  voteSection.classList.add('hidden');
  statusMessage.textContent = '';
  logList.innerHTML = '';

  game.logs.forEach((message) => {
    const item = document.createElement('li');
    item.textContent = message;
    logList.appendChild(item);
  });

  renderBoard(game);
  renderRoleDescription();
  renderActionPanel(game);
  if (game.phase === 'day' || game.phase === 'vote') {
    renderVoteSection(game.players.filter((p) => p.alive));
  }
  if (game.phase === 'reveal') {
    renderRevealInfo();
  }
}

function renderBoard(game) {
  playerBoard.innerHTML = '';
  centerCardsContainer.innerHTML = '';

  const slots = ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5', 'slot-6', 'slot-7'];
  game.players.forEach((player, index) => {
    const slot = document.createElement('div');
    slot.className = `player-slot ${slots[index % slots.length]}`;
    const card = document.createElement('div');
    const isMe = player.id === myId;
    let displayRole = '???';
    if (isMe) {
      displayRole = myRole;
    } else if (game.phase === 'reveal' && player.role) {
      displayRole = player.role;
    } else if (privateState && privateState.peekedPlayers[player.id]) {
      displayRole = privateState.peekedPlayers[player.id];
    }
    const faceUp = isMe || game.phase === 'reveal' || (privateState && privateState.peekedPlayers[player.id]);
    card.className = `player-card-inner ${faceUp ? 'face-up' : 'face-down'}`;
    card.textContent = displayRole;
    if (isMe && privateState && privateState.selfPeek) {
      card.textContent = myRole;
      card.classList.add('face-up');
    }
    if (game.phase === 'night' && canAct && myRole === 'Voleur' && player.id !== myId) {
      card.classList.add('clickable');
      card.addEventListener('click', () => {
        const targetName = player.name;
        card.classList.add('swap-animate');
        setTimeout(() => card.classList.remove('swap-animate'), 700);
        socket.emit('nightAction', { code: currentGameCode, type: 'swapPlayer', targetName });
        statusMessage.textContent = `Échange demandé avec ${targetName}.`;
      });
    }
    if (game.phase === 'night' && canAct && myRole === 'Noiseuse' && player.id !== myId) {
      card.classList.add('clickable');
      if (selectedPlayerName === player.name) {
        card.classList.add('selected');
      }
      card.addEventListener('click', () => {
        const targetName = player.name;
        if (!selectedPlayerName) {
          selectedPlayerName = targetName;
          statusMessage.textContent = `Premier joueur sélectionné : ${targetName}. Clique un second joueur pour échanger leurs rôles.`;
          card.classList.add('selected');
          return;
        }
        if (selectedPlayerName === targetName) {
          selectedPlayerName = null;
          statusMessage.textContent = 'Sélection annulée.';
          card.classList.remove('selected');
          return;
        }
        const firstTarget = selectedPlayerName;
        const secondTarget = targetName;
        socket.emit('nightAction', {
          code: currentGameCode,
          type: 'swapPlayers',
          targetName: firstTarget,
          targetName2: secondTarget,
        });
        statusMessage.textContent = `Échange demandé entre ${firstTarget} et ${secondTarget}.`;
        selectedPlayerName = null;
      });
    }
    if (game.phase === 'night' && myRole === 'Insomniaque' && isMe && canAct) {
      card.classList.add('clickable');
      card.addEventListener('click', () => {
        socket.emit('nightAction', { code: currentGameCode, type: 'lookSelf' });
        statusMessage.textContent = 'Tu regardes ta propre carte.';
      });
    }
    const nameLabel = document.createElement('div');
    nameLabel.className = 'player-name';
    nameLabel.textContent = player.name;
    slot.appendChild(card);
    slot.appendChild(nameLabel);
    playerBoard.appendChild(slot);
  });

  const centerCount = game.centerCount || 3;
  for (let i = 0; i < centerCount; i += 1) {
    const card = document.createElement('div');
    card.className = 'center-card face-down';
    card.textContent = 'Centre';
    if (privateState) {
      const centerInfo = privateState.centerCards[i];
      if (centerInfo && centerInfo.revealed) {
        card.className = 'center-card face-up';
        card.textContent = centerInfo.role;
      }
      if (game.phase === 'night' && canAct && myRole === 'Loup Garou') {
        card.classList.add('clickable');
        card.addEventListener('click', () => {
          card.classList.add('flip');
          setTimeout(() => card.classList.remove('flip'), 800);
          socket.emit('nightAction', { code: currentGameCode, type: 'peekCenter', index: i });
          statusMessage.textContent = `Regarde la carte centrale ${i + 1}.`;
        });
      }
    }
    if (game.phase === 'reveal') {
      card.className = 'center-card face-up';
      const centerPublic = game.centerCards?.[i];
      if (centerPublic && centerPublic.role) {
        card.textContent = centerPublic.role;
      } else if (privateState && privateState.centerCards[i] && privateState.centerCards[i].role) {
        card.textContent = privateState.centerCards[i].role;
      } else {
        card.textContent = 'Révélée';
      }
    }
    centerCardsContainer.appendChild(card);
  }
}

function renderRoleDescription() {
  if (!privateState) {
    roleRules.classList.add('hidden');
    return;
  }
  roleRules.classList.remove('hidden');
  roleRules.innerHTML = `
    <h3>Ton rôle</h3>
    <p><strong>${myRole}</strong></p>
    <p>${privateState.rolePower.description}</p>
    <p><em>${privateState.rolePower.power}</em></p>
  `;
}

function renderActionPanel(game) {
  actionSection.innerHTML = '<h3>Action de nuit</h3>';
  if (game.phase !== 'night') {
    actionSection.innerHTML = '<p>Aucune action de nuit pour le moment.</p>';
    return;
  }
  if (!privateState) {
    actionSection.innerHTML += '<p>Chargement...</p>';
    return;
  }
  if (!canAct) {
    actionSection.innerHTML += `<p>Attends ton tour. Joueur actif : ${game.currentActorName}.</p>`;
    return;
  }
  const detail = document.createElement('p');
  if (myRole === 'Loup Garou') {
    detail.textContent = 'Clique sur une carte centrale pour la regarder.';
  } else if (myRole === 'Noiseuse') {
    detail.textContent = 'Sélectionne deux joueurs pour échanger leurs rôles.';
  } else if (myRole === 'Voleur') {
    detail.textContent = 'Clique sur un joueur pour échanger ton rôle.';
  } else if (myRole === 'Insomniaque') {
    detail.textContent = 'Clique sur ta carte pour la regarder.';
  } else {
    detail.textContent = 'Tu n’as pas d’action spéciale la nuit.';
  }
  actionSection.appendChild(detail);
}

function renderVoteSection(alivePlayers) {
  voteSection.classList.remove('hidden');
  voteSection.innerHTML = '<h3>Vote</h3><p>Choisis un joueur pour le vote final.</p>';
  alivePlayers.forEach((player) => {
    if (player.id === myId) return;
    const button = document.createElement('button');
    button.textContent = player.name;
    button.addEventListener('click', () => {
      socket.emit('castVote', { code: currentGameCode, target: player.name });
      statusMessage.textContent = `Vote envoyé pour ${player.name}.`;
    });
    voteSection.appendChild(button);
  });
}

function renderRevealInfo() {
  const reveal = document.createElement('p');
  reveal.textContent = 'Tous les rôles sont maintenant visibles. Termine la discussion.';
  actionSection.prepend(reveal);
}

socket.on('gameCreated', ({ code }) => {
  currentGameCode = code;
  gameCodeLabel.textContent = code;
  lobbySection.classList.remove('hidden');
  joinSection.classList.add('hidden');
  statusMessage.textContent = `Partie créée : ${code}`;
});

socket.on('joinedGame', ({ code }) => {
  currentGameCode = code;
  lobbySection.classList.remove('hidden');
  joinSection.classList.add('hidden');
  statusMessage.textContent = `Rejoint la partie ${code}`;
});

socket.on('gameState', (game) => {
  // Debug info to help diagnose host/name mismatches
  // re-expose name for quick console checks
  if (currentPlayerName) window.__APP_NAME__ = currentPlayerName;
  // clear any running night interval if phase changed
  if (game.phase !== 'night' && nightInterval) {
    clearInterval(nightInterval);
    nightInterval = null;
    nightEndAt = null;
    selectedPlayerName = null;
    statusMessage.textContent = '';
    actorLabel.textContent = game.currentActorName ? `Joueur actif : ${game.currentActorName}` : '';
    if (timerLabel) timerLabel.textContent = '';
    if (timerBar) timerBar.classList.add('hidden');
    if (timerFill) timerFill.style.width = '0%';
  }
  if (game.phase !== 'night') {
    selectedPlayerName = null;
  }
  renderGame(game);
});

socket.on('privateState', (data) => {
  myId = data.myId;
  myRole = data.role;
  privateState = data;
  canAct = data.canAct;
  if (currentPlayerName) window.__APP_NAME__ = currentPlayerName;
  if (publicGameState) {
    renderGame(publicGameState);
  }
});

socket.on('nightTurn', ({ actorId, roleName, duration, startedAt }) => {
  selectedPlayerName = null;
  // show role name and start countdown (duration in ms)
  // ensure the game section is visible
  if (gameSection) gameSection.classList.remove('hidden');
  if (roleName) {
    actorLabel.textContent = `Au tour du ${roleName}`;
    if (timerLabel) timerLabel.textContent = `Tu as ${Math.ceil((duration || 30000) / 1000)}s pour agir.`;
    if (timerBar) timerBar.classList.remove('hidden');
  } else {
    actorLabel.textContent = '';
    if (timerLabel) timerLabel.textContent = '';
    if (timerBar) timerBar.classList.add('hidden');
  }

  // also append to the journal so the turn is always visible
  try {
    const entry = document.createElement('li');
    const who = actorId ? (publicGameState?.players?.find(p => p.id === actorId)?.name || 'Joueur') : 'Carte centrale';
    entry.textContent = `Tour: ${roleName} (${who}) — ${Math.ceil((duration || 30000) / 1000)}s`;
    logList.prepend(entry);
    statusMessage.textContent = `Au tour du ${roleName} — ${Math.ceil((duration || 30000) / 1000)}s`;
  } catch (e) { }

  // compute end time based on server timestamp
  const now = Date.now();
  const start = startedAt || now;
  nightEndAt = start + (duration || 30000);
  if (nightInterval) clearInterval(nightInterval);
  nightInterval = setInterval(() => {
    const remain = Math.max(0, Math.ceil((nightEndAt - Date.now()) / 1000));
    statusMessage.textContent = `Temps restant : ${remain}s`;
    if (timerLabel) timerLabel.textContent = `Au tour du ${roleName} — ${remain}s restantes`;
    if (timerFill) {
      const totalSeconds = Math.max(1, Math.ceil((duration || 30000) / 1000));
      const fillPercent = Math.max(0, Math.min(100, (remain / totalSeconds) * 100));
      timerFill.style.width = `${fillPercent}%`;
    }
    if (Date.now() >= nightEndAt) {
      clearInterval(nightInterval);
      nightInterval = null;
      statusMessage.textContent = '';
      if (timerLabel) timerLabel.textContent = '';
      if (timerBar) timerBar.classList.add('hidden');
      if (timerFill) timerFill.style.width = '0%';
    }
  }, 250);
});

socket.on('roleAssigned', ({ role }) => {
  myRole = role;
  roleLabel.textContent = role;
  statusMessage.textContent = `Ton rôle est ${role}.`;
});

socket.on('systemMessage', (message) => {
  const item = document.createElement('li');
  item.textContent = message;
  logList.appendChild(item);
});

socket.on('privateMessage', (message) => {
  const item = document.createElement('li');
  item.textContent = `Message privé : ${message}`;
  logList.appendChild(item);
});

socket.on('errorMessage', (message) => {
  alert(message);
});
