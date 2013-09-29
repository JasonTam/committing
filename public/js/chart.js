var palette = new Rickshaw.Color.Palette();

var graph;

graph = new Rickshaw.Graph.Ajax( {
	element: document.getElementById("chart"),
	width: 1024,
	height: 600,
	renderer: 'line',
	min: 'auto',
	interpolation: 'linear',
	stroke: true,
	dataURL: '/commits/rickshaw',
	onData: function(data) { 
		for (var d in data) {
			data[d].color = palette.color();
		}

		return data;
	},
	onComplete: function(transport) {
		var x_axis = new Rickshaw.Graph.Axis.Time({
			graph: transport.graph
		});
		x_axis.graph.update();

		var y_ticks = new Rickshaw.Graph.Axis.Y({
			graph: transport.graph,
			orientation: 'left',
			tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
			element: document.getElementById('y_axis'),
		});
		y_ticks.graph.update();

		var legend = new Rickshaw.Graph.Legend( {
			element: document.querySelector('#legend'),
			graph: transport.graph
		});
		legend.graph.update();

		var hoverDetail = new Rickshaw.Graph.HoverDetail({
			graph: transport.graph
		});
		

		var offsetForm = document.getElementById('offset_form');
		offsetForm.addEventListener('change', function(e) {
				var offsetMode = e.target.value;
				console.log(offsetMode);
				if (offsetMode == 'line') {
						transport.graph.setRenderer('line');
				} else {
						transport.graph.setRenderer('scatterplot');
						// transport.graph.renderer.unstack = true;
				}       
				transport.graph.render();
		}, false);
		
			

		$('.label').each(function(i, label) {
			$(this).html($('<a>').attr('href', 'http://github.com/' + $(this).text()).text($(this).text()));
		});
	}
});