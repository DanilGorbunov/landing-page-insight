import { useState, useCallback } from "react";
import InputScreen from "@/components/InputScreen";
import ProgressScreen from "@/components/ProgressScreen";
import ReportScreen from "@/components/ReportScreen";

type Screen = "input" | "progress" | "report";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("input");
  const [url, setUrl] = useState("");

  const handleAnalyze = (inputUrl: string, _competitors: string[]) => {
    setUrl(inputUrl);
    setScreen("progress");
  };

  const handleComplete = useCallback(() => {
    setScreen("report");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {screen === "input" && <InputScreen onAnalyze={handleAnalyze} />}
      {screen === "progress" && <ProgressScreen url={url} onComplete={handleComplete} />}
      {screen === "report" && <ReportScreen url={url} />}
    </div>
  );
};

export default Index;
