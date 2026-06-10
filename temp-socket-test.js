const { io } = require('socket.io-client');
const names = ['A', 'B', 'C', 'D'];
const gameState = { code: null };
let joinedCount = 0;
const sockets = [];

function connectClient(name, isHost = false) {
  const socket = io('http://localhost:3001', { autoConnect: false });
  socket.on('connect', () => {
    console.log(`${name} connected ${socket.id}`);
    if (isHost) {
      socket.emit('createGame', { name });
    }
  });
  socket.on('gameCreated', ({ code }) => {
    console.log(`${name} gameCreated ${code}`);
    gameState.code = code;
    if (name === 'A') {
      // other players join once code exists
      ['B', 'C', 'D'].forEach((playerName, idx) => {
        setTimeout(() => {
          sockets[idx + 1].emit('joinGame', { name: playerName, code });
        }, 200 * (idx + 1));
      });
    }
  });
  socket.on('joinedGame', ({ code }) => {
    console.log(`${name} joined ${code}`);
    joinedCount += 1;
    if (joinedCount === names.length - 1) {
      console.log('All joined. host starts game');
      sockets[0].emit('startGame', { code });
    }
  });
  socket.on('gameState', (state) => {
    console.log(`${name} gameState phase=${state.phase} players=${state.players.length} currentActor=${state.currentActorName}`);
    if (name === 'A' && state.phase === 'ready') {
      const roles = state.players.map((p) => `${p.name}:${p.role ?? '??'}`);
      console.log(`Ready roles: ${roles.join(', ')}`);
      setTimeout(() => {
        console.log('Host begins night');
        socket.emit('beginNight', { code: state.code });
      }, 500);
    }
    if (state.phase === 'night') {
      const names = state.players.map((p) => p.name);
      console.log(`Night players: ${names.join(', ')}`);
    }
  });
  socket.on('privateState', (state) => {
    console.log(`${name} privateState role=${state.role} canAct=${state.canAct}`);
  });
  socket.on('nightTurn', (turn) => {
    console.log(`${name} nightTurn actorId=${turn.actorId} roleName=${turn.roleName}`);
  });
  socket.on('errorMessage', (msg) => console.log(`${name} errorMessage ${msg}`));
  socket.on('disconnect', (reason) => console.log(`${name} disconnected ${reason}`));
  socket.open();
  return socket;
}

for (let i = 0; i < names.length; i += 1) {
  sockets.push(connectClient(names[i], i === 0));
}

setTimeout(() => {
  console.log('closing');
  sockets.forEach((s) => s.disconnect());
  process.exit(0);
}, 90000);
