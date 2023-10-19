// Importing Visuals API 
import powerbi from "powerbi-visuals-api";

// Importing Selection Utils
import ISelectionId = powerbi.extensibility.ISelectionId

// Interface for structuring data
export interface ChartDataPoints {
    category: string,
    value: any,
    selectionID?: ISelectionId
}