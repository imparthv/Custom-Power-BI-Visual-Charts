import { valueFormatter } from "powerbi-visuals-utils-formattingutils";

export function getFormattedValue(Quantity: number): string {
    let value: string;
    // Formatting values
    if (Quantity >= 1000000000) {
        value = valueFormatter.create({ value: 1e9 }).format(Quantity);
    }
    else if (Quantity >= 1000000) {
        value = valueFormatter.create({ value: 1e6 }).format(Quantity);
    }

    else if (Quantity >= 1000) {
        value = valueFormatter.create({ value: 1001 }).format(Quantity);
    }
    
    else {
        value = Quantity.toString();
    }
    return value;
}