import { getDemoScenarios } from "@/lib/demo/scenarios";
import { KrineoWorkspace } from "@/components/krineo/workspace";

export default function Home() {
  return <KrineoWorkspace scenarios={getDemoScenarios()} />;
}
