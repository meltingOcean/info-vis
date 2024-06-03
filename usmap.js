class USmap {
    margin = {
        top: 10, right:100, bottom: 40, left: 20
    }

    constructor(svg, tooltip, data, width = 1000, height = 600) {
        this.svg = svg;
        this.tooltip = tooltip;
        this.data = data;
        this.width = width;
        this.height = height;
        this.filteredData = data;
        
        this.handlers = {};
        this.draggedPoints = [];
        this.selectedTypes = [];
        this.projection = d3.geoAlbersUsa().scale(1280).translate([480, 300]);

        this.dragPoint = { x: -95, y: 35 };
        this.rectSize = 100;
    }

    initialize() {
        this.svg = d3.select(this.svg);
        this.tooltip = d3.select(this.tooltip)
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "#f9f9f9")
            .style("border", "1px solid #ccc")
            .style("padding", "10px")
            .style("border-radius", "4px");

        this.container = this.svg.append("g");
        this.svg
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.container.attr("transform", `translate(${this.margin.left}, ${this.margin.top})`);

        this.mapLayer = this.svg.append("g").attr("class", "map-layer");
        this.pointsLayer = this.svg.append("g").attr("class", "points-layer");
        
        this.colorScale = d3.scaleOrdinal()
            .domain(["Aerodome", "Heliport", "Seaport", "Gliderport", "Ultralightport"])
            .range(d3.schemeTableau10);
        
        this.createWindow();
        this.createUSmap();
        this.createLegend();
        this.createAxes();
        this.addRangeInputs();
    }

    update(selectedTypes, minElevation, maxElevation) {
        this.selectedTypes = selectedTypes;
        const filteredData = this.data.filter(d => 
            selectedTypes.includes(d.airport_type) && 
            d.elevation >= minElevation && 
            d.elevation <= maxElevation
        );
        this.filteredData = filteredData
        console.log( filteredData )
        const colorScale = d3.scaleOrdinal()
            .domain(["Aerodome", "Heliport", "Seaport", "Gliderport", "Ultralightport"])
            .range(d3.schemeTableau10);

        const self = this;

        const airportDot = this.pointsLayer.selectAll("rect.airport-dot")
            .data(filteredData, d => d.id)
            .join("rect")
            .attr("class", "airport-dot")
            .attr("fill", d => colorScale(d.airport_type))
            .attr("width", 5)
            .attr("height", 5)
            .attr("transform", d => {
                const coords = this.projection([d.longitude, d.latitude]);
                return coords ? `translate(${coords})` : `translate(-9999, -9999)`;
            })
            .on("mouseover", function(event, d) {
                self.tooltip
                    .style("visibility", "visible")
                    .html(`
                        <strong>${d.name}</strong><br>
                        latitude: ${d.latitude}<br>
                        longitude: ${d.longitude}<br>
                        elevation: ${d.elevation}
                    `);
                d3.select(this).attr("stroke", "black");
            })
            .on("mousemove", function(event) {
                self.tooltip
                    .style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", function() {
                self.tooltip.style("visibility", "hidden");
                d3.select(this).attr("stroke", null);
            });

         this.updateDraggableRectPosition()   
    }

    async loadUSData() {
        const us = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@1/us/10m.json");
        us.objects.lower48 = {
            type: "GeometryCollection",
            geometries: us.objects.states.geometries.filter(d => d.id !== "02" && d.id !== "15")
        };
        return us;
    }

    // 맵 생성. 수정하면 안됨
    async createUSmap() {

        const us = await this.loadUSData();
        const airportdata = await d3.csv("https://raw.githubusercontent.com/meltingOcean/info-vis/main/us_airports.csv", d3.autoType);
        this.data = airportdata;

        this.mapLayer.append("path")
            .datum(topojson.merge(us, us.objects.lower48.geometries))
            .attr("fill", "#ddd")
            .attr("d", d3.geoPath());

        this.mapLayer.append("path")
            .datum(topojson.mesh(us, us.objects.lower48, (a, b) => a !== b))
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-linejoin", "round")
            .attr("d", d3.geoPath());
    }

    // 점을 선택하는 윈도우 생성
    createWindow() {
        let offsetX, offsetY;
        const self = this;

        function dragstarted(event, d) {
            const coords = self.projection([d.x, d.y]);
            if (!coords) return;
            offsetX = event.x - coords[0];
            offsetY = event.y - coords[1];
            d3.select(this).raise().attr("stroke", "black");
        }

        function dragged(event, d) {
            const newCoords = self.projection.invert([event.x - offsetX, event.y - offsetY]);
            if (!newCoords) return;
            d.x = newCoords[0];
            d.y = newCoords[1];
            const translateCoords = self.projection([newCoords[0], newCoords[1]]);
            if (translateCoords) {
                d3.select(this).attr("transform", `translate(${translateCoords[0] - self.rectSize / 2}, ${translateCoords[1] - self.rectSize / 2})`);
                self.updateDraggedPoints(d);
            }
        }

        function dragended(event, d) {
            d3.select(this).attr("stroke", null);
            histogram.update(self.draggedPoints);
        }

        const drag = d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);

        this.draggableRect = this.pointsLayer.append("rect")
            .data([this.dragPoint])
            .join("rect")
            .attr("class", "draggable-rect")
            .attr("fill", "red")
            .attr("width", this.rectSize)
            .attr("height", this.rectSize)
            .attr("opacity", 0.5)
            .attr("transform", d => {
                const coords = self.projection([d.x, d.y]);
                return coords ? `translate(${coords[0] - self.rectSize / 2}, ${coords[1] - self.rectSize / 2})` : `translate(-9999, -9999)`;
            })
            .call(drag);

        this.updateDraggedPoints = function(dragPoint) {
            if (!self.data) return;

            const [x0, y0] = self.projection([dragPoint.x, dragPoint.y]);
            if (!x0 || !y0) return;

            const visiblePoints = self.filteredData.filter(point => {
                const projectedPoint = self.projection([point.longitude, point.latitude]);
                if (!projectedPoint) return false;
                const [x, y] = projectedPoint;
                return x >= 0 && x <= self.width && y >= 0 && y <= self.height && self.selectedTypes.includes(point.airport_type);
            });
            self.draggedPoints = visiblePoints.filter(point => {
                const [x, y] = self.projection([point.longitude, point.latitude]);
                return x >= x0 - self.rectSize / 2 && x <= x0 + self.rectSize / 2 && y >= y0 - self.rectSize / 2 && y <= y0 + self.rectSize / 2;
            });
        }
    }

    updateDraggableRectPosition() {
        const latitude = +d3.select("#latitude-range").property("value");
        const longitude = +d3.select("#longitude-range").property("value");

        this.dragPoint.x = longitude;
        this.dragPoint.y = latitude;
        const coords = this.projection([this.dragPoint.x, this.dragPoint.y]);

        if (coords) {
            this.draggableRect
                .attr("transform", `translate(${coords[0] - this.rectSize / 2}, ${coords[1] - this.rectSize / 2})`);
            this.updateDraggedPoints(this.dragPoint);
        }
    }
    addRangeInputs() {
        const self = this;

        const latitudeRange = d3.select("#latitude-range");
        const longitudeRange = d3.select("#longitude-range");
        const sizeRange = d3.select("#size-range");
        const latitudeValue = d3.select("#latitude-value");
        const longitudeValue = d3.select("#longitude-value");
        const sizeValue = d3.select("#size-value");
        const minElevation = d3.select("#min-elevation");
        const maxElevation = d3.select("#max-elevation");

        latitudeRange.on("input", function() {
            const latitude = +this.value;
            latitudeValue.text(latitude);
            self.updateDraggableRectPosition();
        });

        longitudeRange.on("input", function() {
            const longitude = +this.value;
            longitudeValue.text(longitude);
            self.updateDraggableRectPosition();
        });

        sizeRange.on("input", function() {
            const size = +this.value;
            sizeValue.text(size);
            self.updateDraggableRectSize(size);
        });

        latitudeRange.on("change", function() {
            histogram.update(self.draggedPoints);
        });

        longitudeRange.on("change", function() {
            histogram.update(self.draggedPoints);
        });

        sizeRange.on("change", function() {
            histogram.update(self.draggedPoints);
        });
        minElevation.on("input", function() {
            d3.select("#min-elevation-value").text(this.value + "ft");
            min = this.value;
            self.updateDraggableRectPosition();
            updateUSmap();
        });
        maxElevation.on("input", function() {
            d3.select("#max-elevation-value").text(this.value + "ft");
            max = this.value;
            self.updateDraggableRectPosition();
            updateUSmap();
        });
        d3.select("#min-elevation").on("change", function() {
            histogram.update(self.draggedPoints);
        });
        d3.select("#max-elevation").on("change", function() {
            histogram.update(self.draggedPoints);
        });
    }

    updateDraggableRectPosition() {
        const latitude = +d3.select("#latitude-range").property("value");
        const longitude = +d3.select("#longitude-range").property("value");

        this.dragPoint = { x: longitude, y: latitude };
        const coords = this.projection([this.dragPoint.x, this.dragPoint.y]);

        if (coords) {
            this.draggableRect
                .attr("transform", `translate(${coords[0] - this.rectSize / 2}, ${coords[1] - this.rectSize / 2})`);
            this.updateDraggedPoints(this.dragPoint);
        }
    }

    updateDraggableRectSize(size) {
        this.rectSize = size;
        this.draggableRect
            .attr("width", this.rectSize)
            .attr("height", this.rectSize);

        const coords = this.projection([this.dragPoint.x, this.dragPoint.y]);
        if (coords) {
            this.draggableRect
                .attr("transform", `translate(${coords[0] - this.rectSize / 2}, ${coords[1] - this.rectSize / 2})`);
            this.updateDraggedPoints(this.dragPoint);
        }
    }

    createAxes() {
        const xAxis = d3.axisBottom(d3.scaleLinear()
            .domain([-130, -60])
            .range([0, this.width])
        );
        
        const yAxis = d3.axisLeft(d3.scaleLinear()
            .domain([20, 50])
            .range([this.height, 0])
        );

        this.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(${this.margin.left}, ${this.height + this.margin.top})`)
            .call(xAxis);

        this.svg.append("g")
            .attr("class", "y axis")
            .attr("transform", `translate(${this.margin.left}, ${this.margin.top})`)
            .call(yAxis);
    }

    createLegend() {
        const legend = this.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(850, 500)`);

        const legendData = this.colorScale.domain();

        legend.selectAll("rect")
            .data(legendData)
            .enter().append("rect")
            .attr("x", 0)
            .attr("y", (d, i) => i * 20)
            .attr("width", 10)
            .attr("height", 10)
            .attr("fill", d => this.colorScale(d));

        legend.selectAll("text")
            .data(legendData)
            .enter().append("text")
            .attr("x", 20)
            .attr("y", (d, i) => i * 20 + 9)
            .text(d => d)
            .style("font-size", "12px")
            .attr("alignment-baseline", "middle");
    }

    on(eventType, handler) {
        this.handlers[eventType] = handler;
    }
}
