// Hook for the social wall: fetches the list of saves for this game from
// the Aigram platform — the same endpoint useGameSave uses to load one's
// own save, but here we keep ALL 6 entries (not just the current user's).
//
// The platform returns the 6 most-recent users' latest save per game UUID.
// Each row is { user_id, time, resource_data } where resource_data is a
// JSON-stringified StorySave.
//
// We sort by time desc, parse the JSON safely (skip corrupted rows), and
// return them as wall entries.

import { useEffect, useState } from 'react';
import {
  callAigramAPI,
  isInAigram,
  getGameUuid,
  type AigramResponse,
} from '@shared/runtime';
import type { StorySave } from '../TapAndTell';

export interface WallEntry extends StorySave {
  user_id: string;
}

interface SaveRow {
  user_id: string;
  time: string;
  resource_data: string;
}

export function useWallEntries(): {
  entries: WallEntry[];
  loaded: boolean;
  refresh: () => void;
} {
  const [entries, setEntries] = useState<WallEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const sessionId = getGameUuid();
    if (!isInAigram || !sessionId) {
      // Outside Aigram (local preview etc) — show empty wall, demo mode
      setEntries([]);
      setLoaded(true);
      return;
    }
    (async () => {
      try {
        const res = await callAigramAPI<AigramResponse<SaveRow[]>>(
          `/note/aigram/ai/game/get/data/list?session_id=${encodeURIComponent(sessionId)}`,
          'GET',
        );
        const rows: SaveRow[] = Array.isArray(res?.data) ? res.data : [];
        const parsed: WallEntry[] = [];
        for (const r of rows) {
          if (!r.resource_data) continue;
          try {
            const story = JSON.parse(r.resource_data) as StorySave;
            if (story.video_url && story.a_url) {
              parsed.push({ ...story, user_id: r.user_id });
            }
          } catch {
            // skip corrupted save
          }
        }
        // Sort by ts desc (most recent first); fall back to row.time
        parsed.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
        if (!cancelled) {
          setEntries(parsed);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
          setLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  return {
    entries,
    loaded,
    refresh: () => setTick(t => t + 1),
  };
}
