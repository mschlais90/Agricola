import { useGameStore } from './store/gameStore';
import { GameView } from './views/GameView';
import { LobbyView } from './views/LobbyView';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  // GameView renders the networked waiting room itself while `state` is still
  // null (online host/join before every seat is filled), so don't gate on state
  // here — doing so bounced hosts straight back to the lobby.
  return screen === 'game' ? <GameView /> : <LobbyView />;
}
