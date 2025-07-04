import React, { useEffect, useRef, useState } from 'react';
import './MeterBridge.css';

const NUM_BARS = 20;
const BLOCKS_PER_BAR = 10;

export default function MeterBridge({ isPlaying }: { isPlaying: boolean }) {
  const [levels, setLevels] = useState(Array(NUM_BARS).fill(0));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setLevels(
          Array(NUM_BARS)
            .fill(0)
            .map(() => Math.floor(Math.random() * (BLOCKS_PER_BAR + 1)))
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
        <div key={i} className="meter-bar wide">
          {Array.from({ length: BLOCKS_PER_BAR }).map((_, j) => (
            <div
              key={j}
              className={`meter-block${j < level ? ' filled' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
} 