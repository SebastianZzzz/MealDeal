"use client";

import { useEffect, useState } from "react";

export function useSaved<T>(load: () => T | null) {
  const [state, setState] = useState<{ loaded: boolean; value: T | null }>({ loaded: false, value: null });
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setState({ loaded: true, value: load() });
      }
    });
    return () => { active = false; };
  }, [load]);
  return state;
}
