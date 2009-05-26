//----------------------------------------------------------------------
// node user data manager
//----------------------------------------------------------------------

var NodeUserData = Structure.extend({
	prefix: '',
	constructor: function (prefix) {
		this.prefix = prefix ? prefix + ':' : '';
	},
	
	get: function (node, key) {
		return node.getUserData(this.prefix + key);
	},
	
	set: function (node, key, data) {
		return node.setUserData(this.prefix + key, data, null);
	},
	
	has: function (node, key) {
		return this.get(node, key) != null;
	},
	
	remove: function (node, key) {
		this.set(node, key, null);
	}
});

// check for implementation of DOM UserData
if (!document.getUserData || !document.setUserData)
{
	// create private data cache
	var userData = {}, userDataID = 0;
	NodeUserData.prototype.get = function (node, key) {
		if (typeof node['data-userDataKey'] == 'undefined')
			node['data-userDataKey'] = ++userDataID;
		return userData[node['data-userDataKey']] && userData[node['data-userDataKey']][key];
	};
	NodeUserData.prototype.set = function (node, key, data) {
		var old = this.get(node, key);
		(userData[node['data-userDataKey']] || (userData[node['data-userDataKey']] = {}))[key] = data;
		return old;
	};
}