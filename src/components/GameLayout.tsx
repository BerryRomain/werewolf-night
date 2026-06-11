import { useMemo, useEffect, useState } from 'react';
import Card from './Card';
import RoleInfo from './RoleInfo';
import RoleTooltip from './RoleTooltip';
import { ROLE_POWER_INFO } from '../constants/roles';

interface Player {
  id: string;
  name: string;
  role: string;
  alive: boolean;
}

interface CenterCard {
  id: string;
  faceUp: boolean;
  label: string;
}

interface GameLayoutProps {
  players: Player[];
  centerCards: CenterCard[];
  composition: string[];
  isCompositionOpen: boolean;
  onToggleComposition: () => void;
  phase: string;
  isHost: boolean;
  onBeginNight: () => void;
  onRestart?: () => void;
  canAct: boolean;
  myRole: string;
  myId: string;
  gameCode: string;
  onNightAction: (type: string, targetName?: string, index?: number, targetName2?: string) => void;
  onCastVote: (target: string) => void;
  votedFor?: string | null;
  result?: string | null;
  voteMapping?: Record<string, string> | null;
  voteResults?: Record<string, number> | null;
  initialRole: string;
  rolePower?: { description: string; power: string } | null;
  nightTurn?: { actorId: string | null; roleName: string | null; duration: number; startedAt: number } | null;
  voteTimer?: { duration: number; startedAt: number } | null;
  privateMessage?: string | null;
  wolfStatus?: 'alone' | 'team' | null;
  otherWolves?: string[];
  nightOrder?: string[];
  nightStepIndex?: number;
  hunterShotPending?: boolean;
  onHunterShot?: (target: string) => void;
  hunterAnnouncement?: string | null;
  minionWolves?: string[];
  masonAlly?: string | null;
  // Doppelgänger
  doppelgangerCopied?: string | null;
  doppelgangerSubPhase?: string | null;
  wolfPackIds?: string[];
  doppelgangerWolfIds?: string[];
  canPeekCenter?: boolean;
  onAdjustVoteTimer?: (deltaSec: number) => void;
}

export default function GameLayout({
  players, centerCards, composition, isCompositionOpen, onToggleComposition, phase, isHost, onBeginNight, onRestart,
  canAct, myRole, myId, initialRole, rolePower, gameCode, onNightAction, onCastVote,
  votedFor = null, result = null, voteMapping = null, voteResults = null,
  nightTurn = null, voteTimer = null, privateMessage = null,
  wolfStatus = null, otherWolves = [], nightOrder = [], nightStepIndex = 0,
  hunterShotPending = false, onHunterShot, hunterAnnouncement = null,
  minionWolves = [], masonAlly = null,
  doppelgangerCopied = null, doppelgangerSubPhase = null,
  wolfPackIds = [], doppelgangerWolfIds = [], canPeekCenter = false,
  onAdjustVoteTimer,
}: GameLayoutProps) {
  const topPlayers = useMemo(() => players.slice(0, 3), [players]);
  const leftPlayers = useMemo(() => players.slice(3, 5), [players]);
  const rightPlayers = useMemo(() => players.slice(5, 7), [players]);
  const bottomPlayers = useMemo(() => players.slice(7), [players]);

  const isNightPhase = phase.toLowerCase() === 'night';
  const isVotePhase = phase.toLowerCase() === 'vote';
  const isRevealPhase = phase.toLowerCase() === 'reveal';

  const [remain, setRemain] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [actionTaken, setActionTaken] = useState<boolean>(false);
  const [voyanteCenterPeeked, setVoyanteCenterPeeked] = useState<number>(0);
  const [voyantePeekedPlayer, setVoyantePeekedPlayer] = useState<boolean>(false);
  // Doppelgänger state
  const [doppelPicked, setDoppelPicked] = useState<boolean>(false);
  const [doppelSubActionTaken, setDoppelSubActionTaken] = useState<boolean>(false);
  const [doppelVoyantePeeked, setDoppelVoyantePeeked] = useState<number>(0);
  const [doppelVoyantePeekedPlayer, setDoppelVoyantePeekedPlayer] = useState<boolean>(false);
  // Chasseur : cible sélectionnée via carte
  const [hunterTarget, setHunterTarget] = useState<string | null>(null);
  // Animation d'échange : ids de la forme 'player-{id}' ou 'center-{idx}'
  const [swapAnim, setSwapAnim] = useState<{ fromId: string; toId: string } | null>(null);
  // Voleur : révèle temporairement sa propre carte après l'échange
  const [voleurReveal, setVoleurReveal] = useState<boolean>(false);
  // Cartes centre temporairement révélées (Voyante / Loup seul) puis cachées à la fin du tour
  const [peekedCenterIds, setPeekedCenterIds] = useState<Set<number>>(new Set());
  const [peekedCenterVisible, setPeekedCenterVisible] = useState<Set<number>>(new Set());

  const revealCenterTemporarily = (index: number) => {
    setPeekedCenterIds(prev => new Set([...prev, index]));
    // Petit délai pour laisser le serveur renvoyer le rôle avant de retourner la carte
    setTimeout(() => {
      setPeekedCenterVisible(prev => new Set([...prev, index]));
    }, 400);
  };

  const triggerSwapAnim = (fromId: string, toId: string, revealSelf = false) => {
    setSwapAnim({ fromId, toId });
    if (revealSelf) {
      setTimeout(() => setVoleurReveal(true), 900);
      setTimeout(() => setVoleurReveal(false), 3400);
    }
    setTimeout(() => setSwapAnim(null), 900);
  };

  useEffect(() => {
    setSelectedPlayerId(null);
    setActionTaken(false);
    setVoyanteCenterPeeked(0);
    setVoyantePeekedPlayer(false);
    setDoppelPicked(false);
    setDoppelSubActionTaken(false);
    setDoppelVoyantePeeked(0);
    setDoppelVoyantePeekedPlayer(false);
    setHunterTarget(null);
    setSwapAnim(null);
    setVoleurReveal(false);
    setPeekedCenterIds(new Set());
    setPeekedCenterVisible(new Set());
  }, [phase, nightTurn?.actorId, nightTurn?.roleName]);


  useEffect(() => {
  if (phase.toLowerCase() !== 'night') {
    setPeekedCenterIds(new Set());
    setPeekedCenterVisible(new Set());
  }
  }, [phase]);

  useEffect(() => {
    let timer: any = null;
    const currentTimer = isVotePhase ? voteTimer : nightTurn;
    if (currentTimer && currentTimer.startedAt && currentTimer.duration) {
      const end = currentTimer.startedAt + currentTimer.duration;
      const update = () => {
        const remainingSeconds = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        setRemain(remainingSeconds);
        if (Date.now() >= end) { clearInterval(timer); timer = null; }
      };
      update();
      timer = setInterval(update, 250);
    } else {
      setRemain(null);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [nightTurn, voteTimer, isVotePhase]);

  const activeRoleName = isNightPhase ? nightTurn?.roleName ?? null : null;
  const formattedRemain = remain !== null
    ? `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}`
    : null;

  const currentNightIndex = (typeof nightStepIndex === 'number' && Number.isFinite(nightStepIndex))
    ? nightStepIndex
    : (nightOrder && activeRoleName ? nightOrder.findIndex((r) => r === activeRoleName) : -1);

  const actionRole = initialRole || myRole;

  // ── Doppelgänger helpers ──
  const isDoppelTurn = actionRole === 'Doppelgänger' && (
    activeRoleName === 'Doppelgänger' || activeRoleName === 'Doppelgänger-Insomniaque'
  );
  const isDoppelInsomnaqueTurn = actionRole === 'Doppelgänger' && activeRoleName === 'Doppelgänger-Insomniaque';
  // Effective sub-role during doppelganger action phase
  const doppelCopiedLive = doppelgangerCopied; // from server via privateState
  // Whether the doppelganger is in immediate-action sub-phase
  const isDoppelActionPhase = isDoppelTurn && doppelgangerSubPhase === 'action' && doppelPicked;

  // ── Red aura detection ──
  // A player has a red aura if:
  // 1. During wolf turn: they are in wolfPackIds (seen by wolves, no role label)
  // 2. During doppelganger sbire subphase: they are in doppelgangerWolfIds
  const hasWolfAura = (player: Player): boolean => {
    if (isNightPhase && activeRoleName === 'Loup Garou' && wolfPackIds.includes(player.id)) return true;
    if (isNightPhase && activeRoleName === 'Loup Garou' && player.id === myId &&
        (actionRole === 'Loup Garou' || (actionRole === 'Doppelgänger' && doppelCopiedLive === 'Loup Garou'))) return true;
    if (isNightPhase && isDoppelTurn && doppelgangerSubPhase === 'sbire' && doppelgangerWolfIds.includes(player.id)) return true;
    return false;
  };

  const getPlayerRoleDisplay = (player: Player, forceReveal = false): string => {
    if (hasWolfAura(player)) return '';
    if (forceReveal && player.id === myId) return myRole || player.role || '???';
    if (player.role) return player.role;
    if (actionRole === 'Loup Garou' && wolfStatus === 'team' && otherWolves.includes(player.name)) return 'Loup Garou';
    return '???';
  };

  // ── Clickability ──
  const isPlayerClickable = (player: Player): boolean => {
    // Chasseur en attente : seul le chasseur (myId) peut sélectionner une cible via carte
    if (hunterShotPending && onHunterShot) {
      return player.id !== myId && player.alive;
    }
    // Vote normal bloqué si chasseur en attente
    if (isVotePhase) return !hunterShotPending && player.alive;
    if (!isNightPhase || !canAct) return false;
    // Doppelgänger pick phase: click any other player (not self, not already picked)
    if (isDoppelTurn && !isDoppelInsomnaqueTurn && !doppelPicked && doppelgangerSubPhase !== 'sbire') {
      return player.id !== myId;
    }
    // Doppelgänger immediate action sub-phase
    if (isDoppelActionPhase) {
      if (doppelCopiedLive === 'Voleur') return player.id !== myId && !doppelSubActionTaken;
      if (doppelCopiedLive === 'Noiseuse') return player.id !== myId && !doppelSubActionTaken;
      if (doppelCopiedLive === 'Voyante') return player.id !== myId && !doppelVoyantePeekedPlayer && doppelVoyantePeeked === 0 && !doppelSubActionTaken;
      return false;
    }
    if (actionTaken) return false;
    if (actionRole === 'Voleur') return player.id !== myId;
    if (actionRole === 'Noiseuse') return player.id !== myId;
    if (actionRole === 'Voyante') return player.id !== myId && !voyantePeekedPlayer && voyanteCenterPeeked === 0;
    return false;
  };

  const handlePlayerCardClick = (player: Player) => {
    // Chasseur : sélection de cible via carte
    if (hunterShotPending && onHunterShot) {
      if (player.id !== myId && player.alive) setHunterTarget(player.name);
      return;
    }
    if (isVotePhase) { if (player.alive) onCastVote(player.name); return; }
    if (!isPlayerClickable(player)) return;

    // ── Doppelgänger pick ──
    if (isDoppelTurn && !isDoppelInsomnaqueTurn && !doppelPicked && doppelgangerSubPhase !== 'sbire') {
      onNightAction('doppelPick', player.name);
      setDoppelPicked(true);
      return;
    }

    // ── Doppelgänger immediate sub-actions ──
    if (isDoppelActionPhase) {
      if (doppelCopiedLive === 'Voleur') {
        triggerSwapAnim(`player-${myId}`, `player-${player.id}`, true);
        onNightAction('swapPlayer', player.name);
        setDoppelSubActionTaken(true);
        return;
      }
      if (doppelCopiedLive === 'Noiseuse') {
        if (selectedPlayerId === player.id) { setSelectedPlayerId(null); return; }
        if (!selectedPlayerId) { setSelectedPlayerId(player.id); return; }
        const first = players.find((p) => p.id === selectedPlayerId);
        if (!first) { setSelectedPlayerId(player.id); return; }
        triggerSwapAnim(`player-${first.id}`, `player-${player.id}`);
        onNightAction('swapPlayers', first.name, undefined, player.name);
        setDoppelSubActionTaken(true);
        setSelectedPlayerId(null);
        return;
      }
      if (doppelCopiedLive === 'Voyante') {
        onNightAction('peekPlayer', player.name);
        setDoppelVoyantePeekedPlayer(true);
        setDoppelSubActionTaken(true);
        return;
      }
      return;
    }

    // ── Regular roles ──
    if (actionRole === 'Voleur') {
      triggerSwapAnim(`player-${myId}`, `player-${player.id}`, true);
      onNightAction('swapPlayer', player.name); setActionTaken(true); return;
    }
    if (actionRole === 'Noiseuse') {
      if (selectedPlayerId === player.id) { setSelectedPlayerId(null); return; }
      if (!selectedPlayerId) { setSelectedPlayerId(player.id); return; }
      const first = players.find((p) => p.id === selectedPlayerId);
      if (!first) { setSelectedPlayerId(player.id); return; }
      triggerSwapAnim(`player-${first.id}`, `player-${player.id}`);
      onNightAction('swapPlayers', first.name, undefined, player.name);
      setActionTaken(true); setSelectedPlayerId(null); return;
    }
    if (actionRole === 'Voyante') { onNightAction('peekPlayer', player.name); setVoyantePeekedPlayer(true); setActionTaken(true); return; }
  };

  const isCenterCardClickable = (): boolean => {
    if (!isNightPhase || !canAct) return false;
    // Doppelgänger immediate Soûlard or Voyante sub-action
    if (isDoppelActionPhase) {
      if (doppelCopiedLive === 'Soûlard') return !doppelSubActionTaken;
      if (doppelCopiedLive === 'Voyante') return !doppelVoyantePeekedPlayer && doppelVoyantePeeked < 2 && !doppelSubActionTaken;
      return false;
    }
    if (actionTaken) return false;
    if (actionRole === 'Soûlard') return true;
    if (actionRole === 'Loup Garou') return canPeekCenter || wolfStatus === 'alone';
    if (actionRole === 'Voyante') return !voyantePeekedPlayer && voyanteCenterPeeked < 2;
    return false;
  };

  const handleCenterClick = (index: number) => {
    if (!isCenterCardClickable()) return;

    // Doppelgänger sub-actions
    if (isDoppelActionPhase) {
      if (doppelCopiedLive === 'Soûlard') {
        triggerSwapAnim(`player-${myId}`, `center-${index}`);
        onNightAction('swapWithCenter', undefined, index);
        setDoppelSubActionTaken(true);
        return;
      }
      if (doppelCopiedLive === 'Voyante') {
        revealCenterTemporarily(index);
        onNightAction('peekCenter', undefined, index);
        const next = doppelVoyantePeeked + 1;
        setDoppelVoyantePeeked(next);
        if (next >= 2) setDoppelSubActionTaken(true);
        return;
      }
      return;
    }

    // Doppelgänger-Insomniaque late check: uses lookSelf, not center
    if (isDoppelInsomnaqueTurn) return;

    if (actionRole === 'Voyante') {
      revealCenterTemporarily(index);
      onNightAction('peekCenter', undefined, index);
      const next = voyanteCenterPeeked + 1;
      setVoyanteCenterPeeked(next);
      if (next >= 2) setActionTaken(true);
      return;
    }
    if (actionTaken) return;
    setActionTaken(true);
    if (actionRole === 'Soûlard') {
      triggerSwapAnim(`player-${myId}`, `center-${index}`);
      onNightAction('swapWithCenter', undefined, index);
    } else {
      revealCenterTemporarily(index);
      onNightAction('peekCenter', undefined, index);
    }
  };

  const isCenterTitleClickable = () => isVotePhase;
  const handleCenterTitleClick = () => { if (isCenterTitleClickable()) onCastVote('centre'); };

  const showResult = isRevealPhase && result;
  const voteBreakdown = isRevealPhase && voteMapping ? Object.entries(voteMapping) : [];
  const voteCount = voteResults ? Object.values(voteResults).reduce((s, c) => s + c, 0) : 0;

  const isWinner = (() => {
    if (!result) return false;
    const isWolfTeam = initialRole === 'Loup Garou' || initialRole === 'Sbire' ||
      (initialRole === 'Doppelgänger' && (doppelgangerCopied === 'Loup Garou' || doppelgangerCopied === 'Sbire'));
    const isTannerRole = initialRole === 'Tanneur' ||
      (initialRole === 'Doppelgänger' && doppelgangerCopied === 'Tanneur');
    if (result === 'tanner') return isTannerRole;
    if (result === 'village') return !isWolfTeam && !isTannerRole;
    if (result === 'wolves') return isWolfTeam;
    return false;
  })();

  // ── Card className helper: red aura for wolves ──
  const getSwapAnimClass = (cardId: string): string => {
    if (!swapAnim) return '';
    if (swapAnim.fromId === cardId) return 'swap-anim-from';
    if (swapAnim.toId === cardId) return 'swap-anim-to';
    return '';
  };

  const playerCardClassName = (player: Player): string => {
    const base = 'bg-slate-950/90';
    if (hasWolfAura(player)) return `${base} ring-2 ring-red-500 shadow-[0_0_16px_4px_rgba(239,68,68,0.45)] border-red-500`;
    if (hunterShotPending && hunterTarget === player.name) return `${base} ring-2 ring-rose-400 shadow-[0_0_16px_4px_rgba(251,113,133,0.5)] border-rose-400`;
    if (selectedPlayerId === player.id) return `${base} border-emerald-400`;
    return `${base} border-slate-700`;
  };

  const renderPlayerCard = (player: Player) => {
    const isSelf = player.id === myId;
    const showVoleurReveal = isSelf && voleurReveal;
    const wolfAuraClass = hasWolfAura(player)
      ? 'ring-2 ring-red-500 shadow-[0_0_20px_6px_rgba(239,68,68,0.55)] rounded-xl'
      : '';
    const faceUp = hasWolfAura(player)
      ? false
      : showVoleurReveal
        ? true
        : Boolean(player.role);
    return (
      <div key={player.id} className={`${getSwapAnimClass(`player-${player.id}`)} ${wolfAuraClass}`}>
        <Card
          title={getPlayerRoleDisplay(player, showVoleurReveal)}
          subtitle={player.name}
          faceUp={faceUp}
          className={playerCardClassName(player)}
          onClick={() => handlePlayerCardClick(player)}
          isClickable={isPlayerClickable(player)}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 lg:px-10">
        <header className="flex flex-col gap-4 rounded-[32px] border border-slate-800 bg-slate-900/80 p-5 shadow-glow backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">One Night Werewolf</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-white">Table de jeu</h1>
              <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-400">
                Phase : {phase}
              </span>
            </div>

            {initialRole ? (
              <p className="mt-3 text-sm text-slate-200">
                Votre rôle initial est : <span className="font-semibold text-white">{initialRole}</span>
                {initialRole === 'Doppelgänger' && doppelgangerCopied ? (
                  <span className="ml-2 text-violet-300">→ copie : <span className="font-semibold text-white">{doppelgangerCopied}</span></span>
                ) : null}
              </p>
            ) : null}

            {showResult ? (
              <div className="mt-4 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-slate-100">
                <p className="text-sm uppercase tracking-[0.3em] text-indigo-100">{isWinner ? 'Victoire' : 'Défaite'}</p>
                <p className="mt-2 text-base font-semibold text-white">
                  {result === 'tanner' && (initialRole === 'Tanneur' || (initialRole === 'Doppelgänger' && doppelgangerCopied === 'Tanneur'))
                    ? 'Tu es mort. Tu as gagné. Le Tanneur triomphe !'
                    : result === 'tanner'
                    ? "Le Tanneur a gagné seul. Ni le village ni les loups ne l'emportent."
                    : isWinner ? 'Ton équipe a gagné.' : 'Ton équipe a perdu.'}
                </p>
              </div>
            ) : null}

            {hunterAnnouncement ? (
              <div className="mt-4 rounded-3xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100">
                <p className="text-sm uppercase tracking-[0.3em] text-amber-300 font-semibold">⚠️ Attention</p>
                <p className="mt-2 text-base font-semibold text-white">{hunterAnnouncement}</p>
              </div>
            ) : null}

            {privateMessage ? (
              <div className="mt-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-200">Message</p>
                <p className="mt-2 text-base font-semibold text-white">{privateMessage}</p>
              </div>
            ) : null}

            {!isNightPhase && nightOrder && nightOrder.length > 0 ? (
              <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ordre des actions</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {nightOrder.map((role, idx) => {
                    const status = idx < currentNightIndex ? 'passed' : idx === currentNightIndex ? 'current' : 'upcoming';
                    const cls = status === 'passed' ? 'bg-slate-800 text-slate-500' : status === 'current' ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-200';
                    return <span key={idx} className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{role}</span>;
                  })}
                </div>
              </div>
            ) : null}

            {isNightPhase && activeRoleName ? (
              <div className="mt-4 flex flex-col gap-2 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-slate-100">
                <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Tour de rôle</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-base font-semibold text-white">Au tour du {activeRoleName}</span>
                  <span className="rounded-full bg-slate-950/90 px-3 py-1 text-sm font-semibold text-amber-200">
                    {formattedRemain ?? 'Chargement...'}
                  </span>
                </div>

                {/* ── DOPPELGÄNGER panels ── */}
                {isDoppelTurn && canAct && !isDoppelInsomnaqueTurn ? (
                  <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm text-violet-200 space-y-2">
                    {/* Pick phase */}
                    {!doppelPicked && doppelgangerSubPhase !== 'sbire' ? (
                      <span className="font-semibold text-white">Tu es la Doppelgänger — clique sur la carte d'un joueur pour copier son rôle.</span>
                    ) : null}

                    {/* Copied role display */}
                    {doppelPicked && doppelCopiedLive ? (
                      <p className="text-violet-100">
                        Rôle copié : <span className="font-semibold text-white">{doppelCopiedLive}</span>
                      </p>
                    ) : null}

                    {/* Sbire subphase: wolf auras visible */}
                    {doppelCopiedLive === 'Sbire' && doppelgangerSubPhase === 'sbire' ? (
                      <p className="font-semibold text-white">
                        Tu es Doppelgänger-Sbire. Les joueurs entourés d'une <span className="text-red-400">aura rouge</span> sont les Loups-garous. Ils ne savent pas que tu es le Sbire.
                      </p>
                    ) : null}

                    {/* Immediate action sub-phases */}
                    {isDoppelActionPhase && doppelCopiedLive === 'Voleur' ? (
                      <p className="font-semibold text-white">Doppelgänger-Voleur : clique sur un joueur pour lui voler son rôle.</p>
                    ) : null}
                    {isDoppelActionPhase && doppelCopiedLive === 'Noiseuse' ? (
                      <p className="font-semibold text-white">
                        {selectedPlayerId
                          ? <>Premier joueur : <span className="text-white">{players.find((p) => p.id === selectedPlayerId)?.name}</span>. Clique sur un second joueur pour échanger leurs rôles.</>
                          : 'Doppelgänger-Noiseuse : clique sur deux joueurs pour échanger leurs rôles.'}
                      </p>
                    ) : null}
                    {isDoppelActionPhase && doppelCopiedLive === 'Soûlard' ? (
                      <p className="font-semibold text-white">Doppelgänger-Soûlard : clique sur une carte du centre pour l'échanger avec la tienne, sans la regarder.</p>
                    ) : null}
                    {isDoppelActionPhase && doppelCopiedLive === 'Voyante' ? (
                      <p className="font-semibold text-white">
                        {doppelVoyantePeekedPlayer || doppelSubActionTaken
                          ? 'Action Voyante terminée.'
                          : doppelVoyantePeeked === 1
                          ? 'Première carte vue. Clique sur une deuxième carte du centre.'
                          : 'Doppelgänger-Voyante : clique sur un joueur pour voir son rôle, ou sur deux cartes du centre.'}
                      </p>
                    ) : null}

                    {/* Passive roles: nothing to do */}
                    {doppelPicked && doppelCopiedLive && ['Loup Garou', 'Franc-Maçon', 'Villageois', 'Chasseur', 'Tanneur', 'Insomniaque'].includes(doppelCopiedLive) && doppelgangerSubPhase !== 'sbire' ? (
                      <p className="text-violet-200">
                        {doppelCopiedLive === 'Loup Garou' && "Tu te réveilleras avec les Loups-garous pendant leur tour."}
                        {doppelCopiedLive === 'Franc-Maçon' && "Tu te réveilleras avec les Francs-Maçons pendant leur tour."}
                        {doppelCopiedLive === 'Insomniaque' && "Tu te réveilleras en dernier pour vérifier ta carte."}
                        {(doppelCopiedLive === 'Villageois' || doppelCopiedLive === 'Chasseur' || doppelCopiedLive === 'Tanneur') && "Aucune action nocturne. Tu joues ce rôle pour toute la partie."}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Doppelgänger-Insomniaque late check */}
                {isDoppelInsomnaqueTurn && canAct ? (
                  <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-200">
                    {doppelCopiedLive === 'Insomniaque'
                      ? <span className="font-semibold text-white">Doppelgänger-Insomniaque : vérifie si ta carte est toujours la Doppelgänger.</span>
                      : <span className="text-sky-300">Tour de vérification Doppelgänger (aucune action si tu n'as pas copié l'Insomniaque).</span>}
                    {doppelCopiedLive === 'Insomniaque' ? (
                      <button
                        type="button"
                        onClick={() => onNightAction('lookSelf')}
                        className="mt-2 block rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                      >
                        Regarder ma carte
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* Loup Garou panels (including Doppelgänger-Loup) */}
                {(actionRole === 'Loup Garou' || (actionRole === 'Doppelgänger' && doppelCopiedLive === 'Loup Garou')) &&
                  activeRoleName === 'Loup Garou' && (canAct || wolfPackIds.length > 0) ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    <span className="font-semibold text-white">
                      {wolfPackIds.length <= 1
                        ? 'Tu es seul loup — regarde une carte du centre.'
                        : 'Les joueurs entourés d\'une aura rouge sont tes alliés loups. Vous ne pouvez pas regarder de carte au centre.'}
                    </span>
                  </div>
                ) : null}

                {/* Franc-Maçon (including Doppelgänger-Mason) */}
                {(initialRole === 'Franc-Maçon' || (initialRole === 'Doppelgänger' && doppelCopiedLive === 'Franc-Maçon')) &&
                  activeRoleName === 'Franc-Maçon' ? (
                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-200">
                    {masonAlly
                      ? <>Ton frère Franc-Maçon est : <span className="font-semibold text-white">{masonAlly}</span>. Vous êtes dans l'équipe du village.</>
                      : <span className="font-semibold text-white">L'autre carte Franc-Maçon est au centre — tu es le seul Franc-Maçon en jeu.</span>}
                  </div>
                ) : null}

                {/* Sbire */}
                {initialRole === 'Sbire' && nightTurn?.roleName === 'Sbire' ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    {minionWolves && minionWolves.length > 0
                      ? <>Les Loups-garous sont : <span className="font-semibold text-white">{minionWolves.join(', ')}</span>. Ils ne savent pas que tu es le Sbire.</>
                      : <span className="font-semibold text-white">Il n'y a aucun Loup-garou autour de la table.</span>}
                  </div>
                ) : null}

                {/* Voleur */}
                {actionRole === 'Voleur' && canAct && !isDoppelTurn ? (
                  <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-purple-200">
                    <span className="font-semibold text-white">Sélectionne un joueur pour lui voler son rôle.</span>
                  </div>
                ) : null}

                {/* Noiseuse */}
                {actionRole === 'Noiseuse' && canAct && !isDoppelTurn ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    {selectedPlayerId
                      ? <>Premier joueur : <span className="font-semibold text-white">{players.find((p) => p.id === selectedPlayerId)?.name}</span>. Clique sur un second joueur.</>
                      : 'Sélectionne deux joueurs pour échanger leurs rôles.'}
                  </div>
                ) : null}

                {/* Soûlard */}
                {actionRole === 'Soûlard' && canAct && !isDoppelTurn ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                    <span className="font-semibold text-white">Choisis une carte du centre pour l'échanger avec la tienne, sans la regarder.</span>
                  </div>
                ) : null}

                {/* Insomniaque */}
                {initialRole === 'Insomniaque' && canAct && !isDoppelTurn ? (
                  <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-200">
                    <span className="font-semibold text-white">C'est ton tour — vérifie ton rôle actuel sur ta carte.</span>
                  </div>
                ) : null}

                {/* Voyante */}
                {actionRole === 'Voyante' && canAct && !isDoppelTurn ? (
                  <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm text-violet-200">
                    {voyantePeekedPlayer
                      ? <span className="font-semibold text-white">Tu as regardé le rôle d'un joueur. Action terminée.</span>
                      : voyanteCenterPeeked >= 2
                      ? <span className="font-semibold text-white">Tu as regardé deux cartes du centre. Action terminée.</span>
                      : voyanteCenterPeeked === 1
                      ? <span className="font-semibold text-white">Première carte vue. Clique sur une deuxième carte du centre.</span>
                      : <span className="font-semibold text-white">Clique sur la carte d'un joueur pour voir son rôle, ou sur deux cartes du centre.</span>}
                  </div>
                ) : null}

                {nightOrder && nightOrder.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Ordre des actions</p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {nightOrder.map((role, idx) => {
                        const status = idx < currentNightIndex ? 'passed' : idx === currentNightIndex ? 'current' : 'upcoming';
                        const cls = status === 'passed' ? 'bg-slate-800 text-slate-400' : status === 'current' ? 'bg-amber-400 text-slate-950' : 'bg-slate-700 text-slate-200';
                        return <span key={idx} className={`px-3 py-1 rounded-full text-sm font-semibold ${cls}`}>{role}</span>;
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-[width] duration-200"
                    style={{ width: `${remain !== null && nightTurn?.duration ? Math.max(0, Math.min(100, (remain / (nightTurn.duration / 1000)) * 100)) : 0}%` }}
                  />
                </div>
              </div>
            ) : null}

            {isVotePhase ? (
              <div className="mt-4 flex flex-col gap-2 rounded-3xl border border-sky-500/30 bg-sky-500/10 p-4 text-slate-100">
                <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Temps de vote</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-base font-semibold text-white">Phase de vote</span>
                  <span className="rounded-full bg-slate-950/90 px-3 py-1 text-sm font-semibold text-sky-200">
                    {formattedRemain ?? (voteTimer ? 'Chargement...' : 'En attente...')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-[width] duration-200"
                    style={{ width: `${remain !== null && voteTimer?.duration ? Math.max(0, Math.min(100, (remain / (voteTimer.duration / 1000)) * 100)) : 0}%` }}
                  />
                </div>
                <div className="mt-3 text-sm text-slate-200">
                  {voteCount}/{players.length} personnes ont voté
                </div>
                {isHost && onAdjustVoteTimer ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 uppercase tracking-widest">Temps :</span>
                    <button
                      type="button"
                      onClick={() => onAdjustVoteTimer(-60)}
                      className="rounded-2xl border border-slate-600 bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-100 hover:border-red-500 hover:text-red-300 transition"
                    >
                      −1 mn
                    </button>
                    <button
                      type="button"
                      onClick={() => onAdjustVoteTimer(+60)}
                      className="rounded-2xl border border-slate-600 bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-100 hover:border-emerald-500 hover:text-emerald-300 transition"
                    >
                      +1 mn
                    </button>
                  </div>
                ) : null}
                {votedFor
                  ? <p className="text-sm text-sky-100">Vous avez voté pour <span className="font-semibold text-white">{votedFor === 'centre' || votedFor === 'center' ? 'le centre' : votedFor}</span>.</p>
                  : <p className="text-sm text-slate-300">Cliquez un joueur ou le centre pour voter.</p>}
              </div>
            ) : null}
          </div>

          {isRevealPhase && voteBreakdown.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2 rounded-3xl border border-violet-500/30 bg-violet-500/10 p-4 text-slate-100">
              <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Détails du vote</p>
              <div className="space-y-1 text-sm text-slate-200">
                {voteBreakdown.map(([voter, target]) => {
                  const targetLabel = target === 'centre' || target === 'center' ? 'le centre' : target;
                  const targetPlayer = players.find((p) => p.name === target);
                  const targetRole = targetPlayer?.role ? ` (${targetPlayer.role})` : '';
                  return (
                    <div key={voter} className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{voter}</span>
                      <span>→</span>
                      <span className="text-slate-100">{targetLabel}{targetRole}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {hunterShotPending && onHunterShot ? (
            <div className="mt-4 rounded-3xl border border-rose-500/50 bg-rose-500/10 p-4 text-slate-100">
              <p className="text-sm uppercase tracking-[0.3em] text-rose-300 font-semibold">💥 Pouvoir du Chasseur</p>
              <p className="mt-2 text-base font-semibold text-white">Tu as été éliminé ! Clique sur la carte d'un joueur pour le viser.</p>
              <p className="mt-1 text-sm text-rose-200">
                {hunterTarget
                  ? <>Cible sélectionnée : <span className="font-bold text-white">{hunterTarget}</span></>
                  : 'Aucune cible sélectionnée — clique sur une carte joueur.'}
              </p>
              <button
                type="button"
                disabled={!hunterTarget}
                onClick={() => { if (hunterTarget) { onHunterShot(hunterTarget); setHunterTarget(null); } }}
                className="mt-4 rounded-2xl bg-rose-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🔫 Confirmer le tir
              </button>
            </div>
          ) : null}

          <button type="button" onClick={onToggleComposition}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-600">
            {isCompositionOpen ? 'Masquer la composition' : 'Afficher la composition'}
          </button>

          {isCompositionOpen && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">Composition de la partie</p>
              <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8">
                {composition.map((role) => (
                  <RoleTooltip key={role} role={role} rolePowerInfo={ROLE_POWER_INFO} />
                ))}
              </div>
            </div>
          )}
        </header>

        {phase && phase.toLowerCase() === 'ready' ? (
          <div className="space-y-4">
            <div className="mt-4 rounded-[16px] border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
              {isHost ? (
                <div className="flex items-center justify-between">
                  <div>Tu es l'hôte — tu peux démarrer la nuit quand tout le monde est prêt.</div>
                  <button type="button" onClick={onBeginNight}
                    className="ml-4 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
                    Commencer la nuit
                  </button>
                </div>
              ) : (
                <div>La partie est prête. Attends que l'hôte commence la nuit.</div>
              )}
            </div>
            {initialRole && rolePower ? <RoleInfo role={initialRole} rolePower={rolePower} /> : null}
          </div>
        ) : null}

        {phase && phase.toLowerCase() === 'reveal' ? (
          <div className="space-y-4">
            <div className="mt-4 rounded-[16px] border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
              {isHost ? (
                <div className="flex items-center justify-between">
                  <div>La partie est terminée. Tu peux relancer une nouvelle partie.</div>
                  <button type="button" onClick={onRestart}
                    className="ml-4 rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-400">
                    Relancer la partie
                  </button>
                </div>
              ) : (
                <div>La partie est terminée. Attends que l'hôte relance une nouvelle partie.</div>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-6">
          <main className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-glow backdrop-blur-xl">
              <div className="grid gap-6 lg:grid-cols-[1fr_minmax(420px,520px)_1fr]">
                <div className="flex flex-col items-center gap-4">{leftPlayers.map(renderPlayerCard)}</div>
                <div className="flex flex-col items-center justify-center gap-6">
                  <div onClick={handleCenterTitleClick}
                    className={`rounded-[32px] border border-slate-700 bg-slate-950/90 p-6 text-center shadow-inner ${isCenterTitleClickable() ? 'cursor-pointer hover:border-sky-500 hover:shadow-sky-500/50 transition' : ''}`}>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Centre du plateau</p>
                    <p className="mt-3 text-2xl font-semibold text-white">3 cartes</p>
                  </div>
                  <div className="grid w-full grid-cols-3 gap-4 justify-items-center">
                    {centerCards.map((card, idx) => {
                      const cardIndex = parseInt(card.id);
                      const tempRevealed = peekedCenterVisible.has(cardIndex);
                      const faceUpCenter = isNightPhase ? tempRevealed : (tempRevealed || card.faceUp);
                      return (
                        <div key={card.id} className={getSwapAnimClass(`center-${card.id}`)}>
                          <Card title={card.label} faceUp={faceUpCenter} label={`Centre ${card.id}`}
                            className=""
                            onClick={() => handleCenterClick(cardIndex)}
                            isClickable={isCenterCardClickable()} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4">{rightPlayers.map(renderPlayerCard)}</div>
              </div>
              <div className="mt-8 grid gap-4 lg:grid-cols-3 justify-items-center">{topPlayers.map(renderPlayerCard)}</div>
              {bottomPlayers.length > 0 ? (
                <div className="mt-8 grid gap-4 lg:grid-cols-3 justify-items-center">{bottomPlayers.map(renderPlayerCard)}</div>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
