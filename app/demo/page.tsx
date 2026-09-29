import { getDemoScenarios } from "@/lib/demo/scenarios";
import { KrineoWorkspace } from "@/components/krineo/workspace";

export default function DemoPage() {
  return <KrineoWorkspace scenarios={getDemoScenarios()} />;
}
