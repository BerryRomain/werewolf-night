interface RoleInfoProps {
  role: string;
  rolePower?: {
    description: string;
    power: string;
  };
}

export default function RoleInfo({ role, rolePower }: RoleInfoProps) {
  if (!role || !rolePower) {
    return null;
  }

  return (
    <div className="rounded-[32px] border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-glow backdrop-blur-xl">
      <p className="text-sm uppercase tracking-[0.3em] text-emerald-300 font-semibold">Ton rôle</p>
      <h2 className="mt-4 text-3xl font-bold text-emerald-100">{role}</h2>
      
      <div className="mt-6 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-semibold">Description</p>
          <p className="mt-2 text-base leading-relaxed text-emerald-50">
            {rolePower.description}
          </p>
        </div>
        
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 font-semibold">Pouvoirs</p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-100 font-medium">
            {rolePower.power}
          </p>
        </div>
      </div>
    </div>
  );
}
