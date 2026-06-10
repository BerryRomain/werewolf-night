import CompositionManager from './CompositionManager';

interface Composition {
  [key: string]: number;
}

interface LobbyProps {
  name: string;
  code: string;
  setName: (value: string) => void;
  setCode: (value: string) => void;
  players: Array<{ id: string; name: string; alive: boolean }>;
  owner: string;
  phase: string;
  logs: string[];
  isHost: boolean;
  composition: Composition;
  onCompositionChange: (composition: Composition) => void;
  compositionError: string | null;
  compositionIsValid: boolean;
  onCreate: () => void;
  onJoin: () => void;
  onStart: () => void;
}

export default function Lobby({
  name,
  code,
  setName,
  setCode,
  players,
  owner,
  phase,
  logs,
  isHost,
  composition,
  onCompositionChange,
  compositionError,
  compositionIsValid,
  onCreate,
  onJoin,
  onStart,
}: LobbyProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex items-start justify-between gap-4 rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-glow backdrop-blur-xl">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">One Night Werewolf</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Salon de jeu</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Crée ou rejoins une partie. Une fois les rôles distribués, l’hôte pourra lancer la nuit depuis la table de jeu.
          </p>
        </div>
        {isHost && phase === 'lobby' ? (
          <button
            type="button"
            onClick={onStart}
            disabled={players.length < 4 || !compositionIsValid}
            className="min-w-[160px] rounded-3xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            Préparer la partie
          </button>
        ) : null}
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-glow backdrop-blur-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              Pseudo
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
                placeholder="Ex : Alice"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              Code de la partie
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
                placeholder="ABCDE"
                maxLength={5}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onCreate}
              className="rounded-3xl bg-gradient-to-r from-violet-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:from-violet-400 hover:to-sky-400"
            >
              Créer une partie
            </button>
            <button
              type="button"
              onClick={onJoin}
              className="rounded-3xl border border-slate-700 bg-slate-950/90 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
            >
              Rejoindre une partie
            </button>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">État du salon</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-3xl bg-slate-900/80 p-4 text-sm text-slate-200">
                <p>
                  <span className="font-semibold">Code :</span> {code || 'N/A'}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Phase :</span> {phase}
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Hôte :</span> {owner || 'N/A'}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-900/80 p-4">
                <p className="text-sm font-semibold text-slate-100">Joueurs présents</p>
                <div className="mt-4 space-y-3">
                  {players.length > 0 ? (
                    players.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-100"
                      >
                        <span>{player.name}</span>
                        <span className="text-slate-500">{player.alive ? 'Actif' : 'Inactif'}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Aucun joueur pour le moment.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isHost && phase === 'lobby' && (
            <CompositionManager
              playerCount={players.length}
              isHost={isHost}
              composition={composition}
              onCompositionChange={onCompositionChange}
              validationError={compositionError}
            />
          )}
        </div>

        <aside className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-glow backdrop-blur-xl">
          <h2 className="text-xl font-semibold text-white">Journal du salon</h2>
          <div className="mt-5 max-h-[520px] space-y-3 overflow-auto pr-2 text-sm text-slate-300">
            {logs.length > 0 ? (
              logs.slice(-12).map((log, index) => (
                <p key={index} className="rounded-3xl bg-slate-950/90 px-4 py-3">
                  {log}
                </p>
              ))
            ) : (
              <p className="text-slate-500">Aucun message pour l’instant.</p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
