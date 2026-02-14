import "./App.css";
import Dashboard from "./components/dashboard";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";

function App() {
  return (
    <div className="relative min-h-screen">
      <DottedGlowBackground
        className="pointer-events-none"
        color="rgba(12, 18, 24, 0.88)"
        darkColor="rgba(12, 18, 24, 0.88)"
        glowColor="rgba(59, 130, 246, 0.55)"
        darkGlowColor="rgba(59, 130, 246, 0.55)"
        glowColorSecondary="rgba(14, 165, 233, 0.35)"
        opacity={0.78}
        glowBlur={12}
        smoothPulse
      />
      <div className="relative z-10">
        <Dashboard />
        <div className="min-h-[80vh]" />
      </div>
    </div>
  );
}

export default App;
