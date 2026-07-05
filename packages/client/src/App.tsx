import { ENGINE_VERSION } from '@agricola/engine';

export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-800">Agricola</h1>
        <p className="mt-2 text-stone-500">engine v{ENGINE_VERSION} — scaffold OK</p>
      </div>
    </div>
  );
}
