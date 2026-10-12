import { MobileRuntime } from "./mobile";
import WorldGame from "./world/ui/WorldGame";

export default function App() {
  return (
    <MobileRuntime>
      <WorldGame />
    </MobileRuntime>
  );
}
