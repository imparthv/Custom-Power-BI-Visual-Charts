"use strict";

import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";

// Essential imports dealing with visual development on the BI interface
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import IColorPalette = powerbi.extensibility.IColorPalette;
import ISelectionId = powerbi.extensibility.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

import { createTooltipServiceWrapper, ITooltipServiceWrapper, TooltipEventArgs, TooltipEnabledDataPoint } from "powerbi-visuals-utils-tooltiputils";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import { textMeasurementService } from "powerbi-visuals-utils-formattingutils";

import "./../style/visual.less";

import { VisualFormattingSettingsModel } from "./settings";
import { ChartDataPoints } from "./interface";
import { parseSimpleChartData, parseLegendSimpleChartData, parseStackedChartData } from "./dataParser";
import { getFormattedValue } from "./valueFomatter";
import { showLegend } from "./legend";

export class Visual implements IVisual {
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private host: IVisualHost;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: ISelectionManager;

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
        this.selectionManager = this.host.createSelectionManager();

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
        this.formattingSettings.dataPointCard.fontSize.value = Math.min(14, this.formattingSettings.dataPointCard.fontSize.value);

        this.svg.selectAll("*").remove();
        // Handling landing page
        this.handleLandingPage(options);

        // Setting width and height
        var width = options.viewport.width;
        var height = options.viewport.height;

        // filtering suitable parsing methods and visual methods based on metadata structure
        if (!options.dataViews[0].categorical.values.source) {
            // fetch suitable formatted data for the generating visual
            var chartData = parseSimpleChartData(options.dataViews[0], this.host);
            // column chart
            if (!this.formattingSettings.dataPointCard.flipChart.value) {
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
                var chartData = parseStackedChartData(options.dataViews[0]);
                var subCategoryTitle = options.dataViews[0].metadata.columns[2].displayName;
                if (!this.formattingSettings.dataPointCard.flipChart.value) {
                    this.generateStackedColumnChart(width, height, chartData, options, subCategoryTitle);
                }
                else {
                    this.generateStackedBarChart(width, height, chartData, options, subCategoryTitle);
                }
            }
            else {
                var chartData = parseLegendSimpleChartData(options.dataViews[0]);
                var categoryTitle = options.dataViews[0].categorical.values.source.displayName;
                if (!this.formattingSettings.dataPointCard.flipChart.value) {
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
            subCategories = this.getSubCategories(visualChartData);
            colorStack = this.generateColorPallete(subCategories);
        }

        // scale x axis
        var xScaleColumn = d3.scaleBand()
            .domain(visualChartData.map(d => d.category))
            .range([0, innerWidth])
            .padding(0.4)
            .paddingInner(0.5);

        // draw x axis
        svg.append("g")
            .attr("class", "x-axis")
            .attr('transform', "translate(0, " + innerHeight + ")")
            .call(d3.axisBottom(xScaleColumn))
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
            .selectAll("text")
            .style("text-anchor", "middle")
            .call(this.wordBreak, xScaleColumn.bandwidth(), innerHeight);

        // Finding appropriate min value to plot negative values
        var minValue: number = this.getMinValue(visualChartData);

        // scale y axis
        var yScaleColumn = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value)])
            .nice()
            .range([innerHeight, 0]);


        // draw y axis
        svg.append("g")
            .attr("class", "y-axis")
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
            .call(d3.axisLeft(yScaleColumn)
                .ticks(Math.max(4, Math.floor(height / 30)))
                .tickFormat(function (d) { return getFormattedValue(d.valueOf()); })
                .tickSizeInner(-innerWidth)
                .tickSizeOuter(0));


        // Create svg to represent data
        svg.selectAll(".bar")
            .data(visualChartData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => xScaleColumn(d.category))
            .attr("width", xScaleColumn.bandwidth())
            .attr("y", d => yScaleColumn(Math.max(0, d.value)))
            .attr("height", d => Math.abs(yScaleColumn(d.value) - yScaleColumn(0)))
            .style("fill", function (d, i) {
                if (!isLegend) {
                    return "steelblue";
                }
                else {
                    return colorStack[i];
                }
            })
            .on("click", (d) => {
                this.selectionManager.select(d.selectionID).then((selectionId: ISelectionId[]) => {
                    svg.selectAll(".bar").style({
                        "fill-opacity": selectionId.length > 0 ?
                            d => selectionId.indexOf(d.identity) >= 0 ? 1.0 : 0.5 :
                            1.0
                    } as any);
                });
            });

        if (isLegend) {
            // Adding legend
            showLegend(svg, categoryName, subCategories, colorStack);
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
                .text(d => getFormattedValue(d.value));
        }

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
                .text((d) => {
                    if (!isLegend) {
                        return options.dataViews[0].categorical.categories[0].source.displayName;
                    } else {
                        return options.dataViews[0].categorical.values.source.displayName;
                    }
                });

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
                .text(options.dataViews[0].categorical.values[0].source.displayName);

        }

        // Add tooltip
        this.viewTooltip();
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
            subCategories = this.getSubCategories(visualChartData);
            colorStack = this.generateColorPallete(subCategories);
        }

        // Finding appropriate min value to plot negative values
        var minValue: number = this.getMinValue(visualChartData);

        // scale x axis
        var xScaleBar = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value)])
            .range([0, innerWidth - 70]);

        // draw x axis and set tick numbers based on the width of the viewport
        svg.append("g")
            .attr("class", "x-axis-bar-chart")
            .attr('transform', "translate(20, " + innerHeight + ")")
            .call(d3.axisBottom(xScaleBar)
                .ticks(Math.max(3, Math.floor(width / 80)))
                .tickFormat(function (d) { return getFormattedValue(d.valueOf()); })
                .tickSizeInner(-innerWidth)
                .tickSizeOuter(0))
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value);

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
                .text(options.dataViews[0].categorical.values[0].source.displayName);

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
                .text((d) => {
                    if (!isLegend) {
                        return options.dataViews[0].categorical.categories[0].source.displayName;
                    } else {
                        return options.dataViews[0].categorical.values.source.displayName;
                    }
                });

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
            .attr("x", d => (d.value >= 0) ? xScaleBar(0) : xScaleBar(d.value))
            .attr("width", d => Math.abs(xScaleBar(0) - xScaleBar(d.value)))
            .style("fill", function (d, i) {
                if (!isLegend) {
                    return "steelblue";
                }
                else {
                    return colorStack[i];
                }
            });

        if (isLegend) {
            // Adding legend
            showLegend(svg, categoryName, subCategories, colorStack);
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
                .text(d => getFormattedValue(d.value));
        }

        // Add tooltip to the chart
        this.viewTooltip();
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
            .style("text-anchor", "middle")
            .call(this.wordBreak, xScaleColumn.bandwidth(), innerHeight);;

        // Finding appropriate min value to plot negative values
        var minValue: number = this.getMinValue(visualChartData);

        // scale y axis
        var yScaleColumn = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value.sum)])
            .nice()
            .range([innerHeight, 0]);

        // draw y axis and set text labels based on viewport height
        svg.append("g")
            .attr("class", "y-axis-stacked-column-chart")
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value)
            .call(d3.axisLeft(yScaleColumn)
                .ticks(Math.max(3, Math.floor(height / 80)))
                .tickFormat(function (d) { return getFormattedValue(d.valueOf()); })
                .tickSizeInner(-innerWidth)
                .tickSizeOuter(0));

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
                .text(options.dataViews[0].categorical.categories[0].source.displayName);

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
                .text(options.dataViews[0].categorical.values[0].source.displayName);
        }

        // Create the bars
        svg.selectAll(".bar")
            .data(stackedData)
            .enter().append("g")
            .attr("fill", (d, i) => { return colorStack[i]; })
            .selectAll("rect")
            .data(d => d)
            .enter().append("rect")
            .attr("x", function (d) { return xScaleColumn(d.data.category.toString()); })
            .attr("y", function (d) { return yScaleColumn(d[1]); })
            .attr("height", function (d) { return yScaleColumn(d[0]) - yScaleColumn(d[1]); })
            .attr("width", xScaleColumn.bandwidth());

        // Add legend
        showLegend(svg, stackCategory, subCategories, colorStack);

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

        // Finding appropriate min value to plot negative values
        var minValue: number = this.getMinValue(visualChartData);

        // scale x axis
        var xScaleBar = d3.scaleLinear()
            .domain([minValue, d3.max(visualChartData, d => d.value.sum)])
            .range([0, innerWidth - 10]);

        // draw x axis and set tick numbers based on viewport width
        svg.append("g")
            .attr("class", "x-axis-bar-chart")
            .attr('transform', "translate(20, " + innerHeight + ")")
            .call(d3.axisBottom(xScaleBar)
                .ticks(Math.max(3, Math.floor(width / 80)))
                .tickFormat(function (d) { return getFormattedValue(d.valueOf()); })
                .tickSizeInner(-innerWidth)
                .tickSizeOuter(0))
            .style("font-family", this.formattingSettings.dataPointCard.fontFamily.value)
            .style("font-size", this.formattingSettings.dataPointCard.fontSize.value);

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
                .text(options.dataViews[0].categorical.values[0].source.displayName);

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
                .text(options.dataViews[0].categorical.categories[0].source.displayName);

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
            .attr("y", function (d) { return yScaleBar(d.data.category.toString()); })
            .attr("height", yScaleBar.bandwidth())
            .attr("x", function (d) { return xScaleBar(d[0]); })
            .attr("width", function (d) { return xScaleBar(d[1]) - xScaleBar(d[0]); });

        // Add legend
        showLegend(svg, stackCategory, subCategories, colorStack);

        // Add tooltip
        // this.viewTooltip(visualChartData);
    }

    // Method to restrict label size
    private shortenLabel(label, maxLength) {
        if (label.length > maxLength) {
            return label.substring(0, maxLength) + "..."; // Shorten the label and add ellipsis
        }
        return label;
    }

    // Method to wrap labels
    private wordBreak(
        textNodes: d3.Selection<any, SVGElement, any, any>,
        allowedWidth: number,
        maxHeight: number
    ) {
        textNodes.each(function () {
            textMeasurementService.wordBreak(
                this,
                allowedWidth,
                maxHeight);
        });
    }

    // Method to fetch subcategories
    private getSubCategories(data: ChartDataPoints[]): string[] {
        let innerCatagories: string[] = [];
        data.forEach((element) => {
            innerCatagories.push(element.category);
        })
        return innerCatagories;
    }

    // Method to generate color palettes 
    private generateColorPallete(subCategories: string[]): string[] {
        let colorPalette: IColorPalette = this.host.colorPalette;
        let colorStack: string[] = [];
        Object.keys(subCategories).forEach((value) => {
            colorStack.push(colorPalette.getColor(value).value);
        });
        return colorStack;
    }

    private getMinValue(data: ChartDataPoints[]): number {
        var minValue: number = 0;
        minValue = minValue > d3.min(data, d => d.value) ? d3.min(data, d => d.value) : 0;
        return minValue;
    }

    // Method for tooltip
    private viewTooltip() {
        this.svg.selectAll("rect").on("mouseover", function (event, data) {
            d3.select(this).transition()
                .duration(1000)
                .attr("opacity", "0.6");
        });
        this.svg.selectAll("rect").on("mouseout", function (event, data) {
            d3.select(this).transition()
                .duration(1000)
                .attr("opacity", "1");
        });

        this.tooltipServiceWrapper.addTooltip(this.svg.selectAll("rect"),
            (dataPoints: ChartDataPoints) => this.getTooltipData(dataPoints),
            (datapoint: ChartDataPoints) => datapoint.selectionID);

    }

    // Method to retrieve tooltip data
    private getTooltipData(value: any): VisualTooltipDataItem[] {
        return [{
            displayName: value.category,
            value: getFormattedValue(value.value)
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