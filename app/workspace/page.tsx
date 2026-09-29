import { KrineoWorkspace } from "@/components/krineo/workspace";
import { getDemoScenarios } from "@/lib/demo/scenarios";

export default function WorkspacePage() {
  return <KrineoWorkspace scenarios={getDemoScenarios()} />;
}
