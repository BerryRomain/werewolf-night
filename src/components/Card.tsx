import { useState, useEffect } from 'react';

// ── Inject swap animation CSS once ──
const SWAP_STYLE_ID = 'swap-anim-styles';
if (typeof document !== 'undefined' && !document.getElementById(SWAP_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = SWAP_STYLE_ID;
  style.textContent = `
    @keyframes swapFrom {
      0%   { transform: translateX(0)    translateY(0)     scale(1);    }
      25%  { transform: translateX(0)    translateY(-20px) scale(1.1);  }
      60%  { transform: translateX(50px) translateY(-20px) scale(1.1);  }
      85%  { transform: translateX(50px) translateY(0)     scale(1.05); }
      100% { transform: translateX(0)    translateY(0)     scale(1);    }
    }
    @keyframes swapTo {
      0%   { transform: translateX(0)     translateY(0)    scale(1);    }
      25%  { transform: translateX(0)     translateY(20px) scale(1.1);  }
      60%  { transform: translateX(-50px) translateY(20px) scale(1.1);  }
      85%  { transform: translateX(-50px) translateY(0)    scale(1.05); }
      100% { transform: translateX(0)     translateY(0)    scale(1);    }
    }
    .swap-anim-from {
      animation: swapFrom 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      position: relative;
      z-index: 20;
    }
    .swap-anim-to {
      animation: swapTo 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      position: relative;
      z-index: 20;
    }
  `;
  document.head.appendChild(style);
}

interface CardProps {
  title: string;
  subtitle?: string;
  faceUp?: boolean;
  label?: string;
  className?: string;
  onClick?: () => void;
  isClickable?: boolean;
}

// ✅ PNG dans public/cartes/
const CARDS_BASE_PATH = '/cartes/';

function getRoleImagePath(roleName: string): string {
  const nameMap: Record<string, string> = {
    'Loup Garou':   'loup-garou',
    'Franc-Maçon':  'franc-macon',
    'Soûlard':      'soulard',
    'Doppelgänger': 'doppelganger',
    'Noiseuse':     'noiseuse',
    'Voleur':       'voleur',
    'Insomniaque':  'insomniaque',
    'Villageois':   'villageois',
    'Chasseur':     'chasseur',
    'Voyante':      'voyante',
    'Sbire':        'sbire',
    'Tanneur':      'tanneur',
  };
  const fileName = nameMap[roleName];
  if (!fileName) return '';
  return `${CARDS_BASE_PATH}${fileName}.png`;
}

const CARD_W = 120;
const CARD_H = 168;

function CardFace({
  src,
  alt,
  label,
  clickable,
  fallbackText,
}: {
  src: string;
  alt: string;
  label?: string;
  clickable: boolean;
  fallbackText: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = Boolean(src) && !imgFailed;

  return (
    <div
      className={`relative w-full h-full rounded-xl overflow-hidden transition-all duration-200 ${
        clickable
          ? 'hover:ring-2 hover:ring-sky-400 hover:shadow-[0_0_18px_4px_rgba(56,189,248,0.4)]'
          : 'opacity-60'
      }`}
    >
      {hasImage ? (
        <img
          src={src}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-xl">
          <span className="text-slate-100 text-sm font-bold text-center px-2">{fallbackText}</span>
        </div>
      )}
      {label && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-1 px-1">
          <p className="text-center text-[9px] font-bold text-white/80 uppercase tracking-widest leading-tight truncate">
            {label}
          </p>
        </div>
      )}
      {clickable && (
        <div className="absolute inset-0 rounded-xl border-2 border-sky-400/0 group-hover:border-sky-400/50 transition-all duration-200 pointer-events-none" />
      )}
    </div>
  );
}

export default function Card({
  title,
  subtitle,
  faceUp = false,
  label,
  className = '',
  onClick,
  isClickable,
}: CardProps) {
  const clickable = Boolean(isClickable);

  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`group flex flex-col items-center ${clickable ? 'cursor-pointer' : ''} ${className}`}
    >
      <div style={{ perspective: '800px', width: CARD_W, height: CARD_H, flexShrink: 0 }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.55s cubic-bezier(0.45, 0.05, 0.55, 0.95)',
            transform: faceUp ? 'rotateY(180deg)' : 'rotateY(0deg)',
            position: 'relative',
          }}
        >
          {/* ── DOS ── */}
          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>
            <CardFace
              src={`${CARDS_BASE_PATH}dos-carte.png`}
              alt="Dos de carte"
              label={label}
              clickable={clickable}
              fallbackText="?"
            />
          </div>

          {/* ── FACE RÔLE ── */}
          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}>
            <CardFace
              src={getRoleImagePath(title)}
              alt={title}
              label={label}
              clickable={clickable}
              fallbackText={title}
            />
          </div>
        </div>
      </div>

      {subtitle && (
        <p className="mt-2 text-center text-sm font-semibold text-slate-300 truncate" style={{ maxWidth: CARD_W }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
