import type { GameAction, GameState, PlayerId } from '@agricola/engine';

/**
 * The UI is transport-agnostic: hot-seat/solo run the engine in the browser
 * (LocalTransport), networked play talks to the server (WsTransport, M3).
 */
export interface Transport {
  readonly mode: 'local' | 'ws';
  /** Seats this client controls ('all' for hot-seat). */
  readonly seats: PlayerId[] | 'all';
  submit(action: GameAction): void;
  /** Subscribe to state updates; fires immediately with the current state. */
  onState(cb: (seq: number, state: GameState) => void): () => void;
  onError(cb: (message: string) => void): () => void;
  dispose(): void;
}
