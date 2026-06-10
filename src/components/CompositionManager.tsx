import { useState, useEffect } from 'react';
import { ROLE_CAMPS, CAMP_LABELS, CAMP_CLASSES } from '../constants/roleCamps';

interface Composition {
  [key: string]: number;
}

interface CompositionManagerProps {
  playerCount: number;
  isHost: boolean;
  composition: Composition;
  onCompositionChange: (composition: Composition) => void;
  validationError: string | null;
}

export default function CompositionManager({
  playerCount,
  isHost,
  composition,
  onCompositionChange,
  validationError,
}: CompositionManagerProps) {
  const [localComposition, setLocalComposition] = useState<Composition>(composition);

  useEffect(() => {
    setLocalComposition(composition);
  }, [composition]);

  const requiredCards = playerCount + 3;
  const totalCards = Object.values(localComposition).reduce((sum, count) => sum + (count || 0), 0);
  const isValid = totalCards === requiredCards && !validationError;

  const roles = [
    'Doppelgänger',
    'Loup Garou',
    'Noiseuse',
    'Voleur',
    'Soûlard',
    'Insomniaque',
    'Villageois',
    'Chasseur',
    'Voyante',
    'Sbire',
    'Franc-Maçon',
    'Tanneur',
  ];

  const roleDescriptions: Record<string, string> = {
    'Doppelgänger': 'Copie le rôle d\'un joueur et le joue pour toute la partie (max 1)',
    'Loup Garou': 'Rôle : Loup Garou',
    'Noiseuse': 'Rôle : Noiseuse (1 seul)',
    'Voleur': 'Rôle : Voleur (1 seul)',
    'Soûlard': 'Rôle : Soûlard (1 seul)',
    'Insomniaque': 'Rôle : Insomniaque (1 seul)',
    'Villageois': 'Rôle : Villageois',
    'Chasseur': 'Rôle : Chasseur (tire avant révélation)',
    'Voyante': 'Rôle : Voyante (voit 1 joueur OU 2 cartes centre)',
    'Sbire': 'Rôle : Sbire (allié des loups, connaît les loups)',
    'Franc-Maçon': 'Rôle : Franc-Maçon (toujours 2, équipe village)',
    'Tanneur': 'Rôle : Tanneur (gagne seul s\'il meurt)',
  };

  const handleCountChange = (role: string, newCount: number) => {
    if (!isHost) return;
    const count = Math.max(0, Math.min(newCount, requiredCards));
    const updated = { ...localComposition, [role]: count };
    setLocalComposition(updated);
    onCompositionChange(updated);
  };

  const handleIncrement = (role: string) => {
    const current = localComposition[role] || 0;
    if (role === 'Franc-Maçon') {
      handleCountChange(role, current === 0 ? 2 : current + 2);
    } else if (role === 'Doppelgänger') {
      handleCountChange(role, Math.min(1, current + 1));
    } else {
      handleCountChange(role, current + 1);
    }
  };

  const handleDecrement = (role: string) => {
    const current = localComposition[role] || 0;
    if (role === 'Franc-Maçon') {
      handleCountChange(role, Math.max(0, current - 2));
    } else {
      handleCountChange(role, current - 1);
    }
  };

  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-glow backdrop-blur-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Composition de la partie</h2>
        <p className="mt-2 text-sm text-slate-400">
          Total de cartes requises :{' '}
          <span className={isValid ? 'text-emerald-400' : 'text-red-400'}>
            {totalCards} / {requiredCards}
          </span>
        </p>
      </div>

      {validationError && (
        <div className="mb-4 rounded-3xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {validationError}
        </div>
      )}

      <div className="space-y-3">
        {roles.map((role) => {
          const count = localComposition[role] || 0;
          const isDoppel = role === 'Doppelgänger';

          return (
            <div
              key={role}
              className={`flex items-center justify-between rounded-3xl border px-4 py-3 ${isDoppel ? 'border-violet-700/50 bg-violet-950/30' : 'border-slate-700 bg-slate-950/90'}`}
            >
                  <div className="flex-1">
                    {(() => {
                      const camp = (ROLE_CAMPS as Record<string, string>)[role] || 'village';
                      const label = (CAMP_LABELS as Record<string, string>)[camp];
                      const cls = (CAMP_CLASSES as Record<string, string>)[camp];
                      return (
                        <>
                          <p className={`text-sm font-semibold ${isDoppel ? 'text-violet-200' : 'text-slate-100'}`}>
                            {role}
                            <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
                              {label}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500">{roleDescriptions[role]}</p>
                        </>
                      );
                    })()}
                  </div>

              <div className="flex items-center gap-3">
                {isHost ? (
                  <>
                    <button
                      onClick={() => handleDecrement(role)}
                      disabled={count === 0}
                      className="rounded-2xl border border-slate-700 px-3 py-1 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={role === 'Doppelgänger' ? 1 : requiredCards}
                      value={count}
                      onChange={(e) => handleCountChange(role, parseInt(e.target.value) || 0)}
                      className="w-12 rounded-2xl border border-slate-700 bg-slate-950/90 px-2 py-1 text-center text-sm text-slate-100 outline-none"
                    />
                    <button
                      onClick={() => handleIncrement(role)}
                      disabled={
                        (totalCards >= requiredCards && count === (localComposition[role] || 0)) ||
                        (role === 'Doppelgänger' && count >= 1)
                      }
                      className="rounded-2xl border border-slate-700 px-3 py-1 text-sm font-semibold text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </>
                ) : (
                  <span className="min-w-[40px] text-center text-sm font-semibold text-slate-100">{count}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isHost && (
        <div className="mt-4 rounded-3xl border border-sky-500/50 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
          Seul l'hôte peut modifier la composition
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-950/90 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Résumé</p>
        <div className="mt-3 space-y-2">
          {roles.map((role) => {
            const count = localComposition[role] || 0;
            if (count <= 0) return null;
            const camp = (ROLE_CAMPS as Record<string, string>)[role] || 'village';
            const label = (CAMP_LABELS as Record<string, string>)[camp];
            const cls = (CAMP_CLASSES as Record<string, string>)[camp];
            return (
              <p key={role} className="text-sm text-slate-300">
                <span className="font-semibold">{count}x</span> {role}
                <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
                  {label}
                </span>
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
