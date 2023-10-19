import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;

// importing interface for data structuring
import { ChartDataPoints } from "./interface"

// Essential imports dealing with visual development on the BI interface
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

// Method to format data for simple chart
export function parseSimpleChartData(dataViewSet: DataView, host: IVisualHost): ChartDataPoints[] {
    let visualChartDataPoints: ChartDataPoints[] = [];
    if (dataViewSet && dataViewSet.categorical) {
        const categories = dataViewSet.categorical.categories[0];
        const values = dataViewSet.categorical.values[0];
        if (categories && values) {
            // Return data in [{category:value}, {category:value}, ....] format
            for (let i = 0; i < Math.max(categories.values.length, values.values.length); i++) {
                visualChartDataPoints.push({
                    category: categories.values[i].toString(),
                    value: values.values[i],
                    selectionID: host.createSelectionIdBuilder()
                        .withCategory(categories, i)
                        .createSelectionId()
                });
            }
        }
    }
    return visualChartDataPoints;
}

// Method to format data for a simple chart with a legnd feature
export function parseLegendSimpleChartData(dataViewSet: DataView): ChartDataPoints[] {
    let visualChartDataPoints: ChartDataPoints[] = [];
    // generates [{"category":"", value:}, {"category":"", value:}, ...]
    if (dataViewSet && dataViewSet.categorical) {
        dataViewSet.categorical.values.forEach((value) => {
            visualChartDataPoints.push({
                category: value.source.groupName.toString(),
                value: value.values[0] as number
            });
        })

        return visualChartDataPoints;
    }
}

// Method to fornat data for stacked chart
export function parseStackedChartData(dataViewSet: DataView): ChartDataPoints[] {
    let visualChartDataPoints: ChartDataPoints[] = [];
    const categories = dataViewSet.categorical.categories[0].values;
    let categoryLegendDataPoints: ChartDataPoints[] = [];

    // convert data into [{"subcategory1":values[]}, {"subCategory2": values[]}, ...] format
    dataViewSet.categorical.values.grouped().forEach((value) => {
        categoryLegendDataPoints.push({
            category: value.name.toString(),
            value: value.values[0].values.map(value => value)
        })
    });

    // convert data into [{subCategory1: value}, {subcategory2: value}, ....] format
    let stackedSubCategoryDataPoints = categoryLegendDataPoints[0].value.map((_, index) => {
        const stack = {};
        let sum = 0;
        categoryLegendDataPoints.forEach(item => {
            stack[item.category] = item.value[index];
            sum += item.value[index]; // Calculate the sum
        });
        stack["sum"] = sum;
        return stack;
    });

    // convert data into [{category: values[{subcategory1: value}, {subcategory2:value}, ...]}, ...] format
    visualChartDataPoints = categories.map((category, i) => ({
        category: category.toString(),
        value: stackedSubCategoryDataPoints[i]
    }));

    return visualChartDataPoints;
}