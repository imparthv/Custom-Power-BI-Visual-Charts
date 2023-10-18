"use strict";

import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;

// Importing utils to work with the properties pane for visual
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

// Importing Formatting Utils
import { valueFormatter, textMeasurementService } from "powerbi-visuals-utils-formattingutils";

// Importing custom styles
import "./../style/visual.less";

// Essential imports dealing with visual development on the BI interface
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

// Importing color utils
import IColorPalette = powerbi.extensibility.IColorPalette;

// Importing Tooltip utils
import { createTooltipServiceWrapper, ITooltipServiceWrapper, TooltipEventArgs, TooltipEnabledDataPoint } from "powerbi-visuals-utils-tooltiputils";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

// Importing formatting data cards from the setting.ts for format pane
import { VisualFormattingSettingsModel } from "./settings";

// Interface for structuring data
export interface ChartDataPoints {
    category: string,
    value: any
}

export class Visual implements IVisual {
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private host: IVisualHost;
    private tooltipServiceWrapper: ITooltipServiceWrapper;

    // Initialising values for landing page
    private element: HTMLElement;
    private isLandingPageOn: boolean;
    private LandingPageRemoved: boolean;
    private LandingPage: d3.Selection<any, any, any, any>;

    // Initialising SVG element that will hold the visual
    private svg: d3.Selection<SVGElement, any, any, any>;
    private margin = { top: 20, right: 20, bottom: 40, left: 50 };

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.host = options.host;
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);

        // Initialising container to store the visual in the target element
        this.element = options.element;
        this.svg = d3.select(options.element)
            .append("svg")
            .classed("custom-chart", true);
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel
            (VisualFormattingSettingsModel, options.dataViews);
        this.formattingSettings.dataPointCard.fontSize.value = Math.max(10, this.formattingSettings.dataPointCard.fontSize.value);
        this.formattingSettings.dataPointCard.fontSize.value = Math.min(14, this.formattingSettings.dataPointCard.fontSize.value)

        // Handling landing page
        this.handleLandingPage(options);

        // Setting width and height
        var width = options.viewport.width;
        var height = options.viewport.height;

        // filtering suitable parsing methods and visual methods based on metadata structure
        if (!options.dataViews[0].categorical.values.source) {
            // fetch suitable formatted data for the generating visual
            var chartData = this.parseSimpleChartData(options.dataViews[0]);
            // column chart
            if (!this.formattingSettings.dataPointCard.defaultStackedBarChart.value) {
                this.generateColumnChart(width, height, chartData, options);
            }
            // bar chart
            else {
                this.generateBarChart(width, height, chartData, options);
            }
        }

        else {
            // fetch suitable formatted data for the generating visual
            if (options.dataViews[0].categorical.categories) {
                var legendChartData = this.parseStackedChartData(options.dataViews[0]);
                var subCategoryTitle = options.dataViews[0].metadata.columns[2].displayName
                if (!this.formattingSettings.dataPointCard.defaultStackedBarChart.value) {
                    this.generateStackedColumnChart(width, height, legendChartData, options, subCategoryTitle);
                }
                else {
                    this.generateStackedBarChart(width, height, legendChartData, options, subCategoryTitle);
                }
            }
            else {
                var chartData = this.parseLegendSimpleChartData(options.dataViews[0]);
                var categoryTitle = options.dataViews[0].categorical.values.source.displayName;
                if (!this.formattingSettings.dataPointCard.defaultStackedBarChart.value) {
                    this.generateColumnChart(width, height, chartData, options, categoryTitle, true);
                }
                else {
                    this.generateBarChart(width, height, chartData, options, categoryTitle, true);
                }
            }

        }
    }

    // Method to generate landing page
    private handleLandingPage(options: VisualUpdateOptions) {
        if (!options.dataViews || !options.dataViews[0]?.metadata?.columns?.length) {
            if (!this.isLandingPageOn) {
                this.isLandingPageOn = true;
                const SampleLandingPage: Element = this.createLandingPage();
                this.element.appendChild(SampleLandingPage);
                this.LandingPage = d3.select(SampleLandingPage);
            }

        } else {
            if (this.isLandingPageOn && !this.LandingPageRemoved) {
                this.LandingPageRemoved = true;
                this.LandingPage.remove();
            }
        }
    }

    private createLandingPage(): Element {
        const div = document.createElement("div");
        div.setAttribute("class", "container");
        const header = document.createElement("h3");
        header.textContent = "CloudServe Systems Pvt Ltd";
        header.setAttribute("class", "header");
        div.appendChild(header);

        var introPara = document.createElement("p");
        introPara.textContent = "Easiest way to get custom Power BI visuals for your business!";
        introPara.setAttribute("class", "introPara");
        div.appendChild(introPara);

        var aboutPara = document.createElement("p");
        aboutPara.textContent = "This is a sample custom Power BI visual with four charts.";
        aboutPara.setAttribute("class", "aboutPara");

        return div;
    }


    private generateColumnChart(width: number, height: number, visualChartData: ChartDataPoints[], options: VisualUpdateOptions, categoryName?: string, isLegend?: boolean) {
        // clearing previous format
        this.svg.selectAll("*").remove();

        var innerWidth = width - this.margin.left - this.margin.right;
        var innerHeight = height - this.margin.top - this.margin.bottom;

        var svg = this.svg
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', "translate(" + this.margin.left + ", " + this.margin.top + ")");

        // If legend is sought generate colors for columns
        // Generating color palette for subcategories
        let colorStack: string[] = [];
        let subCategories: string[] = [];
        if (isLegend) {
            let colorPalette: IColorPalette = this.host.colorPalette;
            Object.keys(visualChartData).forEach((value) => {
                colorStack.push(colorPalette.getColor(value).value);
            });

            visualChartData.forEach((element) => {
                subCategories.push(element.category);
            })
        }

        // scale x axis
        var xScaleColumn = d3.scaleBand()
            .domain(visualChartData.map(d => d.category))
            .range([0, innerWidth])
            .padding(0.4)
            .paddingInner(0.5);

        // draw x axis
        svg.append("g")
            .attr("class", "x-axis-column-chart")
            .attr('transform', "translate(0, " + innerHeight + ")")
            .call(d3.axisBottom(xScaleColumn))
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
            .selectAll("text")
            .attr("transform", function (d) {
                if (innerWidth < 500) {
                    return "translate(-20, 3)rotate(-20)";
                }
                else if (innerWidth > 500 && innerWidth < 700) {
                    return "translate(0, 3)";
                }
            })
            .text((d) => {
                if ((innerWidth < 500)) {
                    return this.shortenLabel(d, 7);
                }
                else if (innerWidth > 500 && innerWidth < 700) { return this.shortenLabel(d, 14); }
                else {
                    return d;
                }
            });

        // Formatting values
        let iValueFormatter = valueFormatter.create({ value: 1e6 });

        // Finding appropriate min value to plot negative values
        var minValue = 0;
        minValue = minValue > d3.min(visualChartData, d => d.value) ? d3.min(visualChartData, d => d.value) : 0;

        // scale y axis
        var yScaleColumn = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value)])
            .nice()
            .range([innerHeight, 0]);

        // draw y axis
        if (innerHeight < 240) {
            svg.append("g")
                .attr("class", "y-axis-column-chart")
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
                .call(d3.axisLeft(yScaleColumn)
                    .ticks(4)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0));
        }
        else {
            svg.append("g")
                .attr("class", "y-axis-column-chart")
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
                .call(d3.axisLeft(yScaleColumn)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0));
        }


        // Fetching axis labels from metadata
        var columns = options.dataViews[0].metadata.columns;
        var xAxisLabelName: string; var yAxisLabelName: string;
        columns.forEach(column => {
            if (column.roles["category"]) {
                xAxisLabelName = column.displayName;
            } else if (column.roles["measure"]) {
                yAxisLabelName = column.displayName;
            }
        });

        // Conditional Labels
        if (this.formattingSettings.dataPointCard.showAxisLabels.value) {
            // Add X-axis label
            svg.append('text')
                .attr('class', 'x-axis-label')
                .attr('x', innerWidth / 2)
                .attr('y', innerHeight + this.margin.bottom - 2)
                .style('text-anchor', 'middle')
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-weight", "bold")
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .text(xAxisLabelName);

            // Add Y-axis label
            svg.append('text')
                .attr('class', 'y-axis-label')
                .attr('x', -innerHeight / 2)
                .attr('y', -this.margin.left * 0.8)
                .style('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .style("fill", this.formattingSettings.dataPointCard.fontColor.value.value)
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .style("font-weight", "bold")
                .text(yAxisLabelName);

        }

        // Create svg to represent data
        svg.selectAll(".bar")
            .data(visualChartData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => xScaleColumn(d.category))
            .attr("width", xScaleColumn.bandwidth())
            .attr("y", d => yScaleColumn(0))
            .attr("height", d => innerHeight - yScaleColumn(0))
            .style("fill", "steelblue");

        // Animation
        if (!isLegend) {
            svg.selectAll("rect")
                .data(visualChartData)
                .transition()
                .duration(1000)
                .attr("y", d => yScaleColumn(Math.max(0, d.value)))
                .attr("height", d => Math.abs(yScaleColumn(d.value) - yScaleColumn(0)))
                .delay(function (d, i) { return (i * 100); })
                .style("fill", "steelblue");
        }
        else {
            svg.selectAll("rect")
                .data(visualChartData)
                .transition()
                .duration(1000)
                .attr("y", d => yScaleColumn(Math.max(0, d.value)))
                .attr("height", d => Math.abs(yScaleColumn(d.value) - yScaleColumn(0)))
                .delay(function (d, i) { return (i * 100); })
                .style("fill", function (d, i) {
                    return colorStack[i];
                });

            // Adding legend
            this.showLegend(svg, categoryName, subCategories, colorStack);
        }


        // Add text labels
        if (this.formattingSettings.dataPointCard.showDataLabels.value) {
            svg.selectAll(".label")
                .data(visualChartData)
                .enter()
                .append("text")
                .attr("class", "data-label")
                .attr("x", d => xScaleColumn(d.category) + xScaleColumn.bandwidth() / 8)
                .attr("y", d => yScaleColumn(d.value) - 20)
                .attr("dy", ".75em")
                .text(d => iValueFormatter.format(d.value));
        }

        // Add tooltip
        this.viewTooltip(visualChartData);
    }

    private generateBarChart(width: number, height: number, visualChartData: ChartDataPoints[], options: VisualUpdateOptions, categoryName?: string, isLegend?: boolean) {
        // clearing previous format
        this.svg.selectAll("*").remove();

        var innerWidth = width - this.margin.left - this.margin.right;
        var innerHeight = height - this.margin.top - this.margin.bottom;

        var svg = this.svg
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', "translate(" + this.margin.left + "," + this.margin.top + ")");

        // If legend is sought generate colors for columns
        // Generating color palette for subcategories
        let colorStack: string[] = [];
        let subCategories: string[] = [];
        if (isLegend) {
            colorStack = this.generateColorPallete(subCategories);
            visualChartData.forEach((element) => {
                subCategories.push(element.category);
            });
        }

        // Formatting values
        let iValueFormatter = valueFormatter.create({ value: 1e6 });

        // Finding appropriate min value to plot negative values
        var minValue = 0;
        minValue = minValue > d3.min(visualChartData, d => d.value) ? d3.min(visualChartData, d => d.value) : 0;

        // scale x axis
        var xScaleBar = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value)])
            .range([0, innerWidth - 70]);

        // draw x axis and set tick numbers based on the width of the viewport
        if (width < 300) {
            svg.append("g")
                .attr("class", "x-axis-bar-chart")
                .attr('transform', "translate(20, " + innerHeight + ")")
                .call(d3.axisBottom(xScaleBar)
                    .ticks(3)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0))
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value);

        }
        else {
            svg.append("g")
                .attr("class", "x-axis-bar-chart")
                .attr('transform', "translate(20, " + innerHeight + ")")
                .call(d3.axisBottom(xScaleBar)
                    .ticks(4)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0))
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value);
        }

        // scale y axis
        var yScaleBar = d3.scaleBand()
            .domain(visualChartData.map(d => d.category))
            .range([0, innerHeight])
            .padding(0.4)
            .paddingInner(0.5);

        // draw y axis and set label length based on height of the viewport
        svg.append("g")
            .attr('transform', "translate(20,0)")
            .attr("class", "y-axis-bar-chart")
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
            .call(d3.axisLeft(yScaleBar))
            .selectAll("text")
            .attr("transform", function (d) {
                if (innerHeight < 400) {
                    return "translate(0, 3)";
                }
            })
            .text((d) => {
                if ((innerHeight < 500)) {
                    return this.shortenLabel(d, 7);
                }
                else if (innerHeight > 500 && innerHeight < 700) { return this.shortenLabel(d, 14); }
                else {
                    return d;
                }
            });

        // Fetching axis labels from metadata
        var columns = options.dataViews[0].metadata.columns;
        var xAxisLabelName: string; var yAxisLabelName: string;
        columns.forEach(column => {
            if (column.roles["measure"]) {
                xAxisLabelName = column.displayName;
            } else if (column.roles["category"]) {
                yAxisLabelName = column.displayName;
            }
        });

        // Conditional Axis Labels
        if (this.formattingSettings.dataPointCard.showAxisLabels.value) {
            // Add X-axis label
            svg.append('text')
                .attr('class', 'x-axis-label')
                .attr('x', innerWidth / 2)
                .attr('y', innerHeight + this.margin.bottom - 5)
                .style('text-anchor', 'middle')
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-weight", "bold")
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .text(xAxisLabelName);

            // Add Y-axis label
            svg.append('text')
                .attr('class', 'y-axis-label')
                .attr('x', -innerHeight / 2)
                .attr('y', -this.margin.left * 0.8)
                .style('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .style("fill", this.formattingSettings.dataPointCard.fontColor.value.value)
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .style("font-weight", "bold")
                .text(yAxisLabelName);

        }

        // Create svg to represent data
        svg.selectAll(".bar")
            .data(visualChartData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr('transform', "translate(20, 0)")
            .attr("y", d => yScaleBar(d.category))
            .attr("height", yScaleBar.bandwidth())
            .attr("x", d => xScaleBar(0))
            .style("fill", "steelblue");

        // Animation
        if (!isLegend) {
            svg.selectAll("rect")
                .data(visualChartData)
                .transition()
                .duration(2000)
                .attr("x", d => xScaleBar(0))
                .attr("width", d => Math.abs(xScaleBar(d.value) - xScaleBar(0)))
                .delay(function (d, i) { return (i * 100); })
                .style("fill", "steelblue");
        }
        else {
            svg.selectAll("rect")
                .data(visualChartData)
                .transition()
                .duration(2000)
                .attr("x", d => xScaleBar(0))
                .attr("width", d => Math.abs(xScaleBar(d.value) - xScaleBar(0)))
                .delay(function (d, i) { return (i * 100); })
                .style("fill", function (d, i) {
                    return colorStack[i];
                });

            // Adding legend
            this.showLegend(svg, categoryName, subCategories, colorStack);
        }


        // Add text labels
        if (this.formattingSettings.dataPointCard.showDataLabels.value) {
            svg.selectAll(".label")
                .data(visualChartData)
                .enter()
                .append("text")
                .attr("class", "data-label")
                .attr("y", d => yScaleBar(d.category) + yScaleBar.bandwidth() / 8)
                .attr("x", d => xScaleBar(d.value) - 20)
                .attr("dx", "3em")
                .attr("dy", "1.5em")
                .text(d => iValueFormatter.format(d.value));
        }

        // Add tooltip to the chart
        this.viewTooltip(visualChartData);
    }

    // Method to format data for simple chart
    private parseSimpleChartData(dataViewSet: DataView): ChartDataPoints[] {
        let visualChartDataPoints: ChartDataPoints[] = [];
        const categories = dataViewSet.categorical.categories[0].values;
        const values = dataViewSet.categorical.values[0];
        // Return data in [{category:value}, {category:value}, ....] format
        visualChartDataPoints = categories.map((category, i) => ({
            category: category.toString(),
            value: values.values[i] as number
        }));

        return visualChartDataPoints;
    }

    // Method to format data for a simple chart with a legnd feature
    private parseLegendSimpleChartData(dataViewSet: DataView): ChartDataPoints[] {
        let visualChartDataPoints: ChartDataPoints[] = [];
        // generates [{"category":"", value:}, {"category":"", value:}, ...]
        dataViewSet.categorical.values.forEach((value) => {
            visualChartDataPoints.push({
                category: value.source.groupName.toString(),
                value: value.values[0] as number
            });
        })

        return visualChartDataPoints;
    }

    // generate stacked column chart with legend
    private generateStackedColumnChart(width: number, height: number, visualChartData: ChartDataPoints[], options: VisualUpdateOptions, stackCategory: string) {
        // clearing previous format
        this.svg.selectAll("*").remove();

        var innerWidth = width - this.margin.left - this.margin.right;
        var innerHeight = height - this.margin.top - this.margin.bottom;

        var svg = this.svg
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', "translate(" + this.margin.left + ", " + this.margin.top + ")");

        // Converting data to necessary format for stacking and further formatting
        // [{category:value, subcategory1:value, subcategory2:value, ...}, ...] format
        const formattedVisualData = visualChartData.map(item => {
            const category = item.category;
            const values = { ...item.value };
            return { category, ...values };
        });

        // Extracting subcategories
        const subCategories = Object.keys(formattedVisualData[0]).filter(key => key !== "category" && key !== "sum");
        let colorStack: string[] = this.generateColorPallete(subCategories);

        // Stack the data
        const stack = d3.stack().keys(subCategories)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone);

        var stackedData = stack(formattedVisualData);

        // scale x axis
        var xScaleColumn = d3.scaleBand()
            .domain(formattedVisualData.map(d => d.category))
            .range([0, innerWidth])
            .padding(0.4)
            .paddingInner(0.5);

        // draw x axis and set tick numbers based on viewport width
        svg.append("g")
            .attr("class", "x-axis-stacked-column-chart")
            .attr('transform', "translate(0, " + innerHeight + ")")
            .call(d3.axisBottom(xScaleColumn))
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
            .selectAll("text")
            .attr("transform", function (d) {
                if (innerWidth < 500) {
                    return "translate(-20, 3)rotate(-20)";
                }
                else if (innerWidth > 500 && innerWidth < 800) {
                    return "translate(0, 3)";
                }
                else {
                    return "translate(0, 3)rotate(0)";
                }
            })
            .text((d) => {
                if ((innerWidth < 500)) {
                    return this.shortenLabel(d, 7);
                }
                else if (innerWidth > 500 && innerWidth < 700) { return this.shortenLabel(d, 16); }
                else {
                    return d;
                }
            });

        // Formatting values
        let iValueFormatter = valueFormatter.create({ value: 1e6 });

        // Finding appropriate min value to plot negative values
        var minValue = 0;
        minValue = minValue > d3.min(visualChartData, d => d.value) ? d3.min(visualChartData, d => d.value) : 0;

        // scale y axis
        var yScaleColumn = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value.sum)])
            .nice()
            .range([innerHeight, 0]);

        // draw y axis and set text labels based on viewport height
        if (innerHeight < 240) {
            svg.append("g")
                .attr("class", "y-axis-stacked-column-chart")
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
                .call(d3.axisLeft(yScaleColumn)
                    .ticks(4)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0));
        }
        else {
            svg.append("g")
                .attr("class", "y-axis-stacked-column-chart")
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
                .call(d3.axisLeft(yScaleColumn)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0));
        }

        // Fetching axis labels from metadata
        var columns = options.dataViews[0].metadata.columns;
        var xAxisLabelName: string; var yAxisLabelName: string;
        columns.forEach(column => {
            if (column.roles["category"]) {
                xAxisLabelName = column.displayName;
            } else if (column.roles["measure"]) {
                yAxisLabelName = column.displayName;
            }
        });

        if (this.formattingSettings.dataPointCard.showAxisLabels.value) {
            // Add X-axis label
            svg.append('text')
                .attr('class', 'x-axis-label')
                .attr('x', innerWidth / 2)
                .attr('y', innerHeight + this.margin.bottom - 2)
                .style('text-anchor', 'middle')
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-weight", "bold")
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .text(xAxisLabelName);

            // Add Y-axis label
            svg.append('text')
                .attr('class', 'y-axis-label')
                .attr('x', -innerHeight / 2)
                .attr('y', -this.margin.left * 0.8)
                .style('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .style("fill", this.formattingSettings.dataPointCard.fontColor.value.value)
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .style("font-weight", "bold")
                .text(yAxisLabelName);

        }

        // Create the bars
        svg.selectAll(".bar")
            .data(stackedData)
            .enter().append("g")
            .attr("fill", (d, i) => { return colorStack[i]; })
            .selectAll("rect")
            .data(d => d)
            .enter().append("rect")
            .attr("x", function (d) { return xScaleColumn(d.data.category.toString()) })
            .attr("y", function (d) { return yScaleColumn(d[1]); })
            .attr("height", function (d) { return yScaleColumn(d[0]) - yScaleColumn(d[1]); })
            .attr("width", xScaleColumn.bandwidth());

        // Add legend
        this.showLegend(svg, stackCategory, subCategories, colorStack);

        // Add tooltip
        // this.viewTooltip(visualChartData);
    }

    // Method for generating stacked bar chart with legend
    private generateStackedBarChart(width: number, height: number, visualChartData: ChartDataPoints[], options: VisualUpdateOptions, stackCategory: string) {
        // clearing previous format
        this.svg.selectAll("*").remove();

        var innerWidth = width - this.margin.left - this.margin.right;
        var innerHeight = height - this.margin.top - this.margin.bottom;

        var svg = this.svg
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', "translate(" + this.margin.left + "," + this.margin.top + ")");

        // Converting data to suitable format for stacking and further formatting
        const formattedVisualData = visualChartData.map(item => {
            const category = item.category;
            const values = { ...item.value };
            return { category, ...values };
        })

        // Extracting subcategories
        const subCategories = Object.keys(formattedVisualData[0]).filter(key => key !== "category" && key !== "sum");
        let colorStack: string[] = this.generateColorPallete(subCategories);

        // Stack the data
        const stack = d3.stack().keys(subCategories)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone);

        var stackedData = stack(formattedVisualData);


        // Formatting values
        let iValueFormatter = valueFormatter.create({ value: 1e6 });

        // Finding appropriate min value to plot negative values
        var minValue = 0;
        minValue = minValue > d3.min(visualChartData, d => d.value) ? d3.min(visualChartData, d => d.value) : 0;

        // scale x axis
        var xScaleBar = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value.sum)])
            .range([0, innerWidth - 10]);

        // draw x axis and set tick numbers based on viewport width
        if (innerWidth < 400) {
            svg.append("g")
                .attr("class", "x-axis-stacked bar-chart")
                .attr('transform', "translate(20, " + innerHeight + ")")
                .call(d3.axisBottom(xScaleBar)
                    .ticks(4)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0))
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value);
        }
        else {
            svg.append("g")
                .attr("class", "x-axis-stacked bar-chart")
                .attr('transform', "translate(20, " + innerHeight + ")")
                .call(d3.axisBottom(xScaleBar)
                    .tickFormat(function (d) { return iValueFormatter.format(d) })
                    .tickSizeInner(-innerWidth)
                    .tickSizeOuter(0))
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value);
        }


        // scale y axis
        var yScaleBar = d3.scaleBand()
            .domain(formattedVisualData.map(d => d.category))
            .range([0, innerHeight])
            .padding(0.4)
            .paddingInner(0.5);

        // draw y axis and set text labels based on viewport height
        svg.append("g")
            .attr('transform', "translate(20,0)")
            .attr("class", "y-axis-bar-chart")
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
            .call(d3.axisLeft(yScaleBar))
            .selectAll("text")
            .attr("transform", function (d) {
                if (innerHeight < 400) {
                    return "translate(0, 3)";
                }
            })
            .text((d) => {
                if ((innerHeight < 500)) {
                    return this.shortenLabel(d, 7);
                }
                else if (innerHeight > 500 && innerHeight < 700) { return this.shortenLabel(d, 14); }
                else {
                    return d;
                }
            });

        // Fetching axis labels from metadata
        var columns = options.dataViews[0].metadata.columns;
        var xAxisLabelName: string; var yAxisLabelName: string;
        columns.forEach(column => {
            if (column.roles["measure"]) {
                xAxisLabelName = column.displayName;
            } else if (column.roles["category"]) {
                yAxisLabelName = column.displayName;
            }
        });

        if (this.formattingSettings.dataPointCard.showAxisLabels.value) {
            // Add X-axis label
            svg.append('text')
                .attr('class', 'x-axis-label')
                .attr('x', innerWidth / 2)
                .attr('y', innerHeight + this.margin.bottom - 5)
                .style('text-anchor', 'middle')
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-weight", "bold")
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .text(xAxisLabelName);

            // Add Y-axis label
            svg.append('text')
                .attr('class', 'y-axis-label')
                .attr('x', -innerHeight / 2)
                .attr('y', -this.margin.left * 0.8)
                .style('text-anchor', 'middle')
                .attr('transform', 'rotate(-90)')
                .style("fill", this.formattingSettings.dataPointCard.fontColor.value.value)
                .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
                .style("font-size", this.formattingSettings.dataPointCard.fontSize.value + 2)
                .style("font-weight", "bold")
                .text(yAxisLabelName);

        }

        // Create the bars
        svg.selectAll(".bar")
            .data(stackedData)
            .enter().append("g")
            .attr("fill", (d, i) => { return colorStack[i]; })
            .selectAll("rect")
            .data(d => d)
            .enter().append("rect")
            .attr('transform', "translate(20, 0)")
            .attr("y", function (d) { return yScaleBar(d.data.category.toString()) })
            .attr("height", yScaleBar.bandwidth())
            .attr("x", function (d) { return xScaleBar(d[0]); })
            .attr("width", function (d) { return xScaleBar(d[1]) - xScaleBar(d[0]); });

        // Add legend
        this.showLegend(svg, stackCategory, subCategories, colorStack);

        // Add tooltip
        // this.viewTooltip(visualChartData);
    }

    // Method to fornat data for stacked chart
    private parseStackedChartData(dataViewSet: DataView): ChartDataPoints[] {
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


    // Method for legend
    private showLegend(chartSVG: d3.Selection<SVGElement, any, any, any>, stackCategory: string, innerCategories: string[], categoricalColors: string[]) {

        // Adding legend title
        chartSVG.append("text")
            .attr("x", -50)
            .attr("y", -10)
            .style("font-weight", "bold")
            .style("font-size", "0.8em")
            .text(stackCategory);

        var legend = chartSVG.selectAll(".legend")
            .data(innerCategories)
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) { return "translate(" + i * 100 + ", -20)" });

        legend.append("circle")
            .attr("x", 20)
            .attr("cx", 10)
            .attr("cy", 8)
            .attr("r", 7)
            .style("fill", (d, i) => { return categoricalColors[i]; });

        legend.append("text")
            .attr("x", 20)
            .attr("y", 9)
            .attr("dy", ".35em")
            .style("text-anchor", "start")
            .style("font-size", "0.8em")
            .text((d) => {
                return this.shortenLabel(d, 10)
            });
    }

    // Method to restrict label size
    private shortenLabel(label, maxLength) {
        if (label.length > maxLength) {
            return label.substring(0, maxLength) + "..."; // Shorten the label and add ellipsis
        }
        return label;
    }

    // Method to generate color palettes 
    private generateColorPallete(subCategories: string[]) : string[]{
        let colorPalette: IColorPalette = this.host.colorPalette;
        let colorStack: string[] = []
        Object.keys(subCategories).forEach((value) => {
            colorStack.push(colorPalette.getColor(value).value);
        });
        return colorStack
    }

    // Method for tooltip
    private viewTooltip(visualChartData: ChartDataPoints[]) {
        this.svg.selectAll("rect").on("mouseover", function (event, data) {
            d3.select(this).transition()
                .duration(1000)
                .attr("opacity", "0.6")
        });
        this.svg.selectAll("rect").on("mouseout", function (event, data) {
            d3.select(this).transition()
                .duration(1000)
                .attr("opacity", "1");
        });

        this.tooltipServiceWrapper.addTooltip(this.svg.selectAll("rect"),
            (dataPoints: ChartDataPoints) => this.getTooltipData(dataPoints));

    }

    // Method to retrieve tooltip data
    private getTooltipData(value: any): VisualTooltipDataItem[] {
        let iValueFormatter = valueFormatter.create({ value: 1e6 });
        return [{
            displayName: value.category,
            value: iValueFormatter.format(value.value).toString()
        }];
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        // Perform any cleanup tasks here
        this.svg.exit().remove();
    }
}