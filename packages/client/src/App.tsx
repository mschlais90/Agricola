import { useGameStore } from './store/gameStore';
import { GameView } from './views/GameView';
import { LobbyView } from './views/LobbyView';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const state = useGameStore((s) => s.state);
  return screen === 'game' && state ? <GameView /> : <LobbyView />;
}
