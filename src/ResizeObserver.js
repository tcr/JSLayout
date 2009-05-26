//----------------------------------------------------------------------
// resize observer
//----------------------------------------------------------------------

// element resize polling function (can't trust window.resize cross-browser)

var ResizeObserver = Structure.extend({
	element: null,
	timeout: 0,
	constructor: function (element, timeout) {
		this.element = element;
		this.timeout = timeout || 25;
		// initial call (no listeners, just updating cache)
		this.poll();
	},
	
	width: 0,
	height: 0,
	poll: function () {
		// compare window size
		if (this.width != this.element.clientWidth || this.height != this.element.clientHeight) {
			for (var i = 0; i < this.listeners.length; i++)
				this.listeners[i](this);
		}
		
		// update cache
		this.width = this.element.clientWidth;
		this.height = this.element.clientHeight;
		// add timeout
		setTimeout(Utils.bind(this.poll, this), this.timeout);
	},
	
	listeners: [],
	addListener: function (listener) {
		this.listeners.push(listener);
	}
});