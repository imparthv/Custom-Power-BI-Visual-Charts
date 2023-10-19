// Method for legend
export function showLegend(chartSVG: d3.Selection<SVGElement, any, any, any>, stackCategory: string, innerCategories: string[], categoricalColors: string[]) {

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
            return shortenLabel(d, 10)
        });
}

// Method to restrict label size
function shortenLabel(label, maxLength) {
    if (label.length > maxLength) {
        return label.substring(0, maxLength) + "..."; // Shorten the label and add ellipsis
    }
    return label;
}