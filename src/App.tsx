import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import GameLayout from './components/GameLayout';
import Lobby from './components/Lobby';

interface Player {
  id: string;
  name: string;
  alive: boolean;
  role?: string;
}

interface Composition {
  [key: string]: number;
}

interface GameState {
  code: string;
  phase: string;
  players: Player[];
  owner: string;
  logs: string[];
  voteResults: Record<string, number> | null;
  voteMapping?: Record<string, string> | null;
  centerCount: number;
  centerCards: Array<{ index: number; role?: string }>;
  currentActorName: string | null;
  voteTimer?: { duration: number; startedAt: number } | null;
  composition?: Composition;
  compositionError?: string | null;
  hunterShotPending?: boolean;
  state?: {
    roles: string[];
    positions?: {
      players: Array<{ playerId: string; name: string; role?: string; position: number }>;
      center: Array<{ position: number; role: string }>;
    };
    currentTurn?: {
      nightOrder: string[];
      stepIndex: number;
    };
  };
}

interface PrivateState {
  myId: string;
  role: string;
  initialRole: string;
  doppelgangerCopied?: string | null;
  rolePower: {
    description: string;
    power: string;
  };
  canAct: boolean;
  currentActorName: string | null;
  centerCards: Array<{ index: number; revealed: boolean; role?: string }>;
  peekedPlayers: Record<string, string>;
  selfPeek: boolean;
  minionWolves?: string[];
  masonAlly?: string | null;
  // Doppelgänger
  doppelgangerTurn?: boolean;
  doppelgangerSubPhase?: string | null;
  doppelgangerWolfIds?: string[];
  wolfPackIds?: string[];
  wolfPackSize?: number;
  canPeekCenter?: boolean;
}

export default function App() {
  const socket = useMemo(() => io({ transports: ['polling', 'websocket'] }), []);
  const [page, setPage] = useState<'lobby' | 'game'>('lobby');
  const [name, setName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivateState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isCompositionOpen, setIsCompositionOpen] = useState(true);
  const [compositionSettings, setCompositionSettings] = useState<Composition>({
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
  });
  const [compositionError, setCompositionError] = useState<string | null>(null);
  const [nightTurn, setNightTurn] = useState<null | { actorId: string | null; roleName: string | null; duration: number; startedAt: number }>(null);
  const [voteTimer, setVoteTimer] = useState<null | { duration: number; startedAt: number }>(null);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [voteMapping, setVoteMapping] = useState<null | Record<string, string>>(null);
  const [voteResults, setVoteResults] = useState<null | Record<string, number>>(null);
  const [privateMessage, setPrivateMessage] = useState<string | null>(null);
  const [hunterAnnouncement, setHunterAnnouncement] = useState<string | null>(null);
  const [wolfStatus, setWolfStatus] = useState<'alone' | 'team' | null>(null);
  const [otherWolves, setOtherWolves] = useState<string[]>([]);
  const [hunterShotPending, setHunterShotPending] = useState<boolean>(false);
  // true uniquement pour le joueur qui EST le chasseur et doit tirer
  const [isHunterShooter, setIsHunterShooter] = useState<boolean>(false);
  const [minionWolves, setMinionWolves] = useState<string[]>([]);
  const [masonAlly, setMasonAlly] = useState<string | null>(null);
  // Doppelgänger state
  const [doppelgangerCopied, setDoppelgangerCopied] = useState<string | null>(null);
  const [doppelgangerSubPhase, setDoppelgangerSubPhase] = useState<string | null>(null);
  const [wolfPackIds, setWolfPackIds] = useState<string[]>([]);
  const [doppelgangerWolfIds, setDoppelgangerWolfIds] = useState<string[]>([]);
  const [canPeekCenter, setCanPeekCenter] = useState<boolean>(false);

  useEffect(() => {
    socket.on('gameCreated', ({ code }: { code: string }) => {
      setGameCode(code);
      setIsHost(true);
      setPage('lobby');
    });

    socket.on('joinedGame', ({ code }: { code: string }) => {
      setGameCode(code);
      setPage('lobby');
    });

    socket.on('gameState', (state: GameState) => {
      setGameState(state);
      if (state.composition) setCompositionSettings(state.composition);
      setCompositionError(state.compositionError ?? null);
      setVoteTimer(state.voteTimer ?? null);
      setVoteMapping(state.voteMapping ?? null);
      setVoteResults(state.voteResults ?? null);
      if (state.phase !== 'night') setNightTurn(null);
      if (state.phase !== 'vote') setVotedFor(null);
      if (state.phase !== 'night') setPrivateMessage(null);
      if (state.phase === 'reveal') setHunterAnnouncement(null);
      // Synchroniser hunterShotPending depuis le serveur (pour les autres joueurs)
      if (state.hunterShotPending) setHunterShotPending(true);
      else if (!state.hunterShotPending && state.phase !== 'reveal') setHunterShotPending(false);
      setIsHost((prev) => prev || state.owner === name);
      if (state.phase !== 'lobby') setPage('game');
    });

    socket.on('privateState', (data: PrivateState) => {
      setPrivateState(data);
      if (data.minionWolves) setMinionWolves(data.minionWolves);
      if (data.masonAlly !== undefined) setMasonAlly(data.masonAlly ?? null);
      // Doppelgänger fields
      setDoppelgangerCopied(data.doppelgangerCopied ?? null);
      setDoppelgangerSubPhase(data.doppelgangerSubPhase ?? null);
      setWolfPackIds(data.wolfPackIds ?? []);
      setDoppelgangerWolfIds(data.doppelgangerWolfIds ?? []);
      setCanPeekCenter(data.canPeekCenter ?? false);
    });

    socket.on('nightTurn', (turn: { actorId: string | null; roleName: string | null; duration: number; startedAt: number }) => {
      setNightTurn(turn);
    });

    socket.on('systemMessage', (message: string) => {
      setHunterAnnouncement(message);
    });

    socket.on('privateMessage', (message: string) => {
      setPrivateMessage(message);
    });

    socket.on('wolfStatus', (data: { status: 'alone' | 'team'; otherWolves: string[] }) => {
      setWolfStatus(data.status);
      setOtherWolves(data.otherWolves);
    });

    socket.on('doppelgangerCopied', (data: { copiedRole: string; targetName: string }) => {
      setDoppelgangerCopied(data.copiedRole);
    });

    socket.on('hunterShot', () => {
      setHunterShotPending(true);
      setIsHunterShooter(true); // Seul le chasseur reçoit cet événement
    });

    socket.on('hunterShotResolved', () => {
      setHunterShotPending(false);
      setIsHunterShooter(false);
    });

    socket.on('errorMessage', (message: string) => {
      window.alert(message);
    });

    return () => {
      socket.off('gameCreated');
      socket.off('joinedGame');
      socket.off('gameState');
      socket.off('privateState');
      socket.off('nightTurn');
      socket.off('systemMessage');
      setHunterAnnouncement(null);
      socket.off('privateMessage');
      socket.off('wolfStatus');
      socket.off('doppelgangerCopied');
      socket.off('hunterShot');
      socket.off('hunterShotResolved');
      socket.off('errorMessage');
    };
  }, [socket]);

  const centerCards = useMemo(
    () =>
      gameState?.centerCards.map((card) => ({
        id: String(card.index),
        faceUp: Boolean(card.role) || Boolean(privateState?.centerCards?.[card.index]?.revealed),
        label: card.role ?? (privateState?.centerCards?.[card.index]?.role ?? 'Mystère'),
      })) ?? [],
    [gameState, privateState]
  );

  // La composition affichée = liste des rôles présents dans la partie (depuis game.composition)
  // On l'aplatit en tableau de rôles (ex: {Loup Garou:2} → ['Loup Garou','Loup Garou'])
  // et non state.roles qui est le deck complet redistribué
  const composition = useMemo(() => {
    const comp = gameState?.composition;
    if (!comp) return gameState?.state?.roles ?? [];
    const result: string[] = [];
    for (const [role, count] of Object.entries(comp)) {
      for (let i = 0; i < (count as number); i++) result.push(role);
    }
    return result;
  }, [gameState]);

  const players = useMemo(() => {
    if (!gameState?.players) return [];

    const selfId = privateState?.myId;
    const isReveal = gameState.phase === 'reveal';
    const isReady = gameState.phase === 'ready';
    const isNight = gameState.phase === 'night';

    return gameState.players.map((player) => {
      const isSelf = player.id === selfId;
      const savedRole = gameState.state?.positions?.players?.find((item) => item.playerId === player.id)?.role;

      const isInsomniaTurn = isNight && privateState?.initialRole === 'Insomniaque' && nightTurn?.roleName === 'Insomniaque';
      const isWolfTurn = isNight && nightTurn?.roleName === 'Loup Garou';
      const isMyWolfTurn = privateState?.initialRole === 'Loup Garou' && isWolfTurn;
      const canSeeWolfAlly = isMyWolfTurn && otherWolves.includes(player.name);
      const canSeeSelfAsWolf = isSelf && isMyWolfTurn;

      const isVoyanteTurn = isNight && privateState?.initialRole === 'Voyante' && nightTurn?.roleName === 'Voyante';
      const canSeeAsPeeked = isVoyanteTurn && player.name in (privateState?.peekedPlayers ?? {});

      const visibleRole =
        isReveal ||
        (isSelf && isReady) ||
        (isSelf && isInsomniaTurn) ||
        canSeeWolfAlly ||
        canSeeSelfAsWolf ||
        canSeeAsPeeked
          ? savedRole
          : undefined;

      return { ...player, role: visibleRole };
    });
  }, [gameState, privateState, nightTurn, otherWolves]);

  const handleCreate = () => {
    if (!name.trim()) { window.alert('Entre un pseudo pour créer la partie.'); return; }
    socket.emit('createGame', { name });
  };

  const handleJoin = () => {
    if (!name.trim() || !gameCode.trim()) { window.alert('Entre ton pseudo et le code de la partie.'); return; }
    socket.emit('joinGame', { name, code: gameCode.toUpperCase() });
  };

  const handleStart = () => {
    if (!gameCode) return;
    if (!compositionIsValid) {
      window.alert(effectiveCompositionError || 'La composition doit contenir le bon nombre de cartes.');
      return;
    }
    socket.emit('startGame', { code: gameCode, composition: compositionSettings });
  };

  const compositionTotal = useMemo(
    () => Object.values(compositionSettings).reduce((sum, count) => sum + (Number(count) || 0), 0),
    [compositionSettings]
  );

  const requiredCards = useMemo(() => (gameState?.players?.length ?? 0) + 3, [gameState]);
  const compositionIsValid = compositionTotal === requiredCards;
  const effectiveCompositionError = compositionError ?? (
    !compositionIsValid && (gameState?.players?.length ?? 0) >= 4
      ? `Le nombre total de cartes doit être égal à ${requiredCards} (joueurs + 3), vous en avez ${compositionTotal}`
      : null
  );

  const handleCompositionChange = (newComposition: Composition) => {
    if (!gameCode) return;
    setCompositionSettings(newComposition);
    socket.emit('updateComposition', { code: gameCode, composition: newComposition });
  };

  const handleBeginNight = () => { if (gameCode) socket.emit('beginNight', { code: gameCode }); };

  const handleNightAction = (type: string, targetName?: string, index?: number, targetName2?: string) => {
    if (gameCode) socket.emit('nightAction', { code: gameCode, type, targetName, index, targetName2 });
  };

  const handleHunterShot = (target: string) => {
    if (!gameCode) return;
    setHunterShotPending(false);
    setIsHunterShooter(false);
    socket.emit('hunterShot', { code: gameCode, target });
  };

  const handleCastVote = (target: string) => {
    if (!gameCode) return;
    if (hunterShotPending) return; // Bloquer pendant le tir du chasseur
    setVotedFor(target);
    socket.emit('castVote', { code: gameCode, target });
  };

  const handleAdjustVoteTimer = (deltaSec: number) => {
    if (!gameCode) return;
    socket.emit('adjustVoteTimer', { code: gameCode, deltaSec });
  };

  const handleRestart = () => {
    if (!gameCode) return;
    setPrivateState(null);
    setNightTurn(null);
    setVotedFor(null);
    setVoteMapping(null);
    setVoteResults(null);
    setPrivateMessage(null);
    setHunterAnnouncement(null);
    setWolfStatus(null);
    setOtherWolves([]);
    setHunterShotPending(false);
    setIsHunterShooter(false);
    setMinionWolves([]);
    setMasonAlly(null);
    setDoppelgangerCopied(null);
    setDoppelgangerSubPhase(null);
    setWolfPackIds([]);
    setDoppelgangerWolfIds([]);
    setCanPeekCenter(false);
    socket.emit('restartGame', { code: gameCode });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {page === 'lobby' ? (
        <Lobby
          name={name}
          code={gameCode}
          setName={setName}
          setCode={setGameCode}
          players={players}
          owner={gameState?.owner ?? ''}
          phase={gameState?.phase ?? 'lobby'}
          logs={gameState?.logs ?? []}
          isHost={isHost}
          composition={compositionSettings}
          onCompositionChange={handleCompositionChange}
          compositionError={effectiveCompositionError}
          compositionIsValid={compositionIsValid}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onStart={handleStart}
        />
      ) : (
        <GameLayout
          players={players}
          centerCards={centerCards}
          composition={composition}
          isCompositionOpen={isCompositionOpen}
          onToggleComposition={() => setIsCompositionOpen((c) => !c)}
          phase={gameState?.phase ?? 'ready'}
          isHost={isHost}
          onBeginNight={handleBeginNight}
          onRestart={handleRestart}
          canAct={privateState?.canAct ?? false}
          myRole={privateState?.role ?? ''}
          myId={privateState?.myId ?? ''}
          initialRole={privateState?.initialRole ?? privateState?.role ?? ''}
          rolePower={privateState?.rolePower ?? null}
          gameCode={gameCode}
          onNightAction={handleNightAction}
          onCastVote={handleCastVote}
          nightTurn={nightTurn}
          nightOrder={gameState?.state?.currentTurn?.nightOrder ?? []}
          nightStepIndex={gameState?.state?.currentTurn?.stepIndex ?? 0}
          voteTimer={voteTimer}
          votedFor={votedFor}
          result={gameState?.result ?? null}
          voteMapping={voteMapping}
          voteResults={voteResults}
          privateMessage={privateMessage}
          hunterAnnouncement={hunterAnnouncement}
          hunterShotPending={hunterShotPending}
          onHunterShot={isHunterShooter ? handleHunterShot : undefined}
          wolfStatus={wolfStatus}
          otherWolves={otherWolves}
          minionWolves={minionWolves}
          masonAlly={masonAlly}
          doppelgangerCopied={doppelgangerCopied}
          doppelgangerSubPhase={doppelgangerSubPhase}
          wolfPackIds={wolfPackIds}
          doppelgangerWolfIds={doppelgangerWolfIds}
          canPeekCenter={canPeekCenter}
          onAdjustVoteTimer={isHost ? handleAdjustVoteTimer : undefined}
        />
      )}
    </div>
  );
}
