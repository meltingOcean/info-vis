class Histogram {
    margin = {
        top: 10, right: 10, bottom: 60, left: 60 // Adjusted for space for labels
    }

    constructor(svg, width = 300, height = 600) {
        this.svg = svg;
        this.width = width;
        this.height = height;
        this.colorScale = null; // Initialize colorScale
    }

    initialize() {
        this.svg = d3.select(this.svg);
        this.container = this.svg.append("g");
        this.xAxis = this.svg.append("g");
        this.yAxis = this.svg.append("g");
        this.legend = this.svg.append("g");

        this.xScale = d3.scaleBand();
        this.yScale = d3.scaleLinear();

        this.svg
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.container.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);
        
        this.colorScale = d3.scaleOrdinal()
            .domain(["Aerodome", "Heliport", "Seaport", "Gliderport", "Ultralightport"])
            .range(d3.schemeTableau10);
        
        this.svg.append("text")
            .attr("class", "x-axis-label")
            .attr("text-anchor", "middle")
            .attr("x", this.width / 2 + this.margin.left)
            .attr("y", this.height + this.margin.top + this.margin.bottom - 10)
            .text("Airport");

        this.svg.append("text")
            .attr("class", "y-axis-label")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", - this.height / 2 - this.margin.top)
            .attr("y", this.margin.left - 40)
            .text("Elevation");
    }

    update(data) {

        const names = data.map(d => d.name);
        const elevations = data.map(d => d.elevation);

        this.xScale.domain(names).range([0, this.width]).padding(0.3);
        this.yScale.domain([0, d3.max(elevations)]).range([this.height, 0]);

        this.container.selectAll("rect")
            .data(data)
            .join("rect")
            .attr("x", d => this.xScale(d.name))
            .attr("y", d => this.yScale(d.elevation))
            .attr("width", this.xScale.bandwidth())
            .attr("height", d => this.height - this.yScale(d.elevation))
            .attr("fill", d => this.colorScale(d.airport_type)); // Set color based on airport type

        this.xAxis
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top + this.height})`)
            .call(d3.axisBottom(this.xScale))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        this.yAxis
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
            .call(d3.axisLeft(this.yScale));
    }

    setColorScale(colorScale) {
        this.colorScale = colorScale; // Method to set the color scale
    }
}
