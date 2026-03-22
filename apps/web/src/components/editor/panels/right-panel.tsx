import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertiesPanel } from "./properties";
import { EnhancePanel } from "./enhance";

export function RightPanel() {
	return (
		<div className="panel bg-background flex size-full min-h-0 min-w-0 flex-col rounded-sm border">
			<Tabs defaultValue="properties" className="flex h-full w-full flex-col">
				<TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 px-2 shrink-0 space-x-1">
					<TabsTrigger
						value="properties"
						className="data-[state=active]:bg-muted/50 h-7 rounded-sm px-3 text-xs"
					>
						Properties
					</TabsTrigger>
					<TabsTrigger
						value="enhance"
						className="data-[state=active]:bg-muted/50 h-7 rounded-sm px-3 text-xs"
					>
						Enhance
					</TabsTrigger>
				</TabsList>
				<div className="flex-1 min-h-0 overflow-y-auto">
					<TabsContent value="properties" className="m-0 h-full outline-none">
						<PropertiesPanel />
					</TabsContent>
					<TabsContent value="enhance" className="m-0 h-full outline-none">
						<EnhancePanel />
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
