import powerbi from "powerbi-visuals-api";
import ISelectionId = powerbi.extensibility.ISelectionId

// Interface for structuring data
export interface ChartDataPoints {
    category: string,
    value: any,
    selectionID?: ISelectionId
}