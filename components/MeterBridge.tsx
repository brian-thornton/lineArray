import React, { useEffect, useRef, useState } from 'react';
import './MeterBridge.css';

const NUM_BARS = 16;
const METER_BAR_KEYS = Array.from({ length: NUM_BARS }, (_, i) => `meter-bar-${i}`);

export default function MeterBridge({ isPlaying }: { isPlaying: boolean }): JSX.Element {
  const [levels, setLevels] = useState(Array(NUM_BARS).fill(0));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setLevels(
          Array(NUM_BARS)
            .fill(0)
            .map(() => Math.floor(Math.random() * 100) + 1)
        );
      }, 80);
    } else {
      setLevels(Array(NUM_BARS).fill(0));
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="meter-bridge">
      {levels.map((level, i) => (
        <div
          key={METER_BAR_KEYS[i]}
          className="meter-bar"
          style={{ height: `${level}%` }}
        />
      ))}
    </div>
  );
} 