//----------------------------------------------------------------------
// resize observer
//----------------------------------------------------------------------

// node resize polling function (can't trust window.resize cross-browser)

var ResizeObserver = Base.extend({
	constructor: function (node) {
		this.node = node;
		this.refresh();
		
		// add polling function
		setInterval(bind(this.poll, this), 250);
	},
	
	node: null,
	width: 0,
	height: 0,
	getDimension: function (dimension) {
		// clientWidth/Height will not include scrollbars
		return this.node['client' + dimension];
	},
	refresh: function () {
		this.width = this.getDimension('Width');
		this.height = this.getDimension('Height');
	},
	poll: function () {
		// compare window size
		if (this.width != this.getDimension('Width') || this.height != this.getDimension('Height')) {
			for (var i = 0; i < this.listeners.length; i++)
				this.listeners[i](this);
		}
		// update cache
		this.refresh();
	},
	listeners: [],
	addListener: function (listener) {
		this.listeners.push(listener);
	}
});