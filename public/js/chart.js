var palette = new Rickshaw.Color.Palette();

var graph;

graph = new Rickshaw.Graph.Ajax( {
	element: document.getElementById('chart'),
	width: 1024,
	height: 600,
	renderer: 'line',
	min: 'auto',
	interpolation: 'linear',
	stroke: true,
	dataURL: dataURL,
	onData: function(data) { 
		var date = new Date();

		for (var d in data) {
			data[d].color = palette.color();
		}

		return data;
	},
	onComplete: function(transport) {
		var timeFixture = new Rickshaw.Fixtures.Time();
		timeFixture.formatTime = function(d) {
			return d3.time.format('%I:%M %p')(d);
		};

		var x_axis = new Rickshaw.Graph.Axis.Time({
			graph: transport.graph,
			timeFixture: timeFixture
		});
		x_axis.graph.update();

		var y_ticks = new Rickshaw.Graph.Axis.Y({
			graph: transport.graph,
			orientation: 'left',
			tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
			element: document.getElementById('y_axis'),
		});
		y_ticks.graph.update();

		var Legend = function(args) {

			var element = this.element = args.element;
			var graph = this.graph = args.graph;

			var self = this;

			element.classList.add('rickshaw_legend');

			var list = this.list = document.createElement('ul');
			element.appendChild(list);

			var series = graph.series
				.map( function(s) { return s } );

			if (!args.naturalOrder) {
				series = series.reverse();
			}

			this.lines = [];

			this.addLine = function (series) {
				var line = document.createElement('li');
				line.className = 'line';
				if (series.disabled) {
					line.className += ' disabled';
				}

				var swatch = document.createElement('div');
				swatch.className = 'swatch';
				swatch.style.backgroundColor = series.color;

				line.appendChild(swatch);

				var label = document.createElement('span');
				label.className = 'label';
				label.innerHTML = series.name + '<a href="' + series.url + '"> &rarr;</a>';

				line.appendChild(label);
				list.appendChild(line);

				line.series = series;

				if (series.noLegend) {
					line.style.display = 'none';
				}

				var _line = { element: line, series: series };
				if (self.shelving) {
					self.shelving.addAnchor(_line);
					self.shelving.updateBehaviour();
				}
				if (self.highlighter) {
					self.highlighter.addHighlightEvents(_line);
				}
				self.lines.push(_line);
			};

			series.forEach( function(s) {
				self.addLine(s);
			} );

			graph.onUpdate( function() {} );
		};

		var legend = new Legend({
			element: document.querySelector('#legend'),
			graph: transport.graph
		});

		legend.graph.update();

		var shelving = new Rickshaw.Graph.Behavior.Series.Toggle({
			graph: transport.graph,
			legend: legend
		});

		var renderForm = document.getElementById('render_form');
		renderForm.addEventListener('change', function(e) {
			var renderMode = e.target.value;
			transport.graph.setRenderer(renderMode);
			transport.graph.render();
		}, false);
		
		var Hover = Rickshaw.Class.create(Rickshaw.Graph.HoverDetail, {

			render: function(args) {

				var graph = this.graph;
				var points = args.points;
				var point = points.filter( function(p) { return p.active } ).shift();

				if (point.value.y === null) return;

				var formattedXValue = point.formattedXValue;
				var formattedYValue = point.formattedYValue;

				this.element.innerHTML = '';
				this.element.style.left = graph.x(point.value.x) + 'px';

				var xLabel = document.createElement('div');

				xLabel.className = 'x_label';
				xLabel.innerHTML = formattedXValue;
				this.element.appendChild(xLabel);

				var item = document.createElement('div');

				item.className = 'item';

				// invert the scale if this series displays using a scale
				var series = point.series;
				var actualY = series.scale ? series.scale.invert(point.value.y) : point.value.y;

				item.innerHTML = this.formatter(series, point.value.x, actualY, formattedXValue, formattedYValue, point) + '</br>' + point.value.committer + ' (+' + point.value.additions + '/-' + point.value.deletions + ')' + '</br>' + point.value.message;
				item.style.top = this.graph.y(point.value.y0 + point.value.y) + 'px';

				this.element.appendChild(item);

				var dot = document.createElement('div');

				dot.className = 'dot';
				dot.style.top = item.style.top;
				dot.style.borderColor = series.color;

				this.element.appendChild(dot);

				if (point.active) {
					item.className = 'item active';
					dot.className = 'dot active';
				}

				this.show();

				if (typeof this.onRender == 'function') {
					this.onRender(args);
				}
			}
		});

		var hover = new Hover( {
		 	xFormatter: function(x) {
				return d3.time.format('%a %H:%M:%S')(new Date(x * 1000));
			}, 
			graph: transport.graph
		});
	}
});