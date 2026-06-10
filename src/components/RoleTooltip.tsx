import { NIGHT_ROLES } from '../constants/roles';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface RolePowerInfo {
  description: string;
  power: string;
}

interface RoleTooltipProps {
  role: string;
  rolePowerInfo: Record<string, RolePowerInfo>;
}

export default function RoleTooltip({ role, rolePowerInfo }: RoleTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const info = rolePowerInfo[role];

  const getActivePhase = (roleName: string): string => {
    if (NIGHT_ROLES.includes(roleName)) {
      if (roleName === 'Villageois' || roleName === 'Chasseur') return 'Journée / Vote';
      return 'Nuit';
    }
    return 'Journée / Vote';
  };

  const activePhase = getActivePhase(role);

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const tooltipWidth = 320;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
      const top = rect.bottom + 10;
      setTooltipPos({ top, left });
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  if (!info) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 shadow-sm text-center">
        {role}
      </div>
    );
  }

  const tooltip = showTooltip && tooltipPos ? (
    <div
      className="fixed w-80 rounded-2xl border border-slate-600 bg-slate-900 p-4 text-slate-100 shadow-2xl"
      style={{
        top: `${tooltipPos.top}px`,
        left: `${tooltipPos.left}px`,
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      {/* Flèche pointant vers le haut */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-t border-l border-slate-600 bg-slate-900" />

      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">{role}</p>
        <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
          Actif : <span className="text-amber-300">{activePhase}</span>
        </p>
      </div>

      <div className="my-3 h-px bg-slate-700" />

      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.15em] text-slate-400 mb-1">Description</p>
        <p className="text-xs text-slate-300 leading-relaxed">{info.description}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-slate-400 mb-1">Pouvoir</p>
        <p className="text-xs text-slate-300 leading-relaxed">{info.power}</p>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 shadow-sm cursor-help transition hover:border-slate-600 hover:bg-slate-950/95 text-center"
      >
        {role}
      </div>
      {createPortal(tooltip, document.body)}
    </>
  );
}
