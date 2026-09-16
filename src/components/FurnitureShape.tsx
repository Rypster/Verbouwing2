import React from 'react';
import { FurnitureItem, FurnitureType } from '../types';

interface FurnitureShapeProps {
  item: {
    type: FurnitureType;
    label?: string;
    widthMeters: number;
    lengthMeters: number;
  };
  scalePxPerMeter: number;
  isSelected?: boolean;
  isGhost?: boolean;
}

export const FurnitureShape: React.FC<FurnitureShapeProps> = ({
  item,
  scalePxPerMeter,
  isSelected = false,
  isGhost = false,
}) => {
  const widthPx = Math.max(12, item.widthMeters * scalePxPerMeter);
  const lengthPx = Math.max(12, item.lengthMeters * scalePxPerMeter);

  const strokeColor = isSelected ? '#f59e0b' : isGhost ? '#38bdf8' : '#64748b';
  const fillColor = isGhost ? 'rgba(15, 23, 42, 0.75)' : '#0f172a';
  const accentColor = isSelected ? '#fbbf24' : '#94a3b8';

  const renderContent = () => {
    switch (item.type) {
      case 'bed': {
        const headboardThick = Math.max(5, 0.10 * scalePxPerMeter);
        const pillowW = Math.min(widthPx / 2.2, 0.70 * scalePxPerMeter);
        const pillowH = Math.min(lengthPx / 4, 0.40 * scalePxPerMeter);
        const pillowY = -lengthPx / 2 + headboardThick + 0.04 * scalePxPerMeter;
        const duvetY = -lengthPx / 2 + headboardThick + pillowH + 0.15 * scalePxPerMeter;
        const duvetHeight = Math.max(10, lengthPx / 2 - duvetY - 2);
        const isSingleBed = item.widthMeters < 1.15;

        return (
          <>
            {/* Main mattress */}
            <rect
              x={-widthPx / 2}
              y={-lengthPx / 2}
              width={widthPx}
              height={lengthPx}
              rx="4"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? '2' : '1.5'}
            />
            {/* Headboard */}
            <rect
              x={-widthPx / 2}
              y={-lengthPx / 2}
              width={widthPx}
              height={headboardThick}
              rx="2"
              fill="#334155"
              stroke={strokeColor}
              strokeWidth="1"
            />
            {/* Pillows */}
            {isSingleBed ? (
              <rect
                x={-pillowW / 2}
                y={pillowY}
                width={pillowW}
                height={pillowH}
                rx="3"
                fill="#1e293b"
                stroke="#94a3b8"
                strokeWidth="1"
              />
            ) : (
              <>
                <rect
                  x={-widthPx / 2 + Math.max(4, widthPx * 0.06)}
                  y={pillowY}
                  width={pillowW}
                  height={pillowH}
                  rx="3"
                  fill="#1e293b"
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <rect
                  x={widthPx / 2 - Math.max(4, widthPx * 0.06) - pillowW}
                  y={pillowY}
                  width={pillowW}
                  height={pillowH}
                  rx="3"
                  fill="#1e293b"
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
              </>
            )}
            {/* Duvet / Dekbed */}
            {duvetHeight > 10 && (
              <>
                <rect
                  x={-widthPx / 2 + 2}
                  y={duvetY}
                  width={widthPx - 4}
                  height={duvetHeight}
                  rx="3"
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth="1"
                />
                <rect
                  x={-widthPx / 2 + 2}
                  y={duvetY}
                  width={widthPx - 4}
                  height={Math.min(14, Math.max(6, 0.12 * scalePxPerMeter))}
                  rx="2"
                  fill="#334155"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />
              </>
            )}
          </>
        );
      }

      case 'shower': {
        // Inloopdouche with floor slope lines, shower head, linear drain, and glass partition
        const glassSide = widthPx;
        const drainW = Math.max(20, widthPx * 0.7);
        const drainH = Math.max(6, 0.08 * scalePxPerMeter);
        const showerHeadR = Math.max(6, 0.12 * scalePxPerMeter);

        return (
          <>
            {/* Shower tray / floor area */}
            <rect
              x={-widthPx / 2}
              y={-lengthPx / 2}
              width={widthPx}
              height={lengthPx}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? '2' : '1.5'}
            />
            {/* Subtle water slope diagonal guide lines */}
            <line
              x1={-widthPx / 2}
              y1={-lengthPx / 2}
              x2={0}
              y2={-lengthPx / 2 + 20}
              stroke="#334155"
              strokeWidth="0.6"
              strokeDasharray="2,2"
            />
            <line
              x1={widthPx / 2}
              y1={-lengthPx / 2}
              x2={0}
              y2={-lengthPx / 2 + 20}
              stroke="#334155"
              strokeWidth="0.6"
              strokeDasharray="2,2"
            />
            {/* Linear drain / douchegoot */}
            <rect
              x={-drainW / 2}
              y={-lengthPx / 2 + Math.max(8, 0.10 * scalePxPerMeter)}
              width={drainW}
              height={drainH}
              rx="2"
              fill="#1e293b"
              stroke="#94a3b8"
              strokeWidth="1"
            />
            {/* Drain grating slots */}
            <line
              x1={-drainW / 2 + 4}
              y1={-lengthPx / 2 + Math.max(8, 0.10 * scalePxPerMeter) + drainH / 2}
              x2={drainW / 2 - 4}
              y2={-lengthPx / 2 + Math.max(8, 0.10 * scalePxPerMeter) + drainH / 2}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="3,2"
            />
            {/* Overhead rain shower circle */}
            <circle
              cx={0}
              cy={0}
              r={showerHeadR}
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            <circle
              cx={0}
              cy={0}
              r={Math.max(2, showerHeadR * 0.4)}
              fill="#38bdf8"
            />
            {/* Glass partition line on right edge (Glazen inloopwand) */}
            <line
              x1={widthPx / 2}
              y1={-lengthPx / 2}
              x2={widthPx / 2}
              y2={lengthPx / 2 - Math.max(15, 0.35 * scalePxPerMeter)}
              stroke="#38bdf8"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Glass clamp brackets */}
            <rect
              x={widthPx / 2 - 2}
              y={-lengthPx / 2 + 10}
              width="4"
              height="8"
              fill="#cbd5e1"
            />
            <rect
              x={widthPx / 2 - 2}
              y={lengthPx / 2 - Math.max(20, 0.45 * scalePxPerMeter)}
              width="4"
              height="8"
              fill="#cbd5e1"
            />
            {/* Open entrance marker text */}
            <text
              x={widthPx / 2 - 4}
              y={lengthPx / 2 - 6}
              textAnchor="end"
              fill="#38bdf8"
              fontSize="7.5"
              fontWeight="600"
            >
              inloop ▶
            </text>
          </>
        );
      }

      case 'toilet': {
        // WC: Inbouwreservoir (top) + bowl/seat (bottom)
        const cisternH = Math.max(10, lengthPx * 0.28);
        const bowlH = lengthPx - cisternH;
        const bowlW = widthPx * 0.85;

        return (
          <>
            {/* Inbouwreservoir (achterwand) */}
            <rect
              x={-widthPx / 2}
              y={-lengthPx / 2}
              width={widthPx}
              height={cisternH}
              rx="2"
              fill="#334155"
              stroke={strokeColor}
              strokeWidth="1.2"
            />
            {/* Dual flush plate (Bedieningsplaat) */}
            <rect
              x={-widthPx * 0.25}
              y={-lengthPx / 2 + cisternH / 2 - 3}
              width={widthPx * 0.5}
              height="6"
              rx="1.5"
              fill="#0f172a"
              stroke="#94a3b8"
              strokeWidth="0.8"
            />
            <line
              x1={0}
              y1={-lengthPx / 2 + cisternH / 2 - 3}
              x2={0}
              y2={-lengthPx / 2 + cisternH / 2 + 3}
              stroke="#94a3b8"
              strokeWidth="0.8"
            />
            {/* Toilet bowl outer shape */}
            <path
              d={`M ${-bowlW / 2} ${-lengthPx / 2 + cisternH}
                  L ${bowlW / 2} ${-lengthPx / 2 + cisternH}
                  C ${bowlW / 2} ${lengthPx / 2 - bowlH * 0.1}, ${bowlW * 0.4} ${lengthPx / 2}, 0 ${lengthPx / 2}
                  C ${-bowlW * 0.4} ${lengthPx / 2}, ${-bowlW / 2} ${lengthPx / 2 - bowlH * 0.1}, ${-bowlW / 2} ${-lengthPx / 2 + cisternH}
                  Z`}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? '2' : '1.5'}
            />
            {/* Inner rim / toiletbril */}
            <ellipse
              cx={0}
              cy={-lengthPx / 2 + cisternH + bowlH * 0.52}
              rx={bowlW * 0.32}
              ry={bowlH * 0.38}
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="1"
            />
            {/* Drain center */}
            <circle
              cx={0}
              cy={-lengthPx / 2 + cisternH + bowlH * 0.45}
              r={Math.max(2.5, bowlW * 0.08)}
              fill="#334155"
            />
          </>
        );
      }

      case 'bath': {
        // Ligbad: Outer rectangle + inner contoured tub with slope and faucet
        const rim = Math.max(6, 0.08 * scalePxPerMeter);
        const innerW = widthPx - rim * 2;
        const innerL = lengthPx - rim * 2;
        const tapY = -lengthPx / 2 + rim / 2;

        return (
          <>
            {/* Outer tub frame */}
            <rect
              x={-widthPx / 2}
              y={-lengthPx / 2}
              width={widthPx}
              height={lengthPx}
              rx="6"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? '2' : '1.5'}
            />
            {/* Inner ergonomic basin */}
            <rect
              x={-innerW / 2}
              y={-innerL / 2}
              width={innerW}
              height={innerL}
              rx={Math.min(innerW / 2, 24)}
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="1.2"
            />
            {/* Sloping backrest contour lines */}
            <path
              d={`M ${-innerW * 0.38} ${innerL / 2 - 8}
                  C ${-innerW * 0.3} ${innerL / 2 - 20}, ${innerW * 0.3} ${innerL / 2 - 20}, ${innerW * 0.38} ${innerL / 2 - 8}`}
              fill="none"
              stroke="#475569"
              strokeWidth="1"
            />
            {/* Faucet / Kraan */}
            <circle
              cx={0}
              cy={tapY}
              r="4"
              fill="#38bdf8"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            <line
              x1={0}
              y1={tapY}
              x2={0}
              y2={tapY + 8}
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Drain plug / afvoerputje */}
            <circle
              cx={0}
              cy={-innerL / 2 + 16}
              r="4"
              fill="#475569"
              stroke="#94a3b8"
              strokeWidth="1"
            />
          </>
        );
      }

      case 'sink': {
        // Wasbak / Wastafelmeubel with single or double basin
        const isDouble = item.widthMeters >= 1.15;
        const basinRim = Math.max(5, 0.05 * scalePxPerMeter);

        return (
          <>
            {/* Countertop / meubel */}
            <rect
              x={-widthPx / 2}
              y={-lengthPx / 2}
              width={widthPx}
              height={lengthPx}
              rx="4"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? '2' : '1.5'}
            />
            {/* Basin(s) */}
            {isDouble ? (
              <>
                {/* Left basin */}
                <rect
                  x={-widthPx / 2 + basinRim}
                  y={-lengthPx / 2 + basinRim + 4}
                  width={widthPx / 2 - basinRim * 1.5}
                  height={lengthPx - basinRim * 2 - 6}
                  rx="6"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                {/* Left tap */}
                <circle
                  cx={-widthPx / 4}
                  y={-lengthPx / 2 + basinRim + 1}
                  r="3.5"
                  fill="#38bdf8"
                />
                {/* Right basin */}
                <rect
                  x={basinRim * 0.5}
                  y={-lengthPx / 2 + basinRim + 4}
                  width={widthPx / 2 - basinRim * 1.5}
                  height={lengthPx - basinRim * 2 - 6}
                  rx="6"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                {/* Right tap */}
                <circle
                  cx={widthPx / 4}
                  y={-lengthPx / 2 + basinRim + 1}
                  r="3.5"
                  fill="#38bdf8"
                />
              </>
            ) : (
              <>
                {/* Single basin */}
                <rect
                  x={-widthPx / 2 + basinRim}
                  y={-lengthPx / 2 + basinRim + 4}
                  width={widthPx - basinRim * 2}
                  height={lengthPx - basinRim * 2 - 6}
                  rx="6"
                  fill="#1e293b"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                {/* Center tap */}
                <circle
                  cx={0}
                  y={-lengthPx / 2 + basinRim + 1}
                  r="3.5"
                  fill="#38bdf8"
                />
                <line
                  x1={0}
                  y1={-lengthPx / 2 + basinRim + 1}
                  x2={0}
                  y2={-lengthPx / 2 + basinRim + 8}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                />
                {/* Drain hole */}
                <circle
                  cx={0}
                  cy={0}
                  r="3"
                  fill="#475569"
                  stroke="#94a3b8"
                  strokeWidth="0.8"
                />
              </>
            )}
          </>
        );
      }

      case 'desk': {
        // Bureau / Werkplek with desk pad, screen/laptop, and office chair
        const chairR = Math.max(8, 0.22 * scalePxPerMeter);
        const screenW = Math.min(widthPx * 0.55, 0.65 * scalePxPerMeter);

        return (
          <>
            {/* Desktop surface */}
            <rect
              x={-widthPx / 2}
              y={-lengthPx / 2}
              width={widthPx}
              height={lengthPx}
              rx="4"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isSelected ? '2' : '1.5'}
            />
            {/* Desk pad / Bureau onderlegger */}
            <rect
              x={-widthPx * 0.35}
              y={-lengthPx * 0.25}
              width={widthPx * 0.7}
              height={lengthPx * 0.55}
              rx="2"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="1"
            />
            {/* Computer Screen / Monitor */}
            <rect
              x={-screenW / 2}
              y={-lengthPx / 2 + Math.max(4, 0.08 * scalePxPerMeter)}
              width={screenW}
              height={Math.max(4, 0.05 * scalePxPerMeter)}
              rx="1.5"
              fill="#38bdf8"
              stroke="#0284c7"
              strokeWidth="0.8"
            />
            {/* Screen base stand */}
            <rect
              x={-screenW * 0.2}
              y={-lengthPx / 2 + Math.max(4, 0.08 * scalePxPerMeter) + 5}
              width={screenW * 0.4}
              height="3"
              rx="1"
              fill="#94a3b8"
            />
            {/* Cable grommet */}
            <circle
              cx={widthPx / 2 - Math.max(8, 0.12 * scalePxPerMeter)}
              cy={-lengthPx / 2 + Math.max(8, 0.12 * scalePxPerMeter)}
              r="3.5"
              fill="#334155"
              stroke="#64748b"
              strokeWidth="0.8"
            />
            {/* Bureaustoel zitting en rugleuning (Office chair tucked under desk) */}
            <ellipse
              cx={0}
              cy={lengthPx / 2 + chairR * 0.3}
              rx={chairR * 0.9}
              ry={chairR * 0.7}
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="1.2"
            />
            {/* Chair backrest */}
            <path
              d={`M ${-chairR * 0.8} ${lengthPx / 2 + chairR * 0.9}
                  C ${-chairR * 0.5} ${lengthPx / 2 + chairR * 1.1}, ${chairR * 0.5} ${lengthPx / 2 + chairR * 1.1}, ${chairR * 0.8} ${lengthPx / 2 + chairR * 0.9}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        );
      }
    }
  };

  return (
    <g>
      {renderContent()}

      {/* Label and dimensions */}
      <text
        x="0"
        y={lengthPx * 0.1}
        textAnchor="middle"
        fill={accentColor}
        fontSize={Math.min(10, Math.max(7, widthPx / 11))}
        fontWeight="bold"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {item.label || item.type}
      </text>
      <text
        x="0"
        y={lengthPx * 0.1 + Math.min(11, Math.max(8, widthPx / 10))}
        textAnchor="middle"
        fill={isSelected ? '#fde68a' : '#64748b'}
        fontSize={Math.min(8.5, Math.max(6, widthPx / 13))}
        fontWeight="600"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {(item.widthMeters * 100).toFixed(0)} × {(item.lengthMeters * 100).toFixed(0)} cm
      </text>
    </g>
  );
};
