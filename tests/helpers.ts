import { emptyState, normalize } from '../src/state';
import type { State } from '../src/types';

/** Estado de prueba con datos inventados. Arranque del período el 27 y dólar a 1000. */
export function mkState(over: Partial<State> = {}): State {
  return normalize({ ...emptyState(), rate: 1000, startDay: 27, ...over });
}
