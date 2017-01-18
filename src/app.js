const ipOnlyRegex = /^\s*(\d+)\s+((\d+\.){3}\d+)\s+.*/;
const hostAndIpRegex = /^\s*(\d+).*\(((\d+\.){3}\d+)\)\s+.*/;

var parseLine = function (line) {
    var match = ipOnlyRegex.exec(line) || hostAndIpRegex.exec(line);
    if (!match) {
        return false;
    }
    return {
        'hop': match[1],
        'ip': match[2]
    }
};

var queryNode = function (node) {
    return axios.get('https://ipinfo.io/' + node['ip']).then(function (resp) {
        node['ip_info'] = resp.data;
        var address = '';
        if (resp.data['city']) {
            address += resp.data['city'] + ', ';
        }
        address += resp.data['country'];
        node['address'] = address;
        return node;
    });
};

var map = L.map('map').fitWorld();
var markersLayer = L.layerGroup().addTo(map);
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var app = new Vue({
    el: '#app',
    data: {
        message: '',
        trace: '',
        route: []
    },
    watch: {
        trace: function(trace) {
            var app = this;
            app.error = false;
            var lines = _.split(trace, '\n');
            var route = _.compact(_.map(lines, parseLine));
            var mappedRoute = _.map(route, queryNode);
            axios.all(mappedRoute).then(function (route) {
                app.route = route;
                app.drawRoute(route);
            }).catch(function (e) {
                console.log(e);
                app.error = e;
                app.message = 'Error! Cannot query ipinfo.io API for some of the locations. ' +
                    'Perhaps you have reach their 1000 daily requests limit?';
                app.route = [];
            });
        }
    },
    methods: {
        drawRoute: function (route) {
            markersLayer.clearLayers();
            if (route.length === 0) {
                return;
            }
            var nonPrivateNodes = _.filter(route, function (node) {
                return !node['ip_info']['bogon'];
            });
            var markers = _.map(nonPrivateNodes, function (node) {
                var geo = node['ip_info']['loc'];
                var latlng = _.split(geo, ',').map(parseFloat);
                var icon = L.divIcon({iconSize: 24, className: 'pin', html: node['hop']});
                var marker = new PopupOnHoverMarker(latlng, {icon: icon}).addTo(markersLayer);
                var popupTemplate = _.template('#<%= hop %>: <%= ip %><br><%= address %>');
                var popup = popupTemplate(node);
                marker.bindPopup(popup);
                node['latlng'] = latlng;
            });
            var latlngs = _.map(nonPrivateNodes, function (node) {
                return node['latlng'];
            });
            var polyline = L.polyline(latlngs, {color: 'orange', noClip: true}).addTo(markersLayer);
            map.fitBounds(polyline.getBounds());
        }
    }
});

// Custom Marker that open popup on mouse hover
// http://jsfiddle.net/sowelie/3JbNY/
var PopupOnHoverMarker = L.Marker.extend({
    bindPopup: function (htmlContent, options) {
        L.Marker.prototype.bindPopup.apply(this, [htmlContent, options]);
        this.off("click", this.openPopup, this);
        this.on("mouseover", function (e) {
            var target = e.originalEvent.fromElement || e.originalEvent.relatedTarget;
            var parent = this._getParent(target, "leaflet-popup");
            // check to see if the element is a popup, and if it is this marker's popup
            if (parent == this._popup._container) {
                return true;
            }
            this.openPopup();
        }, this);

        this.on("mouseout", function (e) {
            var target = e.originalEvent.toElement || e.originalEvent.relatedTarget;
            // check to see if the element is a popup
            if (this._getParent(target, "leaflet-popup")) {
                L.DomEvent.on(this._popup._container, "mouseout", this._popupMouseOut, this);
                return true;
            }
            setTimeout(this.closePopup, 100);
        }, this);
    },

    _popupMouseOut: function (e) {
        L.DomEvent.off(this._popup, "mouseout", this._popupMouseOut, this);
        var target = e.toElement || e.relatedTarget;
        if (this._getParent(target, "leaflet-popup")) {
            return true;
        }
        if (target == this._icon) {
            return true;
        }
        this.closePopup();
        setTimeout(this.closePopup, 100);
    },

    _getParent: function (element, className) {
        var parent = element.parentNode;
        while (parent != null) {
            if (parent.className && L.DomUtil.hasClass(parent, className)) {
                return parent;
            }
            parent = parent.parentNode;
        }
        return false;
    }
});
